// pedestrians.js — sidewalk walkers who stroll the city and scatter from
// speeding cars and gunshots. A walker hit by a fast car is knocked down.

import { ROADS } from './city.js';
import { makeRng, clamp } from './util.js';
import { collideCircle } from './city.js';

const PED_COUNT = 14;
const SHIRTS = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf39c12, 0x9b59b6, 0x1abc9c, 0xecf0f1, 0xe67e22];

export function spawnPedestrians(G) {
  const THREE = window.THREE;
  const rng = makeRng(4242);
  G.peds = [];
  for (let i = 0; i < PED_COUNT; i++) {
    const road = rng.pick(ROADS);
    const along = rng.range(-140, 140);
    const side = rng.chance(0.5) ? 7.5 : -7.5;
    const axis = rng.chance(0.5) ? 'x' : 'z';
    const x = axis === 'x' ? along : road + side;
    const z = axis === 'x' ? road + side : along;
    const group = new THREE.Group();
    const shirt = new THREE.MeshLambertMaterial({ color: SHIRTS[i % SHIRTS.length] });
    const skin = new THREE.MeshLambertMaterial({ color: 0xc98d64 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 0.95, 8), shirt);
    body.position.y = 0.95;
    body.castShadow = true;
    group.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), skin);
    head.position.y = 1.65;
    group.add(head);
    const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.6, 6), new THREE.MeshLambertMaterial({ color: 0x333a44 }));
    legL.position.set(-0.14, 0.3, 0);
    group.add(legL);
    const legR = legL.clone();
    legR.position.x = 0.14;
    group.add(legR);
    group.position.set(x, 0, z);
    G.scene.add(group);
    G.peds.push({
      group,
      body,
      legL,
      legR,
      pos: group.position,
      axis,
      dir: rng.chance(0.5) ? 1 : -1,
      speed: rng.range(1.2, 2.2),
      phase: rng.range(0, 6),
      down: 0,
      flee: 0,
      fleeX: 0,
      fleeZ: 0,
    });
  }
  return G.peds;
}

export function scatterPeds(G, x, z, radius) {
  for (const ped of G.peds) {
    const dx = ped.pos.x - x;
    const dz = ped.pos.z - z;
    const d = Math.hypot(dx, dz);
    if (d < radius && d > 0.01) {
      ped.flee = 3;
      ped.fleeX = dx / d;
      ped.fleeZ = dz / d;
    }
  }
}

export function updatePedestrians(G, dt) {
  const p = G.player;
  for (const ped of G.peds) {
    if (ped.down > 0) {
      ped.down -= dt;
      ped.group.rotation.x = ped.down > 0 ? -Math.PI / 2 : 0;
      if (ped.down <= 0) ped.group.rotation.x = 0;
      continue;
    }
    // Scatter from a fast player car or a nearby gunshot.
    let speed = ped.speed;
    let mx = 0;
    let mz = 0;
    if (ped.flee > 0) {
      ped.flee -= dt;
      mx = ped.fleeX;
      mz = ped.fleeZ;
      speed = 6.5;
    } else {
      if (p.inCar && p.car && Math.abs(p.car.speed) > 12) {
        const d = Math.hypot(ped.pos.x - p.car.pos.x, ped.pos.z - p.car.pos.z);
        if (d < 11) {
          ped.flee = 2.5;
          ped.fleeX = (ped.pos.x - p.car.pos.x) / d;
          ped.fleeZ = (ped.pos.z - p.car.pos.z) / d;
        }
      }
      if (ped.axis === 'x') {
        mx = ped.dir;
        mz = 0;
      } else {
        mx = 0;
        mz = ped.dir;
      }
    }
    const nx = ped.pos.x + mx * speed * dt;
    const nz = ped.pos.z + mz * speed * dt;
    const fixed = collideCircle(G, nx, nz, 0.5);
    ped.pos.x = fixed.x;
    ped.pos.z = fixed.z;
    if (fixed.hit && ped.flee <= 0) {
      ped.dir *= -1;
    }
    // Turn around at the city edge or at random, so walkers keep strolling.
    if (Math.abs(ped.pos.x) > 150 || Math.abs(ped.pos.z) > 150) ped.dir *= -1;
    if (Math.random() < dt * 0.02) ped.dir *= -1;
    ped.phase += dt * speed * 3;
    const swing = Math.sin(ped.phase) * 0.45;
    ped.legL.rotation.x = swing;
    ped.legR.rotation.x = -swing;
    ped.group.rotation.y = Math.atan2(mx, mz);

    // A fast player car hitting a walker knocks them down and draws the law.
    if (p.inCar && p.car && Math.abs(p.car.speed) > 5) {
      const d = Math.hypot(ped.pos.x - p.car.pos.x, ped.pos.z - p.car.pos.z);
      if (d < 2.4) {
        ped.down = 4;
        ped.group.rotation.x = -Math.PI / 2;
        if (G.onPedHit) G.onPedHit(ped);
      }
    }
    // A speeding traffic car can hit the player on foot (once per cooldown).
    if (!p.inCar && p.health > 0 && (G.trafficHitAt ?? 0) + 1.2 < (G.elapsed ?? 0)) {
      for (const car of G.trafficCars || []) {
        const cd = Math.hypot(car.pos.x - p.pos.x, car.pos.z - p.pos.z);
        if (cd < 2.2 && Math.abs(car.traffic.speed) > 6) {
          G.trafficHitAt = G.elapsed ?? 0;
          if (G.onPlayerHitByTraffic) G.onPlayerHitByTraffic(car);
          break;
        }
      }
    }
  }
}
