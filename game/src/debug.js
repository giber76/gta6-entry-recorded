// debug.js — window.__solara, the exact contract the play-test drives.
// state(), teleport(), damageCar(), repairCar(), givePistol(),
// faceNearestParkedCar(), faceNearestEnemy(), click(), heal().
import * as THREE from 'three';
import { firePistol } from './combat.js';
import { nearestParkedCar } from './traffic.js';
import { nearestEnemy } from './combat.js';
import { damageCarObj, repairCarObj } from './vehicles.js';
import { headingVec } from './util.js';

export function initDebug(G) {
  const api = {
    state() {
      const p = G.player;
      return {
        state: G.state,
        mission: G.mission,
        cash: G.cash,
        wanted: G.wanted,
        health: Math.round(p.health),
        inCar: p.inCar,
        stage: G.stage,
        carHealth: p.inCar && p.car ? Math.round(p.car.health) : null,
        speedKmh: Math.round(Math.abs(p.speed) * 3.6),
        x: Math.round(p.x * 10) / 10,
        z: Math.round(p.z * 10) / 10,
        radio: G.radio,
        mapZoom: G.mapZoom,
        enemies: enemiesAliveCount(G),
        parkedCars: parkedCount(G),
        hasPistol: p.hasPistol,
        weapon: p.weapon,
        elapsed: Math.round(G.elapsed * 10) / 10,
      };
    },
    teleport(x, z, heading) {
      const p = G.player;
      p.x = x;
      p.z = z;
      p.heading = heading === undefined ? p.heading : heading;
      if (p.inCar && p.car) {
        p.car.x = x;
        p.car.z = z;
        p.car.heading = p.heading;
        p.car.mesh.position.set(x, 0, z);
        p.car.mesh.rotation.y = p.heading;
      }
      p.pos.set(p.x, 0, p.z);
      p.mesh.position.set(p.x, 0, p.z);
      p.mesh.rotation.y = p.heading;
      // Snap the chase camera so the next frame (and any immediate
      // faceNearest + click) uses the new position.
      G.cameraSnap = true;
    },
    damageCar(n) {
      if (G.player.car) damageCarObj(G, G.player.car, n);
    },
    repairCar() {
      if (G.player.car) repairCarObj(G, G.player.car);
    },
    givePistol() {
      G.player.hasPistol = true;
      G.player.weapon = 'pistol';
    },
    faceNearestParkedCar() {
      const { car } = nearestParkedCar(G, G.player.x, G.player.z);
      if (!car) return;
      aimAt(G, car.x, 0.9, car.z);
    },
    faceNearestEnemy() {
      const { enemy } = nearestEnemy(G, G.player.x, G.player.z);
      if (!enemy) return;
      aimAt(G, enemy.x, 1.1, enemy.z);
    },
    click() {
      firePistol(G);
    },
    heal() {
      G.player.health = 100;
    },
  };
  window.__solara = api;
  return api;
}

function enemiesAliveCount(G) {
  let n = 0;
  for (const e of G.enemies) if (!e.dead) n++;
  return n;
}

function parkedCount(G) {
  let n = 0;
  for (const c of G.parked) {
    if (!c.wrecked && G.player.car !== c) n++;
  }
  return n;
}

// Turn Marlo (and the chase camera) to face a point, and lock the aim on it
// briefly so a following click() fires exactly there.
function aimAt(G, x, y, z) {
  const p = G.player;
  const dx = x - p.x;
  const dz = z - p.z;
  p.heading = Math.atan2(dx, dz);
  p.mesh.rotation.y = p.heading;
  if (p.inCar && p.car) {
    // The car keeps its heading; only the camera turns to the target.
  }
  G.aimTarget = new THREE.Vector3(x, y, z);
  G.aimLockedUntil = G.elapsed + 1.5;
  // Snap the camera to look at the target right now, from its current spot.
  G.camera.lookAt(G.aimTarget);
}
