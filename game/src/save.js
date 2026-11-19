// save.js — localStorage save/load for Solara Bay.
//
// One key, one version. What is saved: cash, the mission Marlo is on,
// his position, his health, whether he has the pistol, and which radio
// station he was listening to. Wanted level, enemies and cars are rebuilt
// fresh on load.

const SAVE_KEY = 'solara-bay-save-v1';
const SAVE_VERSION = 1;

// Safe localStorage access: returns null/false instead of throwing
// when storage is unavailable (private mode, disabled cookies).
const store = {
  read() {
    try {
      return localStorage.getItem(SAVE_KEY);
    } catch (err) {
      return null;
    }
  },
  write(text) {
    try {
      localStorage.setItem(SAVE_KEY, text);
      return true;
    } catch (err) {
      return false;
    }
  },
  clear() {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch (err) {
      // Storage unavailable: nothing to clear.
    }
  },
};

export function saveGame(game) {
  const p = game.player;
  const data = {
    version: SAVE_VERSION,
    cash: p.cash,
    mission: game.mission.index,
    x: p.pos.x,
    z: p.pos.z,
    health: p.health,
    hasPistol: p.hasPistol,
    station: game.audio ? game.audio.stationIndex() : 0,
    // The minimap zoom and the radio station are remembered too, so a
    // continued game opens exactly as Marlo left it.
    minimapZoom: game.minimapZoom ?? 1,
    savedAt: Date.now(),
  };
  return store.write(JSON.stringify(data));
}

export function loadSave() {
  const raw = store.read();
  if (raw === null) return null;
  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    return null;
  }
  if (data === null || typeof data !== 'object' || data.version !== SAVE_VERSION) return null;
  return data;
}

export function hasSave() {
  return loadSave() !== null;
}

export function clearSave() {
  store.clear();
}
