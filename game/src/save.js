// save.js — localStorage saves for Solara Bay.
// One key, one JSON blob: mission progress, cash, wanted, Marlo's spot.
// Written on every mission completion and on the win, so a save is always
// present after the player finishes the story.

export const SAVE_KEY = 'solara-bay-save-v1';

export function createSave(world) {
  const save = {};

  save.write = function () {
    try {
      const data = {
        mission: world.mission,
        cash: world.cash,
        wanted: world.wanted,
        health: world.player.health,
        x: world.player.x,
        z: world.player.z,
        hasPistol: world.player.hasPistol,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch (err) {
      /* storage may be unavailable; the game must not care */
    }
  };

  save.read = function () {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  };

  save.clear = function () {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch (err) {
      /* ignore */
    }
  };

  world.save = save;
  return save;
}
