// main.ts — Solara Bay entrypoint for the make.fun gta6-01 bounty.
// Boots the game into the #game-canvas element. The game itself lives in
// game/src/ as plain ES modules; this file is the thin typed entry that
// the kit loads. It only boots when the canvas is present, so importing
// it in a headless check never throws.

import { bootGame } from './game/src/main.js';

function start(): void {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
  if (!canvas) return;
  bootGame(canvas);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start);
} else {
  start();
}

export { start };
