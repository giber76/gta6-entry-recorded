// debug.js — window.__solara hooks used ONLY by automated play-tests and
// the screenshot run to stage scenes. They change nothing in normal play:
// every function here just calls the same code the buttons and keys call.
// The screenshot run stages chase / driving / on-foot / combat through these.

import { setWanted } from './police.js';
import { startMission } from './missions.js';
import { damageCar, repairCar } from './vehicles.js';

// Round to one decimal place, for the snapshot's numeric fields.
function round1(v) {
  return Math.round(v * 10) / 10;
}

// Nearest entry of a list to the player, or null when the list is empty.
function nearestTo(list, p) {
  if (!list.length) return null;
  let best = list[0];
  let bestD = Math.hypot(best.pos.x - p.pos.x, best.pos.z - p.pos.z);
  for (const u of list.slice(1)) {
    const d = Math.hypot(u.pos.x - p.pos.x, u.pos.z - p.pos.z);
    if (d < bestD) {
      bestD = d;
      best = u;
    }
  }
  return best;
}

function nearestGap(list, p) {
  const best = nearestTo(list, p);
  if (!best) return null;
  return round1(Math.hypot(best.pos.x - p.pos.x, best.pos.z - p.pos.z));
}

// The moving parts of the snapshot: position, speed, counts, distances.
function snapshotMoving(game, p) {
  return {
    x: round1(p.pos.x),
    z: round1(p.pos.z),
    speedKmh: Math.round((p.inCar && p.car ? Math.abs(p.car.speed) : p.speed) * 3.6),
    enemies: game.enemies.filter((e) => !e.dead).length,
    policeCars: game.policeCars.length,
    officers: game.officers.length,
    wantedTimer: round1(game.wantedTimer ?? 0),
    nearestPolice: nearestGap(game.policeCars, p),
    nearestOfficer: nearestGap(game.officers, p),
    carHealth: p.inCar && p.car ? Math.round(p.car.health) : null,
    // Parked cars still standing (not wrecked) — the drive-by test
    // needs a live target count.
    parkedCars: (game.parkedCars || []).filter((c) => !c.wrecked).length,
    // Running tally of Vipers Marlo has taken down this session.
    kills: game.kills || 0,
    elapsed: round1(game.elapsed ?? 0),
  };
}

// Point Marlo (and the camera) at a target position.
function facePoint(game, p, x, z) {
  const yaw = Math.atan2(x - p.pos.x, z - p.pos.z);
  p.yaw = yaw;
  p.group.rotation.y = yaw;
  game.camYaw = yaw;
}

export function initDebug(game) {
  const api = {
    // A JSON-safe snapshot of the game state.
    state() {
      const p = game.player;
      return {
        state: game.state,
        mission: game.mission.index,
        missionName: p && game.mission ? game.mission.objective : '',
        stage: game.mission.stage,
        cash: p.cash,
        health: p.health,
        wanted: game.wanted,
        inCar: p.inCar,
        weapon: p.weapon,
        hasPistol: p.hasPistol,
        radio: game.audio ? game.audio.radioLabel() : 'RADIO OFF',
        mapZoom: game.minimapZoom ?? 1,
        ...snapshotMoving(game, p),
      };
    },

    // Start a new game from the menu (as the New Game button does).
    start() {
      if (game.startNewGame) game.startNewGame();
      return api.state();
    },

    // Teleport Marlo (on foot, or with the car when driving).
    // Optional heading (radians) points the car / Marlo where you want.
    teleport(x, z, heading) {
      const p = game.player;
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
      if (hasHeading) facePoint(game, p, x + Math.sin(heading), z + Math.cos(heading));
      return api.state();
    },

    // Put Marlo next to the current mission marker.
    teleportToMarker() {
      const t = game.mission.target;
      if (!t) return api.state();
      return api.teleport(t.x - 4, t.z + 4);
    },

    setWanted(n) {
      setWanted(game, n);
      return api.state();
    },

    setMission(i) {
      if (i >= 0 && i < 6) startMission(game, i);
      return api.state();
    },

    // Damage the nearest parked car (play-test hook for the car damage
    // system). Returns the car's health after the hit, or null.
    damageNearestCar(amount) {
      const cars = (game.parkedCars || []).filter((c) => !c.wrecked && !c.dead);
      const car = nearestTo(cars, game.player);
      if (!car) return null;
      damageCar(game, car, amount);
      return car.health;
    },

    // Wreck the nearest parked car outright (play-test hook for the
    // explosion, ejection and respawn paths).
    wreckNearestCar() {
      const cars = (game.parkedCars || []).filter((c) => !c.wrecked && !c.dead);
      const car = nearestTo(cars, game.player);
      if (!car) return null;
      damageCar(game, car, 999);
      return car.wrecked;
    },

    // Damage the car Marlo is driving, or the nearest non-wrecked
    // police / traffic / parked car when he is on foot. Returns the
    // full state (the test reads carHealth from it).
    damageCar(amount) {
      const p = game.player;
      let car = null;
      if (p.inCar && p.car) {
        car = p.car;
      } else {
        const pool = [...(game.policeCars || []), ...(game.trafficCars || []), ...(game.parkedCars || [])]
          .filter((c) => !c.wrecked && !c.dead);
        car = nearestTo(pool, p);
      }
      if (car) damageCar(game, car, amount);
      return api.state();
    },

    // Repair the car Marlo is driving back to full health.
    repairCar() {
      const p = game.player;
      if (p.inCar && p.car) repairCar(game, p.car);
      return api.state();
    },

    // Point the camera at the nearest parked car that is not Marlo's
    // own and not wrecked, so a drive-by shot has a parked target.
    faceNearestParkedCar() {
      const p = game.player;
      const cars = (game.parkedCars || []).filter((c) => !c.wrecked && !c.dead && c !== p.car);
      const mark = nearestTo(cars, p);
      if (!mark) return api.state();
      facePoint(game, p, mark.pos.x, mark.pos.z);
      return api.state();
    },

    givePistol() {
      game.player.hasPistol = true;
      game.player.weapon = 'pistol';
      return api.state();
    },

    addCash(n) {
      game.player.cash += n;
      return api.state();
    },

    heal() {
      game.player.health = 100;
      return api.state();
    },

    // Face the nearest living enemy so the pistol raycast can hit it.
    faceNearestEnemy() {
      const p = game.player;
      const alive = game.enemies.filter((e) => !e.dead);
      const mark = nearestTo(alive, p);
      if (!mark) return api.state();
      facePoint(game, p, mark.pos.x, mark.pos.z);
      return api.state();
    },

    // Point the camera at the nearest parked or traffic car, so a
    // drive-by shot has something to hit. Traffic can nudge the car,
    // so re-aim before every shot.
    aimAtNearestCar() {
      const p = game.player;
      const pool = [...(game.parkedCars || []), ...(game.trafficCars || [])]
        .filter((c) => !c.wrecked && !c.dead);
      const best = nearestTo(pool, p);
      if (!best) return api.state();
      facePoint(game, p, best.pos.x, best.pos.z);
      return api.state();
    },

    // Dispatch a real keyboard event, as if the key had been pressed.
    key(code, down) {
      const ev = new KeyboardEvent(down ? 'keydown' : 'keyup', { code, bubbles: true });
      window.dispatchEvent(ev);
      return api.state();
    },

    click() {
      if (game.onClick) game.onClick();
      return api.state();
    },

    // How far the current objective is, in metres.
    objectiveDistance() {
      const t = game.mission.target;
      if (!t) return null;
      return Math.round(Math.hypot(game.player.pos.x - t.x, game.player.pos.z - t.z));
    },
  };
  window.__solara = api;
  game.debug = api;
  return api;
}
