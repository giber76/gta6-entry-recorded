// debug.js — the window.__solara API the play-test drives.
// Exact contract: state(), teleport(), damageCar(), repairCar(),
// givePistol(), faceNearestParkedCar(), faceNearestEnemy(), click(), heal().
import { dist2 } from './util.js';

export function installDebug(game) {
  const p = game.player;
  const api = {
    state() {
      return {
        state: game.state,
        mission: game.missions.mission,
        cash: p.cash,
        wanted: game.wanted,
        health: Math.round(p.health),
        inCar: p.inCar,
        stage: game.missions.stage,
        carHealth: p.inCar && p.car ? Math.round(p.car.health) : null,
        speedKmh: Math.round((p.inCar && p.car ? p.car.speedKmh : 0) * 10) / 10,
        x: Math.round(p.x * 100) / 100,
        z: Math.round(p.z * 100) / 100,
        radio: game.audio.stationName(),
        mapZoom: game.minimap.zoom,
        enemies: game.vipers.filter((v) => v.alive).length,
        parkedCars: game.traffic.parkedCount,
        hasPistol: p.hasPistol,
        weapon: p.weapon,
        elapsed: Math.round(game.elapsed * 100) / 100,
      };
    },

    teleport(x, z, heading) {
      p.teleport(x, z, heading);
      game.snapCamera();
    },

    damageCar(n) {
      if (p.inCar && p.car) {
        const wrecked = p.car.damage(n);
        if (wrecked) game.onCarWrecked(p.car);
      }
    },

    repairCar() {
      if (p.inCar && p.car) p.car.repair();
    },

    givePistol() {
      p.givePistol();
    },

    faceNearestParkedCar() {
      let best = null;
      let bestD = Infinity;
      for (const c of game.traffic.parked) {
        if (c.wrecked) continue;
        const d = dist2(p.x, p.z, c.x, c.z);
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      if (best) {
        p.heading = Math.atan2(best.x - p.x, best.z - p.z);
        game.snapCamera();
      }
    },

    faceNearestEnemy() {
      let best = null;
      let bestD = Infinity;
      for (const v of game.vipers) {
        if (!v.alive) continue;
        const d = dist2(p.x, p.z, v.x, v.z);
        if (d < bestD) {
          bestD = d;
          best = v;
        }
      }
      if (best) {
        p.heading = Math.atan2(best.x - p.x, best.z - p.z);
        game.snapCamera();
      }
    },

    click() {
      game.firePistol();
    },

    heal() {
      p.heal();
    },
  };
  window.__solara = api;
  return api;
}
