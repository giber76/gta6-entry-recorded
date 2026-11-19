// pedestrians.js — sidewalk walkers who stroll the city and scatter from
// speeding cars and gunshots. A walker hit by a fast car is knocked down,
// and that draws the law. An explosion sends every walker nearby running,
// and knocks flat anyone standing too close to the blast.

import { ROADS } from './city.js';
import { makeRng, clamp } from './util.js';
import { collideCircle } from './city.js';

const WALKERS = 14;
const SHIRTS = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf39c12, 0x9b59b6, 0x1abc9c, 0xecf0f1, 0xe67e22];

// Build one walker: a small low-poly figure standing on a sidewalk.
function buildWalker(THREE, dice, index) {
  const street = dice.pick(ROADS);
  const run = dice.range(-140, 140);
  const side = dice.chance(0.5) ? 7.5 : -7.5;
  const along = dice.chance(0.5) ? 'x' : 'z';
  const x = along === 'x' ? run : street + side;
  const z = along === 'x' ? street + side : run;
  const group = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: SHIRTS[index % SHIRTS.length] });
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98d64 });
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 0.95, 8), shirt);
  torso.position.y = 0.95;
  torso.castShadow = true;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), skin);
  head.position.y = 1.65;
  group.add(head);
  const legL = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.13, 0.6, 6),
    new THREE.MeshLambertMaterial({ color: 0x333a44 })
  );
  legL.position.set(-0.14, 0.3, 0);
  group.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.14;
  group.add(legR);
  group.position.set(x, 0, z);
  return {
    group,
    body: torso,
    legL,
    legR,
    pos: group.position,
    axis: along,
    dir: dice.chance(0.5) ? 1 : -1,
    speed: dice.range(1.2, 2.2),
    phase: dice.range(0, 6),
    down: 0,
    flee: 0,
    fleeX: 0,
    fleeZ: 0,
  };
}

export function spawnPedestrians(G) {
  const THREE = window.THREE;
  const dice = makeRng(4242);
  G.peds = [];
  for (let i = 0; i < WALKERS; i++) {
    const walker = buildWalker(THREE, dice, i);
    G.scene.add(walker.group);
    G.peds.push(walker);
  }
  return G.peds;
}

export function scatterPeds(G, x, z, radius) {
  for (const walker of G.peds) {
    const dx = walker.pos.x - x;
    const dz = walker.pos.z - z;
    const d = Math.hypot(dx, dz);
    if (d < radius && d > 0.01) {
      walker.flee = 3;
      walker.fleeX = dx / d;
      walker.fleeZ = dz / d;
    }
  }
}

// An explosion nearby: walkers flee hard, and anyone standing within
// six units of the blast is knocked flat by it.
export function fleeFromBlast(G, x, z) {
  scatterPeds(G, x, z, 35);
  for (const walker of G.peds) {
    const d = Math.hypot(walker.pos.x - x, walker.pos.z - z);
    if (d < 6 && walker.down <= 0) {
      walker.down = 3;
      walker.group.rotation.x = -Math.PI / 2;
    }
  }
}

// Which way this walker is walking right now: fleeing (from a car or a
// shot) or strolling along its road. Returns [mx, mz, speed].
function walkDirection(G, walker) {
  if (walker.flee > 0) return [walker.fleeX, walker.fleeZ, 6.5];
  const p = G.player;
  if (p.inCar && p.car && Math.abs(p.car.speed) > 12) {
    const d = Math.hypot(walker.pos.x - p.car.pos.x, walker.pos.z - p.car.pos.z);
    if (d < 11 && d > 0.01) {
      walker.flee = 2.5;
      walker.fleeX = (walker.pos.x - p.car.pos.x) / d;
      walker.fleeZ = (walker.pos.z - p.car.pos.z) / d;
      return [walker.fleeX, walker.fleeZ, 6.5];
    }
  }
  if (walker.axis === 'x') return [walker.dir, 0, walker.speed];
  return [0, walker.dir, walker.speed];
}

// A fast player car hitting a walker knocks them down and draws the law.
function carHitsWalker(G, walker) {
  const p = G.player;
  if (!p.inCar || !p.car || Math.abs(p.car.speed) <= 5) return;
  const d = Math.hypot(walker.pos.x - p.car.pos.x, walker.pos.z - p.car.pos.z);
  if (d >= 2.4) return;
  walker.down = 4;
  walker.group.rotation.x = -Math.PI / 2;
  if (G.onPedHit) G.onPedHit(walker);
}

// A speeding traffic car can hit Marlo on foot (once per cooldown).
function trafficHitsPlayer(G) {
  const p = G.player;
  if (p.inCar || p.health <= 0) return;
  if ((G.trafficHitAt ?? 0) + 1.2 >= (G.elapsed ?? 0)) return;
  for (const car of G.trafficCars || []) {
    const cd = Math.hypot(car.pos.x - p.pos.x, car.pos.z - p.pos.z);
    if (cd < 2.2 && Math.abs(car.traffic.speed) > 6) {
      G.trafficHitAt = G.elapsed ?? 0;
      if (G.onPlayerHitByTraffic) G.onPlayerHitByTraffic(car);
      return;
    }
  }
}

function stepWalker(G, walker, dt) {
  // Knocked down: lie there until the timer runs out.
  if (walker.down > 0) {
    walker.down -= dt;
    walker.group.rotation.x = walker.down > 0 ? -Math.PI / 2 : 0;
    return;
  }
  if (walker.flee > 0) walker.flee -= dt;
  const [mx, mz, speed] = walkDirection(G, walker);
  const nx = walker.pos.x + mx * speed * dt;
  const nz = walker.pos.z + mz * speed * dt;
  const fixed = collideCircle(G, nx, nz, 0.5);
  walker.pos.x = fixed.x;
  walker.pos.z = fixed.z;
  if (fixed.hit && walker.flee <= 0) walker.dir *= -1;
  // Turn around at the city edge or at random, so walkers keep strolling.
  if (Math.abs(walker.pos.x) > 150 || Math.abs(walker.pos.z) > 150) walker.dir *= -1;
  if (Math.random() < dt * 0.02) walker.dir *= -1;
  walker.phase += dt * speed * 3;
  const swing = Math.sin(walker.phase) * 0.45;
  walker.legL.rotation.x = swing;
  walker.legR.rotation.x = -swing;
  walker.group.rotation.y = Math.atan2(mx, mz);
  carHitsWalker(G, walker);
  trafficHitsPlayer(G);
}

export function updatePedestrians(G, dt) {
  for (const walker of G.peds) stepWalker(G, walker, dt);
}
