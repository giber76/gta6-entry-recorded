// debug.js — window.__solara hooks used ONLY by automated play-tests and
// the screenshot run to stage scenes. They change nothing in normal play:
// every function here just calls the same code the buttons and keys call.

import { setWanted } from './police.js';
import { startMission } from './missions.js';

// Round to one decimal place, for the snapshot's numeric fields.
function round1(v) {
  return Math.round(v * 10) / 10;
}

function nearestGap(list, p) {
  if (!list.length) return null;
  return round1(Math.min(...list.map((u) => Math.hypot(u.pos.x - p.pos.x, u.pos.z - p.pos.z))));
}

// The moving parts of the snapshot: position, speed, counts, distances.
function snapshotDynamic(G, p) {
  return {
    x: round1(p.pos.x),
    z: round1(p.pos.z),
    speedKmh: Math.round((p.inCar && p.car ? Math.abs(p.car.speed) : p.speed) * 3.6),
    enemies: G.enemies.filter((e) => !e.dead).length,
    policeCars: G.policeCars.length,
    officers: G.officers.length,
    wantedTimer: round1(G.wantedTimer ?? 0),
    nearestPolice: nearestGap(G.policeCars, p),
    nearestOfficer: nearestGap(G.officers, p),
    carHealth: p.inCar && p.car ? Math.round(p.car.health) : null,
    elapsed: round1(G.elapsed ?? 0),
  };
}

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
        inCar: p.inCar,
        weapon: p.weapon,
        hasPistol: p.hasPistol,
        ...snapshotDynamic(G, p),
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
      const hasHeading = heading !== undefined;
      if (p.inCar && p.car) {
        p.car.pos.x = x;
        p.car.pos.z = z;
        if (hasHeading) {
          p.car.heading = heading;
          p.car.group.rotation.y = heading;
        }
      }
      p.pos.x = x;
      p.pos.z = z;
      p.group.position.set(x, 0, z);
      if (hasHeading) {
        p.yaw = heading;
        p.group.rotation.y = heading;
        G.camYaw = heading;
      }
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
      if (i >= 0 && i < 6) startMission(G, i);
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
      const alive = G.enemies.filter((e) => !e.dead);
      if (alive.length === 0) return api.state();
      const mark = alive.reduce((best, e) => {
        const gap = Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z);
        const bestGap = Math.hypot(best.pos.x - p.pos.x, best.pos.z - p.pos.z);
        return gap < bestGap ? e : best;
      });
      const yaw = Math.atan2(mark.pos.x - p.pos.x, mark.pos.z - p.pos.z);
      p.yaw = yaw;
      p.group.rotation.y = yaw;
      // Point the camera at the enemy too.
      G.camYaw = yaw;
      return api.state();
    },

    // Point the camera at the nearest parked or traffic car, so a
    // drive-by shot has something to hit. Traffic can nudge the car,
    // so re-aim before every shot.
    aimAtNearestCar() {
      const p = G.player;
      const cars = [...(G.parkedCars || []), ...(G.trafficCars || [])];
      let best = null;
      let bestD = Infinity;
      for (const car of cars) {
        if (car.wrecked || car.dead) continue;
        const d = Math.hypot(car.pos.x - p.pos.x, car.pos.z - p.pos.z);
        if (d < bestD) {
          bestD = d;
          best = car;
        }
      }
      if (!best) return api.state();
      const yaw = Math.atan2(best.pos.x - p.pos.x, best.pos.z - p.pos.z);
      p.yaw = yaw;
      p.group.rotation.y = yaw;
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
