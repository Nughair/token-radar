// Launch Radar's handover program (Node 22, standard library only).
//
// It reads the sealed snapshot (/input/snapshot.json in the grader, or --input <file|dir>),
// scores every standalone pre-token protocol with the model in lib/model.ts, writes the ranked
// board to /output/board.json, writes the dashboard's data to /output/data.js, copies this
// repository's dashboard/ and screenshots/ into /output, and finishes by writing
// /output/dossier.json with the vendored make.fun library — the same bytes the scorer rebuilds.
//
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json
//
// The program is deterministic: the same snapshot in, the same bytes out, on every run.

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boardIssue, buildRadar, dataScript, parseSnapshot } from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));

/** The gate's own caps (reference/gate.json), passed to buildDossier so an over-cap output refuses here first. */
const DOSSIER_CAPS = {
  text_max_bytes: 65_536,
  screenshots: { max: 4, max_bytes: 524_288 },
  dashboard: { max_files: 400, max_bytes: 4_194_304 },
};
const IMAGE_NAME = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;

/** The value of `--name <value>` or `--name=<value>` in the arguments, or the fallback. */
function argument(name: string, fallback: string): string {
  const at = process.argv.indexOf(`--${name}`);
  if (at >= 0 && at + 1 < process.argv.length) return process.argv[at + 1]!;
  const inline = process.argv.find((a) => a.startsWith(`--${name}=`));
  return inline === undefined ? fallback : inline.slice(name.length + 3);
}

function fail(message: string): never {
  process.stderr.write(`launch radar: ${message}\n`);
  process.exit(1);
}

const inputArg = argument('input', '/input');
const snapshotFile = inputArg.endsWith('.json') ? inputArg : join(inputArg, 'snapshot.json');
if (!existsSync(snapshotFile)) fail(`no snapshot at ${snapshotFile}: pass --input <snapshot.json|directory> or mount the sealed /input`);
const outputDir = argument('output', process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

const snapshot = parseSnapshot(readFileSync(snapshotFile, 'utf8'));
const { board, radar } = buildRadar(snapshot);
const issue = boardIssue(board, snapshot);
if (issue !== null) fail(`the model wrote a board the gate refuses: ${issue}`);

mkdirSync(outputDir, { recursive: true });
writeFileSync(join(outputDir, 'board.json'), `${JSON.stringify({ rows: board })}\n`);
writeFileSync(join(outputDir, 'data.js'), dataScript(radar));

/** Copy a directory tree's regular files into the output, skipping dot-names at every level. */
function copyTree(from: string, to: string): string[] {
  if (!existsSync(from)) return [];
  mkdirSync(to, { recursive: true });
  const copied: string[] = [];
  for (const name of readdirSync(from)) {
    if (name.startsWith('.')) continue;
    const source = join(from, name);
    const target = join(to, name);
    if (statSync(source).isDirectory()) copied.push(...copyTree(source, target));
    else if (statSync(source).isFile()) {
      copyFileSync(source, target);
      copied.push(name);
    }
  }
  return copied;
}

const dashboardFiles = copyTree(join(repoRoot, 'dashboard'), join(outputDir, 'dashboard'));
const shots = copyTree(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'));
if (dashboardFiles.length === 0) fail('dashboard/ is empty: the page is part of the entry');
if (shots.length < 3) fail(`screenshots/ holds ${shots.length} image${shots.length === 1 ? '' : 's'}: hand in 3 or 4, the board, a detail view and a filtered view`);
if (shots.length > 4) fail(`screenshots/ holds ${shots.length} images: the gate takes at most 4`);
for (const name of shots) {
  if (!IMAGE_NAME.test(name)) fail(`screenshots/${name}: a name is letters, digits and . _ -, 1 to 128 characters, never starting with a dot or dash`);
}

// The dossier is written last, from the finished output: the scorer rebuilds it and compares bytes.
writeFileSync(join(outputDir, 'dossier.json'), buildDossier(outputDir, DOSSIER_CAPS));

process.stdout.write(
  `launch radar: ${snapshot.protocols.length} protocols read, ${radar.stats.pre_token} record no token, ` +
    `${board.length} ranked (${radar.stats.watchlist_rows} watchlist, ${radar.stats.early_rows} early), ` +
    `${radar.stats.not_ranked} wrappers and exchanges tracked but not ranked\n` +
    `launch radar: wrote board.json (${board.length} rows), data.js, dashboard/ (${dashboardFiles.length} files), ` +
    `screenshots/ (${shots.length} images) and dossier.json under ${outputDir}\n`,
);
