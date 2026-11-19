// pedestrians.js — sidewalk walkers who stroll the city and scatter from
// speeding cars and gunshots. A walker hit by a fast car is knocked down,
// and that draws the law. An explosion sends every walker nearby running,
// and a blast within 6 u knocks them flat for 3 s.

import { ROADS } from './city.js';
import { makeRng, clamp } from './util.js';
import { collideCircle } from './city.js';

const WALKERS = 14;
const SHIRTS = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf39c12, 0x9b59b6, 0x1abc9c, 0xecf0f1, 0xe67e22];

// Build one walker: a small low-poly figure standing on a sidewalk.
function buildWalker(THREE, rng, index) {
  const street = rng.pick(ROADS);
  const run = rng.range(-140, 140);
  const side = rng.chance(0.5) ? 7.5 : -7.5;
  const along = rng.chance(0.5) ? 'x' : 'z';
  const x = along === 'x' ? run : street + side;
  const z = along === 'x' ? street + side : run;
  const group = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: SHIRTS[index % SHIRTS.length] });
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98d64 });
  const pants = new THREE.MeshLambertMaterial({ color: 0x333a44 });
  const parts = [
    [new THREE.CylinderGeometry(0.32, 0.38, 0.95, 8), shirt, 0, 0.95, 0, true],
    [new THREE.SphereGeometry(0.26, 10, 8), skin, 0, 1.65, 0, false],
    [new THREE.CylinderGeometry(0.11, 0.13, 0.6, 6), pants, -0.14, 0.3, 0, false],
  ];
  const built = [];
  for (const [shape, mat, px, py, pz, shadow] of parts) {
    const piece = new THREE.Mesh(shape, mat);
    piece.position.set(px, py, pz);
    piece.castShadow = shadow;
    group.add(piece);
    built.push(piece);
  }
  const legR = built[2].clone();
  legR.position.x = 0.14;
  group.add(legR);
  group.position.set(x, 0, z);
  return {
    group,
    body: built[0],
    legL: built[2],
    legR,
    pos: group.position,
    axis: along,
    dir: rng.chance(0.5) ? 1 : -1,
    speed: rng.range(1.2, 2.2),
    phase: rng.range(0, 6),
    down: 0,
    flee: 0,
    fleeX: 0,
    fleeZ: 0,
  };
}

export function spawnPedestrians(game) {
  const THREE = window.THREE;
  const rng = makeRng(4242);
  game.peds = [];
  for (let i = 0; i < WALKERS; i++) {
    const walker = buildWalker(THREE, rng, i);
    game.scene.add(walker.group);
    game.peds.push(walker);
  }
  return game.peds;
}

// Send walkers within a radius running away from a point.
export function scatterPeds(game, x, z, radius) {
  for (const walker of game.peds) {
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
export function fleeFromBlast(game, x, z) {
  scatterPeds(game, x, z, 35);
  for (const walker of game.peds) {
    const d = Math.hypot(walker.pos.x - x, walker.pos.z - z);
    if (d < 6 && walker.down <= 0) {
      walker.down = 3;
      walker.group.rotation.x = -Math.PI / 2;
    }
    // Anyone who saw the blast panics: they run for a few seconds
    // even after the initial scatter, instead of calmly strolling on.
    if (d < 20 && walker.down <= 0) {
      walker.panic = 4;
      const away = Math.max(d, 0.01);
      walker.panicX = (walker.pos.x - x) / away;
      walker.panicZ = (walker.pos.z - z) / away;
    }
  }
}

// Which way this walker is walking right now: panicking (from a blast),
// fleeing (from a car or a shot) or strolling along its road.
// Returns [mx, mz, speed].
function walkDirection(game, walker) {
  if (walker.panic > 0) return [walker.panicX, walker.panicZ, 7.5];
  if (walker.flee > 0) return [walker.fleeX, walker.fleeZ, 6.5];
  const p = game.player;
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
function carHitsWalker(game, walker) {
  const p = game.player;
  if (!p.inCar || !p.car || Math.abs(p.car.speed) <= 5) return;
  const d = Math.hypot(walker.pos.x - p.car.pos.x, walker.pos.z - p.car.pos.z);
  if (d >= 2.4) return;
  walker.down = 4;
  walker.group.rotation.x = -Math.PI / 2;
  if (game.onPedHit) game.onPedHit(walker);
}

// A speeding traffic car can hit Marlo on foot (once per cooldown).
function trafficHitsPlayer(game) {
  const p = game.player;
  if (p.inCar || p.health <= 0) return;
  if ((game.trafficHitAt ?? 0) + 1.2 >= (game.elapsed ?? 0)) return;
  for (const car of game.trafficCars || []) {
    const cd = Math.hypot(car.pos.x - p.pos.x, car.pos.z - p.pos.z);
    if (cd < 2.2 && Math.abs(car.traffic.speed) > 6) {
      game.trafficHitAt = game.elapsed ?? 0;
      if (game.onPlayerHitByTraffic) game.onPlayerHitByTraffic(car);
      return;
    }
  }
}

function stepWalker(game, walker, dt) {
  // Knocked down: lie there until the timer runs out.
  if (walker.down > 0) {
    walker.down -= dt;
    walker.group.rotation.x = walker.down > 0 ? -Math.PI / 2 : 0;
    return;
  }
  if (walker.flee > 0) walker.flee -= dt;
  if (walker.panic > 0) walker.panic -= dt;
  const [mx, mz, speed] = walkDirection(game, walker);
  const nx = walker.pos.x + mx * speed * dt;
  const nz = walker.pos.z + mz * speed * dt;
  const fixed = collideCircle(game, nx, nz, 0.5);
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
  carHitsWalker(game, walker);
  trafficHitsPlayer(game);
}

export function updatePedestrians(game, dt) {
  for (const walker of game.peds) stepWalker(game, walker, dt);
}
