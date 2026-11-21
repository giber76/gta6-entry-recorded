// Solara Bay — gta6-01 entry program (Node 22, standard library only).
// Hands the game in: copies game/ and screenshots/ from beside this file
// into /output (or MAKEFUN_OUTPUT_DIR outside the grader) and writes
// /output/dossier.json with the vendored make.fun library.
//
// The output directory is a bind mount in the grader, so this program
// never removes it: it only clears what is inside it, and it chmods each
// directory to writable on the way down before removing anything inside,
// because the copied tree arrives read-only and unlinking needs write
// permission on the parent directory.
import { cpSync, existsSync, mkdirSync, writeFileSync, readdirSync, lstatSync, chmodSync, unlinkSync, rmdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function removeTree(path) {
  const info = lstatSync(path);
  if (info.isDirectory()) {
    // Writable on the way down, before touching anything inside: the
    // entries of a read-only directory cannot be unlinked otherwise.
    chmodSync(path, 0o755);
    for (const entry of readdirSync(path)) removeTree(join(path, entry));
    rmdirSync(path);
  } else {
    unlinkSync(path);
  }
}

function clearContents(dir) {
  for (const entry of readdirSync(dir)) removeTree(join(dir, entry));
}

mkdirSync(out, { recursive: true });
clearContents(out);
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes
// the bytes; the others refuse an entry the scorer would refuse (more than
// 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB
// of game files in all, or a path under game/ over 1000 bytes).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
