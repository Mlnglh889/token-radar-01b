import '../dashboard/model.js';
const model = (globalThis as any).RadarModel;
export interface Protocol { slug:string; name:string; category:string|null; chains:string[]; tvl_usd:number; change_7d:number|null; mcap_usd:number|null; listed_at:string|null; gecko_id:string|null; symbol:string|null }
export interface Snapshot { as_of:string; source:string; floor_usd:number; protocols:Protocol[]; watchlist:string[] }
export function parseSnapshot(text:string):Snapshot {
  const s=JSON.parse(text);
  if (!Array.isArray(s.protocols)||!Array.isArray(s.watchlist)||!/^\d{4}-\d{2}-\d{2}$/.test(s.as_of)) throw Error('Invalid snapshot');
  const ids=new Set();
  for(const p of s.protocols) { if(ids.has(p.slug)||!Number.isFinite(p.tvl_usd)||p.tvl_usd<=0) throw Error('Invalid protocol'); ids.add(p.slug); }
  if(s.watchlist.some((x:string)=>!ids.has(x))) throw Error('Watchlist reference missing');
  return s;
}
// Research evidence is separate from the sealed valuation inputs. No eligibility is inferred.
const routes:Record<string,any>={
 'steakhouse-financial':{source:'https://docs.morpho.org/learn/concepts/vault-v2',action:'Find a Morpho vault curated by Steakhouse through its official site; confirm curator, asset, adapter caps and available exit liquidity. Supply only the supported asset, retain vault shares, then test redeem.',risk:'Curator, collateral, oracle and withdrawal-liquidity risk.'},
 'gauntlet':{source:'https://docs.morpho.org/learn/concepts/vault-v2',action:'Find a Gauntlet-curated Morpho vault through its official site; inspect the curator identity, collateral caps and underlying markets. Supply the listed asset and record shares before testing redeem.',risk:'Vault exposure belongs to underlying markets; a curator has no separate generic deposit contract.'},
 'veda':{source:'https://docs.veda.tech/',action:'Choose a partner product explicitly powered by Veda BoringVault; verify its underlying asset and whitelisted strategy. Inspect the partner deposit and redemption queue before considering a small deposit.',risk:'Partner terms and vault exit queues differ; Veda infrastructure is not itself one universal farm.'},
 'lagoon':{source:'https://docs.lagoon.finance/',action:'Inspect a Lagoon ERC-7540 fund: manager, NAV, fees and investor access. If eligible, request a deposit and wait for settlement; test the request-redeem and claim process before increasing exposure.',risk:'Asynchronous settlement, manager strategy, NAV and access-control risk.'},
 'symbiotic':{source:'https://docs.symbiotic.fi/',action:'Inspect a Symbiotic collateral vault and its curator, obligations and committed period. Confirm withdrawal conditions and collateral support before any deposit; obligations can prevent immediate exit.',risk:'Committed collateral cannot leave before obligations are fulfilled; assess slashing and curator risk.'},
 'infinifi':{source:'https://docs.infinifi.xyz/',action:'Review the documented USDC-to-iUSD deposit route. Compare liquid siUSD staking with liUSD locked positions; for a first test use only a route whose redeem mechanics you understand.',risk:'Fractional-reserve liquidity, depeg and loss-allocation risk; locked positions have different exit terms.'}
};
function plan(p:Protocol) {
 const route=routes[p.slug];
 const chain=p.chains[0]||'an unreported network';
 const research=`https://defillama.com/protocol/${p.slug}`;
 const evidence=route ? 'Documented mechanism; campaign unverified' : 'Research only; route unverified';
 const steps=[
  `Verify ${p.name} using its DefiLlama protocol record (${research}); follow the official domain and check contracts on ${chain}. Research costs $0; allow 15-30 minutes.`,
  route ? `${route.action} Source: ${route.source}` : `No verified deposit or incentive route is bundled for ${p.name} (${p.category||'category unreported'}). Read the product documentation and check access requirements; spend $0 and stop here until the route is verified.`,
  `Planning example only: cap principal at $100, never a required minimum. Obtain approval, deposit and exit gas quotes on ${chain}; add protocol fees, swap spread and any bridge fee. Gas and fees are unmeasured, not $0; skip when quotes exceed your $10 total fee cap.`,
  `Allow 30 minutes for setup and 10 minutes for a weekly review over a 30-day observation window you choose. This is not a required lock or eligibility period. Actual minimums, lock duration and withdrawal delay are unverified; read the selected product terms first.`,
  `${route?route.risk:'Product, contract, liquidity and access risks remain unverified.'} Test a small withdrawal, save shares and transaction receipts, and revoke unused approvals. Exit costs require a fresh quote; never assume principal can be recovered.`,
  `Campaign status is unverified for ${p.name}; no snapshot field proves points, eligibility or a token launch. Read current official terms before acting; no repeated transactions are needed merely to appear active. Reward value and farming profit are unknown.`
 ];
 return {evidence,source:route?route.source:research,checked_at:route?'2026-11-17':null,capital_example_usd:100,fee_cap_example_usd:10,observation_days:30,steps};
}
export function buildRadar(s:Snapshot) {
 const rows=s.protocols.map(p=>{const m=model.evaluate(p,s.as_of);const farm=plan(p);return {...p,rank:0,token_status:model.classify(p,s.watchlist),watchlist:s.watchlist.includes(p.slug),below_floor:p.tvl_usd<s.floor_usd,age_days:m.age_days,implied_value_usd:m.implied_value_usd,model:m,farm,farm_steps:farm.steps};})
 .sort((a,b)=>b.implied_value_usd-a.implied_value_usd||a.slug.localeCompare(b.slug));
 rows.forEach((r,i)=>r.rank=i+1);
 return {board:rows,radar:{as_of:s.as_of,source:s.source,floor_usd:s.floor_usd,watchlist_size:s.watchlist.length,snapshot_size:s.protocols.length,model:{version:model.version},rows}};
}
export function boardIssue(rows:any[],s:Snapshot):string|null {
 if(rows.length!==s.protocols.length||new Set(rows.map(r=>r.slug)).size!==rows.length)return 'Coverage mismatch';
 if(s.watchlist.some(x=>!rows.some(r=>r.slug===x)))return 'Missing watchlist';
 for(let i=0;i<rows.length;i++){const r=rows[i];if(r.rank!==i+1||!Number.isSafeInteger(r.implied_value_usd)||r.implied_value_usd<1||r.implied_value_usd>1e14)return 'Invalid value/rank';if(i&&rows[i-1].implied_value_usd<r.implied_value_usd)return 'Not sorted';if(r.farm_steps.length<3||r.farm_steps.length>12||r.farm_steps.some((t:string)=>t.trim().length<20||t.trim().length>600))return 'Invalid farm steps';}
 return null;
}
export function dataScript(data:any):string{return `window.RADAR=${JSON.stringify(data)};\n`;}
