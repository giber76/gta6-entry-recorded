// vehicles.js — the car factory and arcade driving for Solara Bay.
//
// Accelerate, brake, reverse and handbrake; buildings push the car out;
// bumps with traffic slow both cars. Cars take damage: hard building hits,
// police rams and bullets wear a car down. A smoking car is hurt; a
// burning car is about to explode — and a wrecked car is gone for good
// (traffic respawns, the boss coupe is re-dealt when its job starts).
// Stealing a parked car only draws the law if someone sees it (police.js
// decides that).

import { clamp } from './util.js';
import { collideCircle } from './city.js';
import { spawnExplosion, spawnSmokePuff, spawnFirePuff } from './effects.js';
import { scatterPeds } from './pedestrians.js';
import { damagePlayer } from './player.js';

const PAINT_POOL = [0xc0392b, 0x2e86c1, 0x27ae60, 0xf1c40f, 0x8e44ad, 0x95a5a6, 0xe67e22, 0x16a085];
const PARKED_SPOTS = [
  { x: 27, z: 26, heading: -Math.PI / 2, color: 0xff7f11, mission: 'orange' },
  { x: -46, z: 6, heading: 0, color: 0x2e86c1 },
  { x: 86, z: -46, heading: Math.PI / 2, color: 0x27ae60 },
  { x: -86, z: 84, heading: Math.PI, color: 0x8e44ad },
  { x: 44, z: 124, heading: -Math.PI / 2, color: 0xf1c40f },
  { x: 128, z: 48, heading: Math.PI, color: 0x111111, mission: 'boss' },
];
const BOSS_SPOT = PARKED_SPOTS[PARKED_SPOTS.length - 1];

// Body parts as [geometry, material, x, y, z, castShadow?] — one loop
// builds the shell, cabin and roof instead of three copy-pasted blocks.
function buildShell(THREE, group, paint, glass) {
  const parts = [
    [new THREE.BoxGeometry(2.0, 0.75, 4.4), paint, 0, 0.65, 0, true],
    [new THREE.BoxGeometry(1.7, 0.65, 2.1), glass, 0, 1.3, -0.25, true],
    [new THREE.BoxGeometry(1.75, 0.1, 2.15), paint, 0, 1.65, -0.25, false],
  ];
  for (const [geo, mat, x, y, z, shadow] of parts) {
    const piece = new THREE.Mesh(geo, mat);
    piece.position.set(x, y, z);
    piece.castShadow = shadow;
    group.add(piece);
  }
}

function buildWheels(THREE, group, dark) {
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  const wheels = [];
  const spots = [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]];
  for (const [wx, wz] of spots) {
    const wheel = new THREE.Mesh(wheelGeo, dark);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.38, wz);
    group.add(wheel);
    wheels.push(wheel);
  }
  return wheels;
}

function buildLights(THREE, group) {
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff6c0 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  const pairs = [
    [headMat, 2.21],
    [tailMat, -2.21],
  ];
  for (const [mat, z] of pairs) {
    for (const lx of [-0.6, 0.6]) {
      const light = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.08), mat);
      light.position.set(lx, 0.75, z);
      group.add(light);
    }
  }
}

function buildLightBar(THREE, group) {
  const bar = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 0.16, 0.4),
    new THREE.MeshBasicMaterial({ color: 0x2266ff })
  );
  bar.position.set(0, 1.75, -0.25);
  group.add(bar);
  const bar2 = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.16, 0.42),
    new THREE.MeshBasicMaterial({ color: 0xff2222 })
  );
  bar2.position.set(0.55, 1.75, -0.25);
  group.add(bar2);
}

export function makeCarMesh(THREE, color, isPolice) {
  const group = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color });
  const dark = new THREE.MeshLambertMaterial({ color: 0x1a1d22 });
  const glass = new THREE.MeshLambertMaterial({ color: 0x9fd8e8 });
  buildShell(THREE, group, paint, glass);
  const wheels = buildWheels(THREE, group, dark);
  buildLights(THREE, group);
  if (isPolice) buildLightBar(THREE, group);
  return { group, wheels };
}

export function createCar(G, opts) {
  const THREE = window.THREE;
  const color = opts.color ?? PAINT_POOL[Math.floor(Math.random() * PAINT_POOL.length)];
  const { group, wheels } = makeCarMesh(THREE, color, !!opts.police);
  group.position.set(opts.x, 0, opts.z);
  group.rotation.y = opts.heading ?? 0;
  G.scene.add(group);
  const car = {
    group,
    wheels,
    color,
    heading: opts.heading ?? 0,
    speed: 0,
    steer: 0,
    isPolice: !!opts.police,
    isPlayer: false,
    parked: !!opts.parked,
    dead: false,
    health: 100,
    wrecked: false,
    smokeTimer: 0,
    tireTimer: 0,
    bumpCooldown: 0,
  };
  // Driving model: police cars are a little faster than civilian ones.
  car.topSpeed = opts.police ? 42 : 38;
  car.accel = 16;
  car.brake = 30;
  car.length = 4.4;
  car.width = 2.0;
  car.pos = group.position;
  return car;
}

// Parked cars Marlo can steal: the orange mission coupe by the plaza and
// the black boss coupe at Marina East, plus four ordinary cars.
export function spawnParkedCars(G) {
  G.parkedCars = PARKED_SPOTS.map((s) => {
    const car = createCar(G, { x: s.x, z: s.z, heading: s.heading, color: s.color, parked: true });
    car.mission = s.mission ?? null;
    return car;
  });
  G.missionCoupe = G.parkedCars[0];
  return G.parkedCars;
}

// The boss coupe for the last job: if it was wrecked earlier, deal it back
// onto its Marina East spot so the job is always playable.
export function respawnBossCoupe(G) {
  const alive = (G.parkedCars || []).find((c) => c.mission === 'boss');
  if (alive) {
    alive.health = 100;
    alive.wrecked = false;
    alive.dead = false;
    return alive;
  }
  const car = createCar(G, { x: BOSS_SPOT.x, z: BOSS_SPOT.z, heading: BOSS_SPOT.heading, color: BOSS_SPOT.color, parked: true });
  car.mission = 'boss';
  G.parkedCars.push(car);
  return car;
}

// Repair every parked car (new game, respawn, continue): a wrecked mission
// coupe must never make a job impossible.
export function repairAllParked(G) {
  for (const car of G.parkedCars || []) {
    car.health = 100;
    car.wrecked = false;
    car.dead = false;
  }
}

// Damage a car; at zero health it explodes and leaves the street.
export function damageCar(G, car, amount) {
  if (!car || car.wrecked || car.dead) return;
  car.health -= amount;
  if (car.health > 0) return;
  wreckCar(G, car);
}

function wreckCar(G, car) {
  car.wrecked = true;
  car.dead = true;
  car.health = 0;
  spawnExplosion(G, car.pos.x, car.pos.z, true);
  scatterPeds(G, car.pos.x, car.pos.z, 30);
  G.scene.remove(car.group);
  if (car.isPlayer) {
    stepOut(G);
    damagePlayer(G, 20, 'car exploded');
    if (G.hud) G.hud.toast('Your car exploded!');
  }
  if (car.isPolice) {
    G.policeCars = (G.policeCars || []).filter((c) => c !== car);
    if (G.onPoliceCarWrecked) G.onPoliceCarWrecked(car);
  } else if (car.traffic) {
    G.trafficCars = (G.trafficCars || []).filter((c) => c !== car);
    if (G.onTrafficCarWrecked) G.onTrafficCarWrecked(car);
  } else if (car.parked) {
    G.parkedCars = (G.parkedCars || []).filter((c) => c !== car);
  }
}

// Repair one car back to full health (debug hook / respawn).
export function repairCar(G, car) {
  if (!car || car.wrecked) return;
  car.health = 100;
}

// Push a car out of any building it overlaps; true when it was pushed.
function pushOutOfBuildings(G, car) {
  const fixed = collideCircle(G, car.pos.x, car.pos.z, 2.2);
  if (!fixed.hit) return false;
  car.pos.x = fixed.x;
  car.pos.z = fixed.z;
  return true;
}

// Bump into traffic cars: both are pushed apart and slow down. A hard
// bump damages both cars, but only once per half-second per car.
function bumpTraffic(G, car) {
  for (const t of G.trafficCars || []) {
    if (t.wrecked) continue;
    const dx = car.pos.x - t.pos.x;
    const dz = car.pos.z - t.pos.z;
    const gap = Math.hypot(dx, dz);
    if (gap >= 3.6 || gap <= 0.01) continue;
    const shove = (3.6 - gap) / gap;
    car.pos.x += dx * shove * 0.5;
    car.pos.z += dz * shove * 0.5;
    t.pos.x -= dx * shove * 0.5;
    t.pos.z -= dz * shove * 0.5;
    if (Math.abs(car.speed) > 8) {
      car.speed *= 0.7;
      if (G.audio) G.audio.crash();
      if (car.bumpCooldown <= 0) {
        car.bumpCooldown = 0.5;
        damageCar(G, car, 4);
        damageCar(G, t, 6);
      }
    }
  }
}

// Read the drive keys into gas / reverse / handbrake / steer.
function readDriveInput(G) {
  const gas = G.keys.has('KeyW');
  const reverse = G.keys.has('KeyS');
  const handbrake = G.keys.has('Space');
  let steerInput = 0;
  if (G.keys.has('KeyA')) steerInput += 1;
  if (G.keys.has('KeyD')) steerInput -= 1;
  return { gas, reverse, handbrake, steerInput };
}

function applyDriveForces(car, input, dt) {
  const { gas, reverse, handbrake } = input;
  if (gas) car.speed += car.accel * dt;
  if (reverse) {
    if (car.speed > 0.5) car.speed -= car.brake * dt;
    else car.speed -= car.accel * 0.6 * dt;
  }
  if (!gas && !reverse) {
    // Rolling drag.
    car.speed -= Math.sign(car.speed) * 6 * dt;
    if (Math.abs(car.speed) < 0.3) car.speed = 0;
  }
  if (handbrake) {
    car.speed -= Math.sign(car.speed) * 26 * dt;
    if (Math.abs(car.speed) < 0.5) car.speed = 0;
  }
  car.speed = clamp(car.speed, -12, car.topSpeed);
}

function applySteering(car, input, dt) {
  const steerTarget = input.steerInput * 0.55 * (car.speed >= 0 ? 1 : -1);
  car.steer += (steerTarget - car.steer) * Math.min(1, dt * 8);
  const turnRate = car.steer * clamp(Math.abs(car.speed) / 8, 0, 1) * 1.9;
  car.heading += turnRate * dt * (input.handbrake ? 1.5 : 1);
}

// A damaged car smokes (under half health) and burns (under a quarter).
// A handbrake turn at speed leaves tyre smoke at the rear wheels.
function updateCarSmoke(G, car, input, dt) {
  car.smokeTimer -= dt;
  car.tireTimer -= dt;
  car.bumpCooldown = Math.max(0, car.bumpCooldown - dt);
  if (car.health < 50 && car.smokeTimer <= 0) {
    car.smokeTimer = car.health < 25 ? 0.15 : 0.4;
    spawnSmokePuff(G, car.pos.x, car.pos.z);
    if (car.health < 25) spawnFirePuff(G, car.pos.x, car.pos.z);
  }
  if (input.handbrake && Math.abs(car.speed) > 10 && car.tireTimer <= 0) {
    car.tireTimer = 0.08;
    const backX = car.pos.x - Math.sin(car.heading) * 1.6;
    const backZ = car.pos.z - Math.cos(car.heading) * 1.6;
    spawnSmokePuff(G, backX, backZ);
    if (G.audio) G.audio.skid();
  }
}

export function updatePlayerCar(G, dt) {
  const p = G.player;
  const car = p.car;
  if (!p.inCar || !car) return;
  const input = readDriveInput(G);
  applyDriveForces(car, input, dt);
  applySteering(car, input, dt);
  car.pos.x += Math.sin(car.heading) * car.speed * dt;
  car.pos.z += Math.cos(car.heading) * car.speed * dt;
  if (pushOutOfBuildings(G, car)) {
    const impact = Math.abs(car.speed);
    if (impact > 6 && G.audio) G.audio.crash();
    if (impact > 10) {
      damageCar(G, car, (impact - 10) * 0.8);
      G.shake = Math.max(G.shake ?? 0, 0.4);
    }
    car.speed *= 0.45;
  }
  bumpTraffic(G, car);
  if (car.wrecked) return; // the car just exploded: Marlo is on foot now
  updateCarSmoke(G, car, input, dt);
  car.group.rotation.y = car.heading;
  const spin = car.speed * dt * 2.6;
  for (const w of car.wheels) w.rotation.x += spin;
  car.wheels[0].rotation.y = car.steer * 0.5;
  car.wheels[1].rotation.y = car.steer * 0.5;

  // Marlo rides with the car: markers and missions read player.pos.
  p.pos.x = car.pos.x;
  p.pos.z = car.pos.z;
  p.speed = Math.abs(car.speed);
  if (G.audio) G.audio.setEngine(Math.abs(car.speed) / car.topSpeed, true);
}

function stepOut(G) {
  const p = G.player;
  const car = p.car;
  car.isPlayer = false;
  p.inCar = false;
  p.car = null;
  p.pos.x = car.pos.x + Math.cos(car.heading) * 2.4;
  p.pos.z = car.pos.z - Math.sin(car.heading) * 2.4;
  const fixed = collideCircle(G, p.pos.x, p.pos.z, 0.6);
  p.pos.x = fixed.x;
  p.pos.z = fixed.z;
  p.group.position.set(p.pos.x, 0, p.pos.z);
  p.group.visible = true;
  if (G.audio) G.audio.setEngine(0, false);
}

// Nearest stealable parked car, or null when none is in reach.
function nearestStealable(G) {
  const p = G.player;
  let best = null;
  let bestD = 4.5;
  for (const car of G.parkedCars || []) {
    if (car.dead || car.wrecked) continue;
    const gap = Math.hypot(car.pos.x - p.pos.x, car.pos.z - p.pos.z);
    if (gap < bestD) {
      bestD = gap;
      best = car;
    }
  }
  return best;
}

// E near a parked car: get in (steal). E while driving: get out.
export function tryEnterExitCar(G) {
  const p = G.player;
  if (G.state !== 'playing') return;
  if (p.inCar && p.car) {
    stepOut(G);
    return;
  }
  if (p.inCar) return;
  const car = nearestStealable(G);
  if (!car) return;
  car.parked = false;
  car.isPlayer = true;
  p.inCar = true;
  p.car = car;
  p.group.visible = false;
  p.pos.x = car.pos.x;
  p.pos.z = car.pos.z;
  if (G.onCarStolen) G.onCarStolen(car);
}

export function nearestParkedCar(G) {
  const p = G.player;
  if (p.inCar) return null;
  return nearestStealable(G);
}
