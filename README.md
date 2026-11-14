# Token Launch Radar

Token Radar is a deterministic, offline TypeScript entry that turns the supplied protocol snapshot into a 240-row pre-token board. It covers every watchlist slug, adds a fixed set of lower-TVL candidates, computes an inspectable score, and writes concrete risk-aware farm steps. The dashboard is a local static page: it reads only the generated `data.js` and makes no network requests.

## Run

From the repository root with Node 22 (which can execute erasable `.ts` here):

```bash
node main.ts --input /path/to/snapshot.json --output /tmp/token-radar-output
```

The output contains `board.json`, `data.js`, `dashboard/`, `screenshots/`, and the generated `dossier.json`.

## Verification

The entry is designed to be run twice against the same snapshot and compared byte-for-byte. The entrypoint validates 240 rows, ranks 1–240, descending implied values, complete watchlist coverage, and 3–12 readable farm steps per row. The score is a ranking heuristic, not a price prediction. “No token” means the snapshot has no token identifiers; it is not evidence that a token or airdrop will launch or have value. Always verify contracts, official domains, approvals, and costs before acting.

This repository is an entry artifact, not financial advice. Do not submit or interact with a protocol solely because it appears on the board.
