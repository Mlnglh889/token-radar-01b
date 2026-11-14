// Token Radar entry: deterministic, offline, and deliberately evidence-led.
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-board.ts';
import { buildRadar, boardIssue, dataScript, parseSnapshot } from './lib/model.ts';

const here = fileURLToPath(new URL('.', import.meta.url));

function arg(name: string, fallback: string): string {
  const flag = `--${name}`;
  const index = process.argv.indexOf(flag);
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1]!;
  const inline = process.argv.find((value) => value.startsWith(`${flag}=`));
  return inline ? inline.slice(flag.length + 1) : fallback;
}

const input = arg('input', '/input');
const inputFile = input.endsWith('.json') ? input : join(input, 'snapshot.json');
if (!existsSync(inputFile)) {
  process.stderr.write(`Missing snapshot: ${inputFile}\n`);
  process.exit(2);
}

const out = arg('output', process.env.MAKEFUN_OUTPUT_DIR ?? '/output');
const snapshot = parseSnapshot(readFileSync(inputFile, 'utf8'));
const built = buildRadar(snapshot);
const board = built.board
  .slice()
  .sort((a, b) => b.implied_value_usd - a.implied_value_usd || a.slug.localeCompare(b.slug))
  .map((row, index) => ({ ...row, rank: index + 1 }));
const radar = { ...built.radar, rows: board };
const issue = boardIssue(board, snapshot);
if (issue) {
  process.stderr.write(`${issue}\n`);
  process.exit(1);
}

mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'board.json'), `${JSON.stringify({ rows: board })}\n`);
writeFileSync(join(out, 'data.js'), dataScript(radar));

function copyDir(from: string, to: string): void {
  mkdirSync(to, { recursive: true });
  for (const name of readdirSync(from)) {
    if (name.startsWith('.')) continue;
    const source = join(from, name);
    if (statSync(source).isFile()) copyFileSync(source, join(to, name));
  }
}

copyDir(join(here, 'dashboard'), join(out, 'dashboard'));
copyDir(join(here, 'screenshots'), join(out, 'screenshots'));
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 65536,
    screenshots: { max: 4, max_bytes: 524288 },
    dashboard: { max_files: 400, max_bytes: 4194304 },
  }),
);
process.stdout.write(`radar: ${board.length} rows, ${snapshot.watchlist.length} watchlist covered\n`);
