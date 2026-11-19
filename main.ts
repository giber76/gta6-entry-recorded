// main.ts — Solara Bay entrypoint (Node 22, standard library only).
// Copies game/ and screenshots/ into the output directory and writes dossier.json
// with buildDossier from the kit's vendor/makefun-game.ts. Runs twice, same bytes.

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Start from a clean output directory so both runs produce identical bytes.
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const gameDir = join(repoRoot, 'game');
const shotsDir = join(repoRoot, 'screenshots');
if (!existsSync(gameDir)) throw new Error('game/: no such directory');
if (!existsSync(shotsDir)) throw new Error('screenshots/: no such directory');

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
