// Token Radar entrypoint: deterministic, offline, and evidence-led.
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-board.ts';
import { boardIssue, buildRadar, dataScript, parseSnapshot } from './lib/model.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const DEFAULT_INPUT = '/input';
const DEFAULT_OUTPUT = '/output';
// Cover every sealed input record, with candidates separated in the UI.
const REQUIRED_ROWS = 100;

function argument(name: string, fallback: string): string {
  const flag = `--${name}`;
  const inline = process.argv.find((value) => value.startsWith(`${flag}=`));
  if (inline) return inline.slice(flag.length + 1);
  const index = process.argv.indexOf(flag);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1]! : fallback;
}

function fail(message: string, code = 1): never {
  process.stderr.write(`Token Radar error: ${message}\n`);
  process.exit(code);
}

function snapshotPath(input: string): string {
  return input.endsWith('.json') ? input : join(input, 'snapshot.json');
}

function copyDirectory(source: string, destination: string): void {
  if (!existsSync(source) || !statSync(source).isDirectory()) fail(`required directory is missing: ${source}`);
  mkdirSync(destination, { recursive: true });
  for (const name of readdirSync(source)) {
    if (name.startsWith('.')) continue;
    const sourcePath = join(source, name);
    const destinationPath = join(destination, name);
    if (!statSync(sourcePath).isFile()) fail(`expected a regular file in ${source}: ${name}`);
    copyFileSync(sourcePath, destinationPath);
  }
}

function validateBoard(rows: any[], snapshot: ReturnType<typeof parseSnapshot>): void {
  if (rows.length < REQUIRED_ROWS || rows.length !== snapshot.protocols.length) fail(`expected complete snapshot coverage, got ${rows.length}`);

  const ranks = rows.map((row) => row.rank);
  if (ranks.some((rank, index) => rank !== index + 1)) fail('rank validation failed: expected consecutive ranks 1..N');

  const slugs = new Set(rows.map((row) => row.slug));
  const missing = snapshot.watchlist.filter((slug) => !slugs.has(slug));
  if (missing.length > 0) fail(`watchlist coverage failed: missing ${missing.join(', ')}`);

  for (let index = 1; index < rows.length; index += 1) {
    if (rows[index - 1]!.implied_value_usd < rows[index]!.implied_value_usd) {
      fail(`value ordering failed at ranks ${index} and ${index + 1}`);
    }
  }

  for (const row of rows) {
    if (!Array.isArray(row.farm_steps) || row.farm_steps.length < 3 || row.farm_steps.length > 12) {
      fail(`farm-step validation failed for ${row.slug}: expected 3..12 steps`);
    }
    if (row.farm_steps.some((step: unknown) => typeof step !== 'string' || step.trim().length < 20 || step.trim().length > 600)) {
      fail(`farm-step validation failed for ${row.slug}: step length must be 20..600 characters`);
    }
  }
}

const inputFile = snapshotPath(argument('input', DEFAULT_INPUT));
if (!existsSync(inputFile)) fail(`snapshot not found: ${inputFile}`, 2);

const outputDirectory = argument('output', process.env.MAKEFUN_OUTPUT_DIR ?? DEFAULT_OUTPUT);
let snapshot: ReturnType<typeof parseSnapshot>;
try {
  snapshot = parseSnapshot(readFileSync(inputFile, 'utf8'));
} catch (error) {
  fail(`could not parse snapshot ${inputFile}: ${error instanceof Error ? error.message : String(error)}`);
}

const built = buildRadar(snapshot);
const board = built.board
  .slice()
  .sort((left, right) => right.implied_value_usd - left.implied_value_usd || left.slug.localeCompare(right.slug))
  .map((row, index) => ({ ...row, rank: index + 1 }));
validateBoard(board, snapshot);
const issue = boardIssue(board, snapshot);
if (issue) fail(`board validation failed: ${issue}`);

mkdirSync(outputDirectory, { recursive: true });
writeFileSync(join(outputDirectory, 'board.json'), `${JSON.stringify({ rows: board })}\n`);
writeFileSync(join(outputDirectory, 'data.js'), dataScript({ ...built.radar, rows: board }));
copyDirectory(join(here, 'dashboard'), join(outputDirectory, 'dashboard'));
copyDirectory(join(here, 'screenshots'), join(outputDirectory, 'screenshots'));

const dossier = buildDossier(outputDirectory, {
  text_max_bytes: 65536,
  screenshots: { max: 4, max_bytes: 524288 },
  dashboard: { max_files: 400, max_bytes: 4194304 },
});
writeFileSync(join(outputDirectory, 'dossier.json'), dossier);
process.stdout.write(`radar: ${board.length} rows, ${snapshot.watchlist.length} watchlist covered`);
