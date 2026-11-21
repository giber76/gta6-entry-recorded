// main.ts — the Solara Bay entrypoint (Node-safe: no document/window here).
// Copies game/ and screenshots/ into MAKEFUN_OUTPUT_DIR and writes
// dossier.json via the vendored buildDossier, exactly as the scorer does.
//
// The output dir is a bind mount in the grader, so it must NEVER be removed
// itself: rmdir on a mount point fails EBUSY. We mkdir it, then clear only
// its CONTENTS. Each directory is chmod'ed to 0755 ON THE WAY DOWN, before
// recursing into it — cpSync preserves the read-only modes of the source
// tree, and entries inside a read-only directory cannot be removed.
import { chmodSync, cpSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function clearContents(dir: string): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      chmodSync(p, 0o755);
      clearContents(p);
      rmSync(p, { recursive: true, force: true });
    } else {
      rmSync(p, { force: true });
    }
  }
}

const here = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';
mkdirSync(outDir, { recursive: true });
clearContents(outDir);
cpSync(join(here, 'game'), join(outDir, 'game'), { recursive: true });
cpSync(join(here, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });
const dossier = buildDossier(outDir, CAPS);
writeFileSync(join(outDir, 'dossier.json'), dossier);
console.error(`solara-bay: wrote ${dossier.length} byte dossier.json to ${outDir}`);
