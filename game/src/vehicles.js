// vehicles.js — the car factory and the arcade driving model for Solara
// Bay.
//
// Gas, brake, reverse and handbrake; walls push the car back out;
// clipping a traffic car slows you both down. Stealing a parked car
// only draws the law if someone sees it (police.js makes that call).
//
// Every car carries health (100). Wall hits, traffic bumps and police
// rams all hurt it; under half health it smokes, under a quarter it
// burns, and at zero it blows up, throws its driver clear and stays a
// burnt shell until it is towed or respawns.

import { clamp } from './util.js';
import { collideCircle } from './city.js';
import { explodeCar, carExhaust, spawnSkidSmoke, emitBurningSmoke } from './effects.js';
import { damagePlayer } from './player.js';

// Paint swatches for traffic cars, and the five cars parked around
// town. The first parked car is the orange mission coupe by the plaza.
const PAINT_POOL = 'c0392b 2e86c1 27ae60 f1c40f 8e44ad 95a5a6 e67e22 16a085'
  .split(' ')
  .map((hex) => parseInt(hex, 16));
const PARKED_ROWS = [
  [27, 26, -Math.PI / 2, 0xff7f11, true],
  [-46, 6, 0, 0x2e86c1, false],
  [86, -46, Math.PI / 2, 0x27ae60, false],
  [-86, 84, Math.PI, 0x8e44ad, false],
  [44, 124, -Math.PI / 2, 0xf1c40f, false],
];
const PARKED_SPOTS = PARKED_ROWS.map(([x, z, heading, color, mission]) => ({ x, z, heading, color, mission }));

// Damage thresholds: a car smokes below 50, burns below 25, and takes
// 2 burn damage per second while it burns.
const DAMAGE = { burnPerSecond: 2, smokeBelow: 50, burnBelow: 25 };

// Body pieces as [shape, skin, x, y, z, castsShadow] — one pass builds
// the shell, the cabin and the roof instead of three near-identical
// blocks.
function assembleShell(THREE, group, paint, glass) {
  const plan = [
    [new THREE.BoxGeometry(2.0, 0.75, 4.4), paint, 0, 0.65, 0, true],
    [new THREE.BoxGeometry(1.7, 0.65, 2.1), glass, 0, 1.3, -0.25, true],
    [new THREE.BoxGeometry(1.75, 0.1, 2.15), paint, 0, 1.65, -0.25, false],
  ];
  for (const [shape, skin, x, y, z, shadow] of plan) {
    const piece = new THREE.Mesh(shape, skin);
    piece.position.set(x, y, z);
    piece.castShadow = shadow;
    group.add(piece);
  }
}

function assembleWheels(THREE, group, dark) {
  const tyre = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  const corners = [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]];
  const wheels = [];
  for (const [wx, wz] of corners) {
    const wheel = new THREE.Mesh(tyre, dark);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.38, wz);
    group.add(wheel);
    wheels.push(wheel);
  }
  return wheels;
}

function assembleLights(THREE, group) {
  const headSkin = new THREE.MeshBasicMaterial({ color: 0xfff6c0 });
  const tailSkin = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  const ends = [
    [headSkin, 2.21],
    [tailSkin, -2.21],
  ];
  for (const [skin, z] of ends) {
    for (const lx of [-0.6, 0.6]) {
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.08), skin);
      lamp.position.set(lx, 0.75, z);
      group.add(lamp);
    }
  }
}

function assembleLightBar(THREE, group) {
  const blue = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 0.16, 0.4),
    new THREE.MeshBasicMaterial({ color: 0x2266ff })
  );
  blue.position.set(0, 1.75, -0.25);
  group.add(blue);
  const red = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.16, 0.42),
    new THREE.MeshBasicMaterial({ color: 0xff2222 })
  );
  red.position.set(0.55, 1.75, -0.25);
  group.add(red);
}

export function makeCarMesh(THREE, color, isPolice) {
  const group = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color });
  const dark = new THREE.MeshLambertMaterial({ color: 0x1a1d22 });
  const glass = new THREE.MeshLambertMaterial({ color: 0x9fd8e8 });
  assembleShell(THREE, group, paint, glass);
  const wheels = assembleWheels(THREE, group, dark);
  assembleLights(THREE, group);
  if (isPolice) assembleLightBar(THREE, group);
  return { group, wheels };
}

export function createCar(game, opts) {
  const THREE = window.THREE;
  const color = opts.color ?? PAINT_POOL[Math.floor(Math.random() * PAINT_POOL.length)];
  const { group, wheels } = makeCarMesh(THREE, color, !!opts.police);
  group.position.set(opts.x, 0, opts.z);
  group.rotation.y = opts.heading ?? 0;
  game.scene.add(group);
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
    // Damage state: 100 health, wrecked at zero, out of action 8 s.
    health: 100,
    maxHealth: 100,
    wrecked: false,
    wreckTimer: 0,
    smokeTimer: 0,
    skidTimer: 0,
    // Driving model: police cars run a little faster than civilian ones.
    topSpeed: opts.police ? 42 : 38,
    accel: 16,
    brake: 30,
    length: 4.4,
    width: 2.0,
  };
  car.pos = group.position;
  // The raycast in combat.js walks up from a hit mesh to find this car.
  group.userData.car = car;
  return car;
}

// Hurt a car. At zero health the car wrecks: it explodes, throws its
// driver clear and stays a burnt-out shell until it is towed or respawns.
export function damageCar(game, car, amount) {
  if (!car || car.wrecked || car.dead || amount <= 0) return;
  car.health -= amount;
  if (car.health > 0) return;
  car.health = 0;
  wreckCar(game, car);
}

// Put a car back to full health (debug hook). A wrecked car stays
// wrecked — only a live car can be repaired.
export function repairCar(game, car) {
  if (!car || car.wrecked) return;
  car.health = 100;
}

export function wreckCar(game, car) {
  car.wrecked = true;
  car.wreckTimer = 8;
  car.speed = 0;
  explodeCar(game, car.pos.x, car.pos.z);
  if (car.isPlayer) {
    // Marlo is thrown clear of the wreck, on foot and hurt.
    stepOut(game);
    damagePlayer(game, 10, 'car explosion');
    if (game.hud) game.hud.toast('Your car exploded — find another ride');
  }
  if (game.audio) game.audio.crash();
}

// A one-word damage state for a car, used by the HUD and the minimap
// to colour the car's marker: pristine, smoking, burning or wrecked.
export function carDamageState(car) {
  if (!car || car.wrecked || car.dead) return 'wrecked';
  if (car.health <= DAMAGE.burnBelow) return 'burning';
  if (car.health <= DAMAGE.smokeBelow) return 'smoking';
  return 'pristine';
}

// Parked cars Marlo can steal, including the orange mission coupe by
// the plaza.
export function spawnParkedCars(game) {
  game.parkedCars = PARKED_SPOTS.map((spot) => {
    const car = createCar(game, { x: spot.x, z: spot.z, heading: spot.heading, color: spot.color, parked: true });
    car.mission = !!spot.mission;
    return car;
  });
  game.missionCoupe = game.parkedCars[0];
  return game.parkedCars;
}

// Shove a car out of any building it overlaps; true when it was pushed.
function pushOutOfWalls(game, car) {
  const fixed = collideCircle(game, car.pos.x, car.pos.z, 2.2);
  if (!fixed.hit) return false;
  car.pos.x = fixed.x;
  car.pos.z = fixed.z;
  return true;
}

// Bump into traffic cars: both are pushed apart and slow down, and a
// hard bump damages both cars.
function bumpTraffic(game, car) {
  for (const other of game.trafficCars || []) {
    if (other.wrecked) continue;
    const dx = car.pos.x - other.pos.x;
    const dz = car.pos.z - other.pos.z;
    const gap = Math.hypot(dx, dz);
    if (gap >= 3.6 || gap <= 0.01) continue;
    const shove = (3.6 - gap) / gap;
    car.pos.x += dx * shove * 0.5;
    car.pos.z += dz * shove * 0.5;
    other.pos.x -= dx * shove * 0.5;
    other.pos.z -= dz * shove * 0.5;
    if (Math.abs(car.speed) > 8) {
      car.speed *= 0.7;
      damageCar(game, car, 6);
      damageCar(game, other, 6);
      if (game.audio) game.audio.crash();
    }
  }
}

// Read the drive keys into gas / reverse / handbrake / steer.
function readControls(game) {
  const gas = game.keys.has('KeyW');
  const reverse = game.keys.has('KeyS');
  const handbrake = game.keys.has('Space');
  let steerInput = 0;
  if (game.keys.has('KeyA')) steerInput += 1;
  if (game.keys.has('KeyD')) steerInput -= 1;
  return { gas, reverse, handbrake, steerInput };
}

function applyDrive(car, pedals, dt) {
  if (pedals.gas) car.speed += car.accel * dt;
  if (pedals.reverse) {
    if (car.speed > 0.5) car.speed -= car.brake * dt;
    else car.speed -= car.accel * 0.6 * dt;
  }
  if (!pedals.gas && !pedals.reverse) {
    // Rolling drag.
    car.speed -= Math.sign(car.speed) * 6 * dt;
    if (Math.abs(car.speed) < 0.3) car.speed = 0;
  }
  if (pedals.handbrake) {
    car.speed -= Math.sign(car.speed) * 26 * dt;
    if (Math.abs(car.speed) < 0.5) car.speed = 0;
  }
  car.speed = clamp(car.speed, -12, car.topSpeed);
}

function applySteering(car, pedals, dt) {
  const target = pedals.steerInput * 0.55 * (car.speed >= 0 ? 1 : -1);
  car.steer += (target - car.steer) * Math.min(1, dt * 8);
  const turn = car.steer * clamp(Math.abs(car.speed) / 8, 0, 1) * 1.9;
  car.heading += turn * dt * (pedals.handbrake ? 1.5 : 1);
}

// A hurt car smokes, and a burning car keeps losing health until it
// wrecks. Tyre smoke puffs from the rear wheels on a hard handbrake.
function wearSmoke(game, car, pedals, dt) {
  if (car.health < DAMAGE.smokeBelow && car.health > 0) {
    carExhaust(game, car, dt);
    if (car.health < DAMAGE.burnBelow) {
      // A burning car vents a continuous smoke plume and takes
      // burn damage until it wrecks.
      emitBurningSmoke(game, car.pos.x, car.pos.z, dt);
      damageCar(game, car, DAMAGE.burnPerSecond * dt);
    }
  }
  car.skidTimer -= dt;
  if (pedals.handbrake && Math.abs(car.speed) > 10 && car.skidTimer <= 0) {
    car.skidTimer = 0.08;
    const bx = car.pos.x - Math.sin(car.heading) * 1.5;
    const bz = car.pos.z - Math.cos(car.heading) * 1.5;
    spawnSkidSmoke(game, bx, bz);
  }
}

export function updatePlayerCar(game, dt) {
  const p = game.player;
  const car = p.car;
  if (!p.inCar || !car) return;
  if (car.wrecked) return;
  // The pistol cooldown ticks while driving, so a drive-by can fire
  // more than once.
  p.shootCooldown = Math.max(0, p.shootCooldown - dt);
  const pedals = readControls(game);
  applyDrive(car, pedals, dt);
  applySteering(car, pedals, dt);
  car.pos.x += Math.sin(car.heading) * car.speed * dt;
  car.pos.z += Math.cos(car.heading) * car.speed * dt;
  if (pushOutOfWalls(game, car)) {
    if (Math.abs(car.speed) > 6) {
      damageCar(game, car, Math.abs(car.speed) * 0.5);
      if (game.audio) game.audio.crash();
    }
    car.speed *= 0.45;
  }
  bumpTraffic(game, car);
  wearSmoke(game, car, pedals, dt);
  if (car.wrecked) return;
  car.group.rotation.y = car.heading;
  const spin = car.speed * dt * 2.6;
  for (const w of car.wheels) w.rotation.x += spin;
  car.wheels[0].rotation.y = car.steer * 0.5;
  car.wheels[1].rotation.y = car.steer * 0.5;

  // Marlo rides with the car: markers and missions read player.pos.
  p.pos.x = car.pos.x;
  p.pos.z = car.pos.z;
  p.speed = Math.abs(car.speed);
  if (game.audio) game.audio.setEngine(Math.abs(car.speed) / car.topSpeed, true);
}

function stepOut(game) {
  const p = game.player;
  const car = p.car;
  car.isPlayer = false;
  p.inCar = false;
  p.car = null;
  p.pos.x = car.pos.x + Math.cos(car.heading) * 2.4;
  p.pos.z = car.pos.z - Math.sin(car.heading) * 2.4;
  const fixed = collideCircle(game, p.pos.x, p.pos.z, 0.6);
  p.pos.x = fixed.x;
  p.pos.z = fixed.z;
  p.group.position.set(p.pos.x, 0, p.pos.z);
  p.group.visible = true;
  if (game.audio) game.audio.setEngine(0, false);
}

// Nearest stealable parked car, or null when none is in reach.
function nearestStealable(game) {
  const p = game.player;
  let best = null;
  let bestD = 4.5;
  for (const car of game.parkedCars || []) {
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
export function tryEnterExitCar(game) {
  const p = game.player;
  if (game.state !== 'playing') return;
  if (p.inCar && p.car) {
    stepOut(game);
    return;
  }
  if (p.inCar) return;
  const car = nearestStealable(game);
  if (!car) return;
  car.parked = false;
  car.isPlayer = true;
  p.inCar = true;
  p.car = car;
  p.group.visible = false;
  p.pos.x = car.pos.x;
  p.pos.z = car.pos.z;
  if (game.audio) game.audio.engineStart();
  if (game.onCarStolen) game.onCarStolen(car);
}

export function nearestParkedCar(game) {
  const p = game.player;
  if (p.inCar) return null;
  return nearestStealable(game);
}
