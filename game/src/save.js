// save.js — localStorage save/load for Solara Bay: cash, mission, position, health.

const SAVE_KEY = 'solara-bay-save-v1';

export function saveGame(G) {
  try {
    const p = G.player;
    const data = {
      version: 1,
      cash: p.cash,
      mission: G.mission.index,
      x: p.pos.x,
      z: p.pos.z,
      health: p.health,
      hasPistol: p.hasPistol,
      savedAt: Date.now(),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (err) {
    return false;
  }
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data.version !== 1) return null;
    return data;
  } catch (err) {
    return null;
  }
}

export function hasSave() {
  return loadSave() !== null;
}

export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch (err) {
    // Storage unavailable: nothing to clear.
  }
}
