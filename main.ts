// main.ts — Solara Bay entrypoint (Node 22, standard library only).
//
// Copies game/ and screenshots/ into the output directory and writes
// dossier.json with buildDossier from the kit's vendor/makefun-game.ts.
// Deterministic: the output directory is wiped first, so two runs write
// the same bytes. The v2 explosion effects (game/src/effects.js) are a
// required part of the entry and are checked before the build runs.

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const gameDir = join(repoRoot, 'game');
const shotsDir = join(repoRoot, 'screenshots');

// Wipe the output directory and recreate it empty, so a second run can
// only write the same bytes as the first.
function freshOutput(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
}

function requireDir(dir: string, label: string): void {
  if (!existsSync(dir)) throw new Error(`${label}: no such directory`);
}

function requireFile(file: string, label: string): void {
  if (!existsSync(file)) throw new Error(`${label}: no such file`);
}

freshOutput(outDir);
requireDir(gameDir, 'game/');
requireDir(shotsDir, 'screenshots/');
requireFile(join(gameDir, 'src', 'effects.js'), 'game/src/effects.js (v2 explosion effects)');

cpSync(gameDir, join(outDir, 'game'), { recursive: true });
cpSync(shotsDir, join(outDir, 'screenshots'), { recursive: true });

const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);
console.log(`Solara Bay entry written to ${outDir} (${dossier.length} byte dossier)`);
