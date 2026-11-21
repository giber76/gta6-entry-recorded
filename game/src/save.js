// save.js — localStorage save for Solara Bay. One key, one JSON blob:
// the story progress, cash, and where Marlo is. Written on mission
// completion, on winning, and when free roam starts.
export const SAVE_KEY = 'solara-bay-save-v1';

export function writeSave(data) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ ...data, savedAt: Date.now() }));
    return true;
  } catch (e) {
    return false;
  }
}

export function readSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}
