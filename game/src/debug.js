// debug.js — window.__solara hooks used ONLY by automated play-tests and the
// screenshot run to stage scenes. They change nothing in normal play.

import { setWanted } from './police.js';
import { startMission } from './missions.js';

export function initDebug(G) {
  const api = {
    // A JSON-safe snapshot of the game state.
    state() {
      const p = G.player;
      return {
        state: G.state,
        mission: G.mission.index,
        missionName: p && G.mission ? G.mission.objective : '',
        stage: G.mission.stage,
        cash: p.cash,
        health: p.health,
        wanted: G.wanted,
        x: Math.round(p.pos.x * 10) / 10,
        z: Math.round(p.pos.z * 10) / 10,
        inCar: p.inCar,
        weapon: p.weapon,
        hasPistol: p.hasPistol,
        speedKmh: Math.round((p.inCar && p.car ? Math.abs(p.car.speed) : p.speed) * 3.6),
        enemies: G.enemies.filter((e) => !e.dead).length,
        policeCars: G.policeCars.length,
        officers: G.officers.length,
        wantedTimer: Math.round((G.wantedTimer ?? 0) * 10) / 10,
        nearestPolice: G.policeCars.length
          ? Math.round(Math.min(...G.policeCars.map((c) => Math.hypot(c.pos.x - p.pos.x, c.pos.z - p.pos.z))) * 10) / 10
          : null,
        nearestOfficer: G.officers.length
          ? Math.round(Math.min(...G.officers.map((o) => Math.hypot(o.pos.x - p.pos.x, o.pos.z - p.pos.z))) * 10) / 10
          : null,
        elapsed: Math.round((G.elapsed ?? 0) * 10) / 10,
      };
    },

    // Start a new game from the menu (as the New Game button does).
    start() {
      if (G.startNewGame) G.startNewGame();
      return api.state();
    },

    // Teleport Marlo (on foot, or with the car when driving).
    // Optional heading (radians) points the car / Marlo where you want.
    teleport(x, z, heading) {
      const p = G.player;
      if (p.inCar && p.car) {
        p.car.pos.x = x;
        p.car.pos.z = z;
        if (heading !== undefined) {
          p.car.heading = heading;
          p.car.group.rotation.y = heading;
        }
      }
      if (heading !== undefined) {
        p.yaw = heading;
        p.group.rotation.y = heading;
        G.camYaw = heading;
      }
      p.pos.x = x;
      p.pos.z = z;
      p.group.position.set(x, 0, z);
      return api.state();
    },

    // Put Marlo next to the current mission marker.
    teleportToMarker() {
      const t = G.mission.target;
      if (!t) return api.state();
      return api.teleport(t.x - 4, t.z + 4);
    },

    setWanted(n) {
      setWanted(G, n);
      return api.state();
    },

    setMission(i) {
      if (i >= 0 && i < 5) startMission(G, i);
      return api.state();
    },

    givePistol() {
      G.player.hasPistol = true;
      G.player.weapon = 'pistol';
      return api.state();
    },

    addCash(n) {
      G.player.cash += n;
      return api.state();
    },

    heal() {
      G.player.health = 100;
      return api.state();
    },

    // Face the nearest living enemy so the pistol raycast can hit it.
    faceNearestEnemy() {
      const p = G.player;
      let best = null;
      let bestD = Infinity;
      for (const e of G.enemies) {
        if (e.dead) continue;
        const d = Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z);
        if (d < bestD) {
          bestD = d;
          best = e;
        }
      }
      if (!best) return api.state();
      const yaw = Math.atan2(best.pos.x - p.pos.x, best.pos.z - p.pos.z);
      p.yaw = yaw;
      p.group.rotation.y = yaw;
      // Point the camera at the enemy too.
      G.camYaw = yaw;
      return api.state();
    },

    // Dispatch a real keyboard event, as if the key had been pressed.
    key(code, down) {
      const ev = new KeyboardEvent(down ? 'keydown' : 'keyup', { code, bubbles: true });
      window.dispatchEvent(ev);
      return api.state();
    },

    click() {
      if (G.onClick) G.onClick();
      return api.state();
    },

    // How far the current objective is, in metres.
    objectiveDistance() {
      const t = G.mission.target;
      if (!t) return null;
      return Math.round(Math.hypot(G.player.pos.x - t.x, G.player.pos.z - t.z));
    },
  };
  window.__solara = api;
  G.debug = api;
  return api;
}
