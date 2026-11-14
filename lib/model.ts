// Token Radar's deterministic, offline scoring model.
//
// The score is deliberately small and inspectable: log10(TVL) carries 48%,
// clamped seven-day growth 22%, listing age 18%, category fit 6%, and chain
// breadth 6%. The resulting implied value is only a ranking signal. A missing
// token record does not mean a token or airdrop exists, will launch, or will be
// worth anything; every farm step is a risk-aware experiment, not a promise.

export interface Protocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: Protocol[];
  watchlist: string[];
}

const DAY_MS = 86_400_000;
const TARGET_EXTRA_ROWS = 200;

export const MODEL = {
  version: 'radar-02',
  tvl_weight: 0.48,
  growth_weight: 0.22,
  age_weight: 0.18,
  category_weight: 0.06,
  chain_weight: 0.06,
  growth_floor: -60,
  growth_cap: 120,
};

function isRankable(protocol: Protocol): boolean {
  return protocol.mcap_usd === null
    && protocol.gecko_id === null
    && protocol.symbol === null
    && protocol.category !== 'CEX'
    && !/\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/.test(protocol.name);
}

function ageDays(asOf: string, listedAt: string | null): number | null {
  if (!listedAt) return null;
  const asOfMs = Date.parse(`${asOf}T00:00:00Z`);
  const listedMs = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(asOfMs) || !Number.isFinite(listedMs)) return null;
  return Math.max(0, Math.floor((asOfMs - listedMs) / DAY_MS));
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function categoryScore(category: string | null): number {
  const value = (category || 'Other').toLowerCase();
  if (/dex|exchange|swap/.test(value)) return 1;
  if (/lend|cdp|stable|yield|farm|vault/.test(value)) return 0.9;
  if (/derivative|perpetual|option/.test(value)) return 0.8;
  if (/bridge|cross/.test(value)) return 0.55;
  if (/gaming|nft/.test(value)) return 0.5;
  return 0.7;
}

function farmSteps(protocol: Protocol, age: number | null): string[] {
  const chains = protocol.chains.length > 0 ? protocol.chains.slice(0, 2).join(' / ') : 'the primary network';
  const category = (protocol.category || 'general DeFi').toLowerCase();
  const capital = protocol.tvl_usd >= 1e9 ? 150 : protocol.tvl_usd >= 1e8 ? 100 : 50;
  const hold = age === null ? 30 : age < 180 ? 60 : age < 365 ? 45 : 30;
  let action: string;
  if (/lend|cdp|collateral/.test(category)) {
    action = `Supply $${capital} USDC on ${chains}, then record the position ID.`;
  } else if (/dex|swap|yield|vault/.test(category)) {
    action = `Make a $${capital} liquidity or swap action on ${chains}; keep the receipt.`;
  } else if (/bridge/.test(category)) {
    action = `Bridge $${capital} in a small test transfer to ${chains}; verify the destination balance.`;
  } else if (/perpetual|derivative/.test(category)) {
    action = `Use no more than $${capital} margin for one hedge on ${chains}; close if risk changes.`;
  } else {
    action = `Use a $${capital} test interaction with this ${category} product on ${chains}; save the transaction hash.`;
  }
  return [
    'Create a separate wallet and fund it with only the amount you accept losing; cost $0-$3 plus gas, 5-10 minutes.',
    `${action} Cost: $${capital} capital plus roughly $2-$8 gas; allow 15-30 minutes.`,
    'Repeat one low-risk qualifying interaction weekly, such as a deposit, swap, vote, or withdrawal; budget $2-$10 gas and 10 minutes per week.',
    `Keep the activity open for at least ${hold} days and log dates, amounts, and hashes; opportunity cost is the $${capital} position.`,
    'Verify announcements only on the protocol\'s signed domain and official channels; never pay a fee to claim anything, 5-10 minutes.',
    'Unwind only after checking slippage, contract status, and approvals; expected gas is $2-$12 and review takes 15 minutes.',
    'Treat any future token or airdrop as uncertain: use a block explorer to verify every transaction before repeating; $0 and 10 minutes.',
  ];
}

export function parseSnapshot(text: string): Snapshot {
  const input = JSON.parse(text) as Partial<Snapshot>;
  return {
    as_of: String(input.as_of),
    source: String(input.source),
    floor_usd: Number(input.floor_usd),
    protocols: (input.protocols || []).map((raw) => {
      const protocol = raw as Protocol;
      return {
        ...protocol,
        category: typeof protocol.category === 'string' ? protocol.category : null,
        chains: Array.isArray(protocol.chains) ? protocol.chains.filter((x): x is string => typeof x === 'string') : [],
        change_7d: typeof protocol.change_7d === 'number' ? protocol.change_7d : null,
        mcap_usd: typeof protocol.mcap_usd === 'number' ? protocol.mcap_usd : null,
        listed_at: typeof protocol.listed_at === 'string' ? protocol.listed_at : null,
        gecko_id: typeof protocol.gecko_id === 'string' ? protocol.gecko_id : null,
        symbol: typeof protocol.symbol === 'string' ? protocol.symbol : null,
      };
    }),
    watchlist: Array.isArray(input.watchlist) ? input.watchlist.map(String) : [],
  };
}

export function buildRadar(snapshot: Snapshot) {
  const wanted = new Set(snapshot.watchlist);
  const pool = snapshot.protocols.filter(isRankable);
  const extras = pool
    .filter((protocol) => !wanted.has(protocol.slug))
    .sort((left, right) => right.tvl_usd - left.tvl_usd || left.slug.localeCompare(right.slug))
    .slice(0, TARGET_EXTRA_ROWS);
  for (const protocol of extras) wanted.add(protocol.slug);

  const scored = pool
    .filter((protocol) => wanted.has(protocol.slug))
    .map((protocol) => {
      const age = ageDays(snapshot.as_of, protocol.listed_at);
      const growth = clamp(protocol.change_7d ?? 0, MODEL.growth_floor, MODEL.growth_cap);
      const ageNormal = clamp(age ?? 365, 0, 1095) / 1095;
      const chainNormal = Math.min(protocol.chains.length, 6) / 6;
      const tvlLog = Math.log10(Math.max(1, protocol.tvl_usd));
      const score = MODEL.tvl_weight * tvlLog
        + MODEL.growth_weight * ((growth + 60) / 180)
        + MODEL.age_weight * ageNormal
        + MODEL.category_weight * categoryScore(protocol.category)
        + MODEL.chain_weight * chainNormal;
      return { protocol, age, growth, tvlLog, ageNormal, chainNormal, score };
    })
    .sort((left, right) => right.score - left.score || left.protocol.slug.localeCompare(right.protocol.slug));

  const rows = scored.map((item, index) => ({
    rank: index + 1,
    slug: item.protocol.slug,
    name: item.protocol.name,
    category: item.protocol.category,
    chains: item.protocol.chains,
    tvl_usd: item.protocol.tvl_usd,
    change_7d: item.protocol.change_7d,
    mcap_usd: item.protocol.mcap_usd,
    listed_at: item.protocol.listed_at,
    token_status: 'pre-token',
    age_days: item.age,
    implied_value_usd: Math.max(1, Math.round(Math.min(1e14, item.protocol.tvl_usd * (0.035 + 0.065 * item.score)))),
    model: {
      score: round4(item.score),
      tvl_component: round4(MODEL.tvl_weight * item.tvlLog),
      growth_component: round4(MODEL.growth_weight * ((item.growth + 60) / 180)),
      age_component: round4(MODEL.age_weight * item.ageNormal),
      category_component: round4(MODEL.category_weight * categoryScore(item.protocol.category)),
      chain_component: round4(MODEL.chain_weight * item.chainNormal),
    },
    farm_steps: farmSteps(item.protocol, item.age),
  }));

  rows.sort((left, right) => right.implied_value_usd - left.implied_value_usd || left.slug.localeCompare(right.slug));
  rows.forEach((row, index) => { row.rank = index + 1; });

  return {
    board: rows,
    radar: {
      as_of: snapshot.as_of,
      source: snapshot.source,
      floor_usd: snapshot.floor_usd,
      model: MODEL,
      watchlist_size: snapshot.watchlist.length,
      board_size: rows.length,
      early_size: rows.filter((row) => !snapshot.watchlist.includes(row.slug)).length,
      live_size: snapshot.protocols.filter((protocol) => !isRankable(protocol)).length,
      rows,
    },
  };
}

export function boardIssue(rows: any[], snapshot: Snapshot): string | null {
  if (rows.length < 200) return 'fewer than 200 rows';
  const slugs = new Set(rows.map((row) => row.slug));
  const missing = snapshot.watchlist.filter((slug) => !slugs.has(slug));
  if (missing.length > 0) return `missing watchlist: ${missing.slice(0, 4).join(',')}`;
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    if (row.rank !== index + 1) return 'bad ranks';
    if (index > 0 && row.implied_value_usd > rows[index - 1].implied_value_usd) return 'not sorted';
    if (row.farm_steps.length < 3 || row.farm_steps.length > 12) return 'bad farm steps';
    if (row.farm_steps.some((step: string) => step.trim().length < 20 || step.trim().length > 600)) return 'bad farm step length';
  }
  return null;
}

export function dataScript(radar: any): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
