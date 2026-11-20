// debug.js — the window.__solara debug API for Solara Bay.
// This is the automated play-test's only handle on the game, so the
// contract here is exact: every key, every behaviour, every edge case.

import { STATIONS } from './audio.js';
import { headingTo } from './util.js';

export function createDebug(world) {
  const api = {};

  api.state = function () {
    const p = world.player;
    const inCar = p.inCar && !!p.car;
    return {
      state: world.state,
      mission: world.mission,
      cash: world.cash,
      wanted: world.wanted,
      health: Math.round(p.health),
      inCar,
      stage: world.stage,
      carHealth: inCar ? Math.round(p.car.health) : null,
      speedKmh: Math.round((inCar ? Math.abs(p.car.speed) : Math.abs(p.speed || 0)) * 3.6),
      x: Math.round(p.x * 100) / 100,
      z: Math.round(p.z * 100) / 100,
      radio: world.radio.station < 0 ? 'OFF' : STATIONS[world.radio.station],
      mapZoom: world.mapZoom,
      enemies: world.combat.aliveCount(),
      parkedCars: world.traffic.parkedAlive(),
      hasPistol: !!p.hasPistol,
      weapon: p.weapon || null,
      elapsed: Math.round(world.elapsed * 100) / 100,
    };
  };

  // Move Marlo (and his car, if he is in one) to (x, z), facing heading.
  api.teleport = function (x, z, heading) {
    const p = world.player;
    const h = heading === undefined ? p.heading : heading;
    if (p.inCar && p.car) {
      p.car.x = x;
      p.car.z = z;
      p.car.heading = h;
      p.car.speed = 0;
      p.car.syncMesh();
    }
    p.place(x, z, h);
    if (p.inCar && p.car) {
      p.x = p.car.x;
      p.z = p.car.z;
    }
    world.cameraSnap = true;
  };

  api.damageCar = function (n) {
    const p = world.player;
    if (p.inCar && p.car) p.car.damage(n, 'debug');
  };

  api.repairCar = function () {
    const p = world.player;
    if (p.inCar && p.car) p.car.repair();
  };

  api.givePistol = function () {
    world.player.hasPistol = true;
    world.player.weapon = 'pistol';
  };

  api.faceNearestParkedCar = function () {
    const p = world.player;
    let best = null;
    let bestD = Infinity;
    for (const car of world.traffic.parked) {
      if (car.wrecked) continue;
      const dx = car.x - p.x;
      const dz = car.z - p.z;
      const d = dx * dx + dz * dz;
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    if (!best) return;
    const h = headingTo(p.x, p.z, best.x, best.z);
    p.heading = h;
    if (p.inCar && p.car) p.car.heading = h;
    p.syncMesh();
    world.cameraSnap = true;
  };

  api.faceNearestEnemy = function () {
    const p = world.player;
    let best = null;
    let bestD = Infinity;
    for (const v of world.vipers) {
      if (!v.alive) continue;
      const dx = v.x - p.x;
      const dz = v.z - p.z;
      const d = dx * dx + dz * dz;
      if (d < bestD) {
        bestD = d;
        best = v;
      }
    }
    if (!best) return;
    const h = headingTo(p.x, p.z, best.x, best.z);
    p.heading = h;
    if (p.inCar && p.car) p.car.heading = h;
    p.syncMesh();
    world.cameraSnap = true;
  };

  api.click = function () {
    world.combat.fire();
  };

  api.heal = function () {
    world.player.heal();
  };

  window.__solara = api;
  world.debug = api;
  return api;
}
