// vehicles.js — car factory and arcade driving for Solara Bay.
// Accelerate / brake / reverse / handbrake, building push-out, traffic bumps.
// Stealing a parked car raises wanted only if someone sees it (police.js decides).

import { clamp } from './util.js';
import { collideCircle } from './city.js';

const CAR_COLORS = [0xc0392b, 0x2e86c1, 0x27ae60, 0xf1c40f, 0x8e44ad, 0x95a5a6, 0xe67e22, 0x16a085];

export function makeCarMesh(THREE, color, isPolice) {
  const group = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color });
  const dark = new THREE.MeshLambertMaterial({ color: 0x1a1d22 });
  const glass = new THREE.MeshLambertMaterial({ color: 0x9fd8e8 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.75, 4.4), paint);
  body.position.y = 0.65;
  body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.65, 2.1), glass);
  cabin.position.set(0, 1.3, -0.25);
  cabin.castShadow = true;
  group.add(cabin);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.1, 2.15), paint);
  roof.position.set(0, 1.65, -0.25);
  group.add(roof);

  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const wheel = new THREE.Mesh(wheelGeo, dark);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.38, wz);
    group.add(wheel);
    wheels.push(wheel);
  }
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff6c0 });
  for (const lx of [-0.6, 0.6]) {
    const light = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.08), lightMat);
    light.position.set(lx, 0.75, 2.21);
    group.add(light);
  }
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  for (const lx of [-0.6, 0.6]) {
    const light = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.08), tailMat);
    light.position.set(lx, 0.75, -2.21);
    group.add(light);
  }
  if (isPolice) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.16, 0.4), new THREE.MeshBasicMaterial({ color: 0x2266ff }));
    bar.position.set(0, 1.75, -0.25);
    group.add(bar);
    const bar2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.42), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    bar2.position.set(0.55, 1.75, -0.25);
    group.add(bar2);
  }
  return { group, wheels };
}

export function createCar(G, opts) {
  const THREE = window.THREE;
  const color = opts.color ?? CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)];
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
    topSpeed: opts.police ? 42 : 38,
    accel: 16,
    brake: 30,
    length: 4.4,
    width: 2.0,
    dead: false,
  };
  car.pos = group.position;
  return car;
}

// Parked cars Marlo can steal, including the orange mission coupe by the plaza.
export function spawnParkedCars(G) {
  const THREE = window.THREE;
  const spots = [
    { x: 27, z: 26, heading: -Math.PI / 2, color: 0xff7f11, mission: true },
    { x: -46, z: 6, heading: 0, color: 0x2e86c1 },
    { x: 86, z: -46, heading: Math.PI / 2, color: 0x27ae60 },
    { x: -86, z: 84, heading: Math.PI, color: 0x8e44ad },
    { x: 44, z: 124, heading: -Math.PI / 2, color: 0xf1c40f },
  ];
  G.parkedCars = spots.map((s) => {
    const car = createCar(G, { x: s.x, z: s.z, heading: s.heading, color: s.color, parked: true });
    car.mission = !!s.mission;
    return car;
  });
  G.missionCoupe = G.parkedCars[0];
  return G.parkedCars;
}

function carCollidesBuildings(G, car) {
  const r = 2.2;
  const fixed = collideCircle(G, car.pos.x, car.pos.z, r);
  if (fixed.hit) {
    car.pos.x = fixed.x;
    car.pos.z = fixed.z;
    return true;
  }
  return false;
}

export function updatePlayerCar(G, dt) {
  const p = G.player;
  const car = p.car;
  if (!p.inCar || !car) return;
  const fwd = G.keys.has('KeyW');
  const back = G.keys.has('KeyS');
  const handbrake = G.keys.has('Space');
  let steerInput = 0;
  if (G.keys.has('KeyA')) steerInput += 1;
  if (G.keys.has('KeyD')) steerInput -= 1;

  if (fwd) car.speed += car.accel * dt;
  if (back) {
    if (car.speed > 0.5) car.speed -= car.brake * dt;
    else car.speed -= car.accel * 0.6 * dt;
  }
  if (!fwd && !back) {
    // Rolling drag.
    car.speed -= Math.sign(car.speed) * 6 * dt;
    if (Math.abs(car.speed) < 0.3) car.speed = 0;
  }
  if (handbrake) {
    car.speed -= Math.sign(car.speed) * 26 * dt;
    if (Math.abs(car.speed) < 0.5) car.speed = 0;
  }
  car.speed = clamp(car.speed, -12, car.topSpeed);

  const steerTarget = steerInput * 0.55 * (car.speed >= 0 ? 1 : -1);
  car.steer += (steerTarget - car.steer) * Math.min(1, dt * 8);
  const turnRate = car.steer * clamp(Math.abs(car.speed) / 8, 0, 1) * 1.9;
  car.heading += turnRate * dt * (handbrake ? 1.5 : 1);

  const nx = car.pos.x + Math.sin(car.heading) * car.speed * dt;
  const nz = car.pos.z + Math.cos(car.heading) * car.speed * dt;
  car.pos.x = nx;
  car.pos.z = nz;
  if (carCollidesBuildings(G, car)) {
    if (Math.abs(car.speed) > 6 && G.audio) G.audio.crash();
    car.speed *= 0.45;
  }
  // Bump into traffic cars: both slow down.
  for (const t of G.trafficCars || []) {
    const dx = car.pos.x - t.pos.x;
    const dz = car.pos.z - t.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 3.6 && d > 0.01) {
      const push = (3.6 - d) / d;
      car.pos.x += dx * push * 0.5;
      car.pos.z += dz * push * 0.5;
      t.pos.x -= dx * push * 0.5;
      t.pos.z -= dz * push * 0.5;
      if (Math.abs(car.speed) > 8) {
        car.speed *= 0.7;
        if (G.audio) G.audio.crash();
      }
    }
  }
  car.group.rotation.y = car.heading;
  const spin = car.speed * dt * 2.6;
  for (const w of car.wheels) w.rotation.x += spin;
  car.wheels[0].rotation.y = car.steer * 0.5;
  car.wheels[1].rotation.y = car.steer * 0.5;

  // The player rides with the car: markers and missions read player.pos.
  p.pos.x = car.pos.x;
  p.pos.z = car.pos.z;
  p.speed = Math.abs(car.speed);
  if (G.audio) G.audio.setEngine(Math.abs(car.speed) / car.topSpeed, true);
}

// E near a parked car: get in (steal). E while driving: get out.
export function tryEnterExitCar(G) {
  const p = G.player;
  if (G.state !== 'playing') return;
  if (p.inCar && p.car) {
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
    return;
  }
  if (p.inCar) return;
  let best = null;
  let bestD = 4.5;
  for (const car of G.parkedCars || []) {
    if (car.dead) continue;
    const d = Math.hypot(car.pos.x - p.pos.x, car.pos.z - p.pos.z);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  if (!best) return;
  best.parked = false;
  best.isPlayer = true;
  p.inCar = true;
  p.car = best;
  p.group.visible = false;
  p.pos.x = best.pos.x;
  p.pos.z = best.pos.z;
  if (G.onCarStolen) G.onCarStolen(best);
}

export function nearestParkedCar(G) {
  const p = G.player;
  if (p.inCar) return null;
  let best = null;
  let bestD = 4.5;
  for (const car of G.parkedCars || []) {
    if (car.dead) continue;
    const d = Math.hypot(car.pos.x - p.pos.x, car.pos.z - p.pos.z);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}
