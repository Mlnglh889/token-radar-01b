// Shared by main.ts and the browser. All monetary inputs and outputs are USD.
(function (root) {
  'use strict';
  function ageDays(asOf, listedAt) {
    if (!listedAt) return null;
    var a = Date.parse(asOf + 'T00:00:00Z'), b = Date.parse(listedAt + 'T00:00:00Z');
    return Number.isFinite(a) && Number.isFinite(b) && b <= a ? Math.floor((a-b)/86400000) : null;
  }
  function evaluate(row, asOf, base) {
    var days = ageDays(asOf, row.listed_at);
    var growth = Number.isFinite(row.change_7d) ? Math.max(-50, Math.min(100, row.change_7d)) : 0;
    var g = 1 + growth / 100;
    var m = days === null ? 0.5 : 0.5 + 0.5 * Math.min(days, 1095) / 1095;
    var multiple = base === undefined ? 0.25 : base;
    return { age_days: days, growth_pct: growth, growth_multiplier: g, maturity_multiplier: m,
      base_multiple: multiple, implied_value_usd: Math.max(1, Math.round(row.tvl_usd * multiple * g * m)),
      confidence: days !== null && Number.isFinite(row.change_7d) ? 'Complete inputs' : 'Incomplete inputs' };
  }
  function classify(row, watchlist) {
    if (row.gecko_id || row.symbol || Number.isFinite(row.mcap_usd)) return 'Recorded token';
    if (watchlist.indexOf(row.slug) >= 0) return 'Candidate';
    if (/bridge|staking|restaking|restaked|cex/i.test(row.category || '') || /\b(wrapped|staked|staking)\b/i.test(row.name) || /\s(v\d+(\.\d+)?|\d+\.\d+)$/i.test(row.name) || /^(binance|coinbase|bybit|kraken|bitget|okx|bitfinex|gemini)\b/i.test(row.name)) return 'Review / derivative';
    return 'Candidate';
  }
  root.RadarModel = { version: 'radar-03', evaluate: evaluate, classify: classify, ageDays: ageDays };
}(globalThis));
