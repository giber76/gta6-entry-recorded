// save.js — Solara Bay's save file in localStorage.
const KEY = 'solara-bay-save-v1';

export class Save {
  write(game) {
    try {
      const data = {
        mission: game.missions.mission,
        cash: game.missions.cash,
        x: Math.round(game.player.x),
        z: Math.round(game.player.z),
        health: game.player.health,
        savedAt: Date.now(),
      };
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (e) {}
  }

  read() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }
}
