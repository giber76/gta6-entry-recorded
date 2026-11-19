// vehicles.js — the car factory and arcade driving for Solara Bay.
//
// Accelerate, brake, reverse and handbrake; buildings push the car out;
// bumps with traffic slow both cars. Stealing a parked car only draws the
// law if someone sees it (police.js decides that).

import { clamp } from './util.js';
import { collideCircle } from './city.js';

const PAINT_POOL = [0xc0392b, 0x2e86c1, 0x27ae60, 0xf1c40f, 0x8e44ad, 0x95a5a6, 0xe67e22, 0x16a085];
const PARKED_SPOTS = [
  { x: 27, z: 26, heading: -Math.PI / 2, color: 0xff7f11, mission: true },
  { x: -46, z: 6, heading: 0, color: 0x2e86c1 },
  { x: 86, z: -46, heading: Math.PI / 2, color: 0x27ae60 },
  { x: -86, z: 84, heading: Math.PI, color: 0x8e44ad },
  { x: 44, z: 124, heading: -Math.PI / 2, color: 0xf1c40f },
];

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

// Parked cars Marlo can steal, including the orange mission coupe by the plaza.
export function spawnParkedCars(G) {
  G.parkedCars = PARKED_SPOTS.map((s) => {
    const car = createCar(G, { x: s.x, z: s.z, heading: s.heading, color: s.color, parked: true });
    car.mission = !!s.mission;
    return car;
  });
  G.missionCoupe = G.parkedCars[0];
  return G.parkedCars;
}

// Push a car out of any building it overlaps; true when it was pushed.
function pushOutOfBuildings(G, car) {
  const fixed = collideCircle(G, car.pos.x, car.pos.z, 2.2);
  if (!fixed.hit) return false;
  car.pos.x = fixed.x;
  car.pos.z = fixed.z;
  return true;
}

// Bump into traffic cars: both are pushed apart and slow down.
function bumpTraffic(G, car) {
  for (const t of G.trafficCars || []) {
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
    if (Math.abs(car.speed) > 6 && G.audio) G.audio.crash();
    car.speed *= 0.45;
  }
  bumpTraffic(G, car);
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
    if (car.dead) continue;
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
