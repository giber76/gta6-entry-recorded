// Solara Bay — entry program for gta6-01 (Node 22, standard library only).
// Copies game/ and screenshots/ from beside this file to /output and writes
// /output/dossier.json with the vendored make.fun library.
//
// The grader runs this program with /output as a bind mount, so it must never
// remove the output directory itself: rmdir on a mount point fails EBUSY.
// It clears only the CONTENTS of /output, chmod-ing each directory to 0755
// on the way down first (cpSync preserves read-only source modes, and
// unlinking needs write permission on the parent directory — without that
// chmod, a second run fails EACCES on files copied from a read-only tree).

import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Clear only the contents of a directory, never the directory itself.
// Each subdirectory is chmod-ed to 0755 BEFORE recursing into it, so the
// entries inside it can be removed on this run and on later runs.
function clearContents(dir: string): void {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const st = statSync(path);
    if (st.isDirectory()) {
      chmodSync(path, 0o755);
      clearContents(path);
      rmSync(path, { recursive: true, force: true });
    } else {
      rmSync(path, { force: true });
    }
  }
}

mkdirSync(out, { recursive: true });
clearContents(out);
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the
// bytes; the others refuse an entry the scorer would refuse (more than 4
// screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of
// game files, in all, or a path under game/ over 1000 bytes).
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
