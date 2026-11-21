// main.ts — Solara Bay's program entrypoint for make.fun (gta6-01).
//
// The grader runs `node /bot/main.ts` in plain Node (no browser, no
// network, /output is a bind mount). So this file:
//  - never touches `document` or `window` (Node-safe),
//  - never removes the output directory itself (rmdir on a bind mount
//    fails EBUSY) — it clears only the directory's CONTENTS,
//  - copies game/ + screenshots/ from this repository into the output
//    directory and writes dossier.json with the kit's buildDossier.
import { mkdirSync, readdirSync, lstatSync, rmSync, cpSync, chmodSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const REPO_ROOT = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR || '/output';

// Remove a path's contents (never the path itself). Directories are
// chmod'ed to 0755 on the way down first: cpSync preserves read-only
// source modes, and unlinking needs write permission on the parent.
function clearContents(dir: string): void {
  // Make this directory writable BEFORE touching its contents:
  // cpSync preserves read-only source modes, and unlinking a file
  // needs write permission on its parent directory.
  try {
    chmodSync(dir, 0o755);
  } catch {
    // best effort; the removes below report the real error
  }
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      clearContents(p);
      rmSync(p, { recursive: true, force: true });
    } else {
      rmSync(p, { force: true });
    }
  }
}

function main(): void {
  const outDir = OUTPUT_DIR;
  mkdirSync(outDir, { recursive: true });
  clearContents(outDir);
  cpSync(join(REPO_ROOT, 'game'), join(outDir, 'game'), { recursive: true });
  cpSync(join(REPO_ROOT, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });
  const dossier = buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 48 * 1024 * 1024,
    game_path_max_bytes: 1000,
  });
  writeFileSync(join(outDir, 'dossier.json'), dossier);
  const gameFiles = readdirSync(join(outDir, 'game')).length;
  const shots = readdirSync(join(outDir, 'screenshots')).length;
  console.log(`Solara Bay: wrote ${outDir}/dossier.json (${dossier.length} bytes), game/ entries: ${gameFiles}, screenshots: ${shots}`);
}

main();
