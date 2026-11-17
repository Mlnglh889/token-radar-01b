# Token Radar · Research desk

[![make.fun](https://make.fun/badge/token-radar-01.svg)](https://make.fun/c/token-radar-01)
[![Rank](https://make.fun/badge/token-radar-01/Mlnglh889/token-radar-01b/rank.svg)](https://make.fun/c/token-radar-01)
[![Reward](https://make.fun/badge/token-radar-01/Mlnglh889/token-radar-01b/reward.svg)](https://make.fun/c/token-radar-01)

An offline protocol research dashboard built from the competition's sealed DefiLlama snapshot. The supplied fixture produces 758 ranked records: 194 candidates, 416 records with token evidence, and 148 derivative/exchange/versioned records needing separate review. All 40 watchlist members are covered. Counts describe this fixture, not the live market.

## Run

Node 22.18+; standard library only. No installation or runtime network access.

```bash
node main.ts --input /path/to/snapshot.json --output /tmp/token-radar
node verify.ts /path/to/snapshot.json
python3 -m http.server 8000 --directory /tmp/token-radar
```

Open `/dashboard/` on the local server. Outputs are `board.json`, `data.js`, `dashboard/`, `screenshots/` and `dossier.json`. `buildDossier` is the competition library, with the prescribed 65,536-byte source budget. Data stays beside the dashboard so its full source remains visible in the dossier.

## Model

`dashboard/model.js` is executed by both `main.ts` and the browser. Every row uses:

```
growth = 1 + clamp(change_7d, -50, 100) / 100
maturity = 0.5 + 0.5 * min(listed_age_days, 1095) / 1095
implied_value_usd = max(1, round(tvl_usd * 0.25 * growth * maturity))
```

Inputs are sealed snapshot fields; values are whole US dollars. Missing growth defaults to 0%; an invalid, future or missing tracking date defaults to maturity 0.5. Incomplete inputs stay visibly incomplete. The page recomputes each row, checks exact agreement with the board, and compares assumed base multiples 0.10, 0.25 and 0.50. These are scenarios, not a confidence interval or calibrated valuation. Listing age is tracking history, not verified years without a token. TVL can double-count capital. No token supply, launch probability, reward allocation or future profit is inferred.

Recorded symbol, Gecko ID or finite market cap sends a row to Recorded token. The supplied watchlist remains candidates. Additional records screen out bridge, staking, restaking, CEX, wrapped/staked names, exchange prefixes and version suffixes; these appear under Review / derivative. The snapshot has no parent field, so remaining candidates require manual confirmation. Missing token identifiers never establish an upcoming token.

## Farm research

Every record has six steps. Principal ($100), fee ceiling ($10) and review period (30 days) are explicitly user planning examples, not measured requirements. Gas, fees, minimums, actual lock periods and eligibility remain unverified until checked on the selected product. Unsupported routes stop at free research. No transactions are executed.

Documented mechanisms for Steakhouse/Gauntlet Morpho vaults, Veda partner vaults, Lagoon asynchronous funds, Symbiotic collateral commitments and infiniFi receipt/staking routes were read on 2026-11-17. Each detail exposes its exact documentation URL. Documentation supports mechanisms only; it does not prove a campaign, current fees or eligibility. Remaining records are clearly research-only. The fresh DefiLlama API lookup informed research and never replaces the sealed valuation input.

## Verification

Model boundary tests and full-record reconciliation run with `verify.ts`. Browser QA exercised search focus, all sort buttons, category/chain/watchlist/below-floor/missing-input filters, all status groups, details, sources, farm plans, empty/reset states, keyboard Enter/Escape, and 390px table scrolling. The four PNGs are direct browser captures of the generated output, with no compositing. Browser viewport was 1280×720; capture extends to 1280×900 to meet the kit's minimum 800px short side. Image critique was unavailable because its provider returned 403; DOM checks and PNG captures succeeded.

MIT licensed. Built for [make.fun](https://make.fun/c/token-radar-01).
