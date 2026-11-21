// Solara Bay — gta6-01 entrypoint. Plain Node 22, standard library only.
//
// What this file does, and nothing else: it gathers the entry's pieces
// (the playable game under game/ and the four screenshots under
// screenshots/) into the output directory the grader reads, then asks
// the vendored make.fun library to build the dossier for the judge.
//
// The grader runs `node main.ts` with no network, a read-only repo and
// a fresh writable output directory. There is no browser here, so this
// file must never reach for document, window, or any other browser
// global — it only copies files and writes one JSON file.

import { chmodSync, cpSync, lstatSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The repository root is the directory this file lives in.
const repoRoot = fileURLToPath(new URL('.', import.meta.url));

// The grader hands us the output directory through the environment;
// outside the grader, /output is the conventional default.
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Remove a path and everything under it. Files copied out of the repo
// keep the repo's modes, so a copied tree can be read-only — and unlinking
// a file needs write permission on its parent directory. Make every
// directory writable on the way down, so the clean slate below can never
// fail on modes.
function removeTree(path: string): void {
  const stat = lstatSync(path);
  if (stat.isDirectory()) {
    chmodSync(path, 0o755);
    for (const entry of readdirSync(path)) {
      removeTree(join(path, entry));
    }
  }
  rmSync(path, { recursive: true, force: true });
}

// Start from a clean slate so a stale file from an earlier run can never
// leak into this one: the grader runs this program twice and compares the
// two outputs byte for byte, so nothing may survive from a previous run.
// The output directory itself must never be removed: in the grader it is
// a mounted directory, and removing a mount point fails (EBUSY) — so
// clear only its contents.
mkdirSync(outputDir, { recursive: true });
for (const entry of readdirSync(outputDir)) {
  removeTree(join(outputDir, entry));
}

// The game itself, exactly as the browser plays it.
cpSync(join(repoRoot, 'game'), join(outputDir, 'game'), { recursive: true });

// The screenshots, the first by name being the cover.
cpSync(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });

// The dossier: the judge's view of the game, built by the kit's library
// from the files just copied, under the competition's caps.
const dossier = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outputDir, 'dossier.json'), dossier);

console.log(`Wrote ${outputDir} (dossier.json: ${dossier.byteLength} bytes)`);
