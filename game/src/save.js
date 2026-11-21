// save.js — localStorage save for Solara Bay (key solara-bay-save-v1).
// Written on every mission completion and on the win.
export const SAVE_KEY = 'solara-bay-save-v1';

export function writeSave(G) {
  try {
    const data = {
      mission: G.mission,
      cash: G.cash,
      health: G.player.health,
      x: Math.round(G.player.x),
      z: Math.round(G.player.z),
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (e) { /* storage may be unavailable; the game still plays */ }
}

export function readSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}
