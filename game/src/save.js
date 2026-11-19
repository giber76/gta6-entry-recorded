// save.js — localStorage save/load for Solara Bay.
//
// One key, one version. What is saved: cash, the mission Marlo is on,
// his position, his health, whether he has the pistol, the radio station
// and the minimap zoom. Anything else (wanted level, enemies, cars) is
// rebuilt fresh on load.

const SAVE_KEY = 'solara-bay-save-v1';
const SAVE_VERSION = 1;

function readStorage() {
  try {
    return localStorage.getItem(SAVE_KEY);
  } catch (err) {
    return null;
  }
}

function writeStorage(text) {
  try {
    localStorage.setItem(SAVE_KEY, text);
    return true;
  } catch (err) {
    return false;
  }
}

export function saveGame(G) {
  const p = G.player;
  const data = {
    version: SAVE_VERSION,
    cash: p.cash,
    mission: G.mission.index,
    x: p.pos.x,
    z: p.pos.z,
    health: p.health,
    hasPistol: p.hasPistol,
    radioStation: G.audio ? G.audio.radioIndex : -1,
    mapZoom: G.mapZoom ?? 1,
    savedAt: Date.now(),
  };
  return writeStorage(JSON.stringify(data));
}

export function loadSave() {
  const raw = readStorage();
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
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch (err) {
    // Storage unavailable: nothing to clear.
  }
}
