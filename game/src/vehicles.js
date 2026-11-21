// vehicles.js — arcade car physics, car meshes, damage and wrecks.
// Heading convention: heading 0 faces +z (south); forward = (sin h, cos h).
import * as THREE from 'three';
import { clamp, headingVec } from './util.js';
import { collideBuildings, clampToWorld } from './city.js';
import { explode } from './effects.js';
import { playCrash } from './audio.js';

export const CAR_TOP_SPEED = 46; // m/s (~166 km/h)
const CAR_ACCEL = 30;
const CAR_REVERSE_SPEED = 12;
const CAR_TURN = 1.9;

const BODY_COLORS = [0xc0392b, 0x2980b9, 0xf1c40f, 0x27ae60, 0x8e44ad, 0xecf0f1, 0x2c3e50, 0xe67e22];

export function makeCarMesh(color, kind) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x14161c });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x9fd8e8 });
  // Body (a low wedge: main box + nose taper faked by a second box).
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.6), bodyMat);
  body.position.y = 0.55;
  group.add(body);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.42, 1.0), bodyMat);
  nose.position.set(0, 0.48, 2.3);
  group.add(nose);
  // Cabin + glass.
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.2), glassMat);
  cabin.position.set(0, 1.1, -0.2);
  group.add(cabin);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.12, 2.0), bodyMat);
  roof.position.set(0, 1.42, -0.2);
  group.add(roof);
  // Wheel skirt (reads as wheels from the chase cam, one mesh).
  const skirt = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.4, 3.4), darkMat);
  skirt.position.y = 0.28;
  group.add(skirt);
  // Headlights + taillights.
  const lightMat = new THREE.MeshLambertMaterial({ color: 0xfff6c8, emissive: 0xfff2a0, emissiveIntensity: 0.7 });
  const hl = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.16, 0.1), lightMat);
  hl.position.set(0, 0.62, 2.82);
  group.add(hl);
  const tailMat = new THREE.MeshLambertMaterial({ color: 0xff2a2a, emissive: 0xff2020, emissiveIntensity: 0.5 });
  const tl = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.14, 0.1), tailMat);
  tl.position.set(0, 0.66, -2.32);
  group.add(tl);
  if (kind === 'police') {
    // Light bar: red + blue halves, flashing in police.js.
    const barBase = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.18, 0.5), darkMat);
    barBase.position.set(0, 1.56, -0.2);
    group.add(barBase);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.22, 0.5),
      new THREE.MeshLambertMaterial({ color: 0xff2020, emissive: 0xff2020, emissiveIntensity: 1 }));
    red.position.set(-0.3, 1.58, -0.2);
    red.name = 'lightRed';
    group.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.22, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x2040ff, emissive: 0x2040ff, emissiveIntensity: 1 }));
    blue.position.set(0.3, 1.58, -0.2);
    blue.name = 'lightBlue';
    group.add(blue);
  }
  group.traverse((m) => { if (m.isMesh) m.castShadow = false; });
  return group;
}

// Create a car record and add it to the scene. opts: x, z, heading, color,
// kind ('coupe'|'sedan'|'police'|'traffic'|'parked'|'boss'), parked (bool).
export function createCar(G, opts) {
  const color = opts.color !== undefined ? opts.color : BODY_COLORS[Math.floor(G.rng() * BODY_COLORS.length)];
  const mesh = makeCarMesh(color, opts.kind === 'police' ? 'police' : 'car');
  mesh.position.set(opts.x, 0, opts.z);
  mesh.rotation.y = opts.heading || 0;
  G.scene.add(mesh);
  const car = {
    mesh,
    x: opts.x,
    z: opts.z,
    heading: opts.heading || 0,
    speed: 0,
    health: 100,
    kind: opts.kind || 'sedan',
    parked: !!opts.parked,
    traffic: !!opts.traffic,
    police: opts.kind === 'police',
    wrecked: false,
    wreckTimer: 0,
    respawnAt: null,
    home: { x: opts.x, z: opts.z, heading: opts.heading || 0 },
    ramCooldown: 0,
    damageCooldown: 0,
    smokeTimer: 0,
    name: opts.name || null,
  };
  G.cars.push(car);
  return car;
}

function carRadius() {
  return 1.6;
}

// One physics substep for a driven car (player or police AI sets throttle/steer).
export function stepCarDrive(G, car, throttle, steer, dt) {
  if (car.wrecked) return;
  const fwd = headingVec(car.heading);
  // Steering: sharper at low speed, gentler at top speed.
  const speedAbs = Math.abs(car.speed);
  const steerAuthority = clamp(1.15 - speedAbs / CAR_TOP_SPEED, 0.35, 1.15);
  car.heading += steer * CAR_TURN * steerAuthority * dt * (car.speed >= 0 ? 1 : -1) * (speedAbs > 0.5 ? 1 : 0);
  if (throttle > 0) {
    car.speed += CAR_ACCEL * throttle * dt * (1 - Math.max(0, car.speed) / CAR_TOP_SPEED);
  } else if (throttle < 0) {
    if (car.speed > 0.5) car.speed -= CAR_ACCEL * 1.4 * dt; // brake
    else car.speed -= CAR_ACCEL * 0.45 * dt; // reverse
  }
  // Drag: light while throttling (the (1 - speed/top) term already caps the
  // top speed), heavy when coasting so the car rolls to a stop.
  if (throttle > 0) car.speed -= car.speed * 0.05 * dt;
  else if (throttle === 0) car.speed -= car.speed * 0.55 * dt;
  car.speed = clamp(car.speed, -CAR_REVERSE_SPEED, CAR_TOP_SPEED);
  const nf = headingVec(car.heading);
  let nx = car.x + nf.x * car.speed * dt;
  let nz = car.z + nf.z * car.speed * dt;
  // Building collision: slide along the wall, lose speed, small damage.
  const res = collideBuildings(G, nx, nz, carRadius());
  if (res.hit) {
    const hitSpeed = Math.abs(car.speed);
    if (hitSpeed > 6 && car.damageCooldown <= 0) {
      damageCarObj(G, car, Math.min(12, Math.round(hitSpeed * 0.4)));
      car.damageCooldown = 0.6;
      playCrash(G);
    }
    car.speed *= 0.45;
    nx = res.x;
    nz = res.z;
  }
  const clamped = clampToWorld(nx, nz);
  car.x = clamped.x;
  car.z = clamped.z;
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
}

// Push two cars apart on overlap (circle collision), with a small speed trade.
export function collideCarPair(G, a, b) {
  if (a.wrecked || b.wrecked) return;
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const d = Math.sqrt(dx * dx + dz * dz);
  const min = 3.4;
  if (d > 0.01 && d < min) {
    const push = (min - d) / 2;
    const nx = dx / d;
    const nz = dz / d;
    a.x -= nx * push;
    a.z -= nz * push;
    b.x += nx * push;
    b.z += nz * push;
    const rel = Math.abs(a.speed - b.speed);
    if (rel > 4) {
      a.speed *= 0.85;
      b.speed *= 0.85;
    }
    a.mesh.position.set(a.x, 0, a.z);
    b.mesh.position.set(b.x, 0, b.z);
  }
}

export function damageCarObj(G, car, n) {
  if (car.wrecked || n <= 0) return;
  car.health -= n;
  if (car.health <= 0) {
    car.health = 0;
    wreckCar(G, car);
  }
}

export function repairCarObj(G, car) {
  if (!car) return;
  car.health = 100;
  car.wrecked = false;
  car.mesh.visible = true;
  car.mesh.rotation.z = 0;
  car.mesh.position.y = 0;
}

export function wreckCar(G, car) {
  if (car.wrecked) return;
  car.wrecked = true;
  car.speed = 0;
  car.wreckTimer = 0;
  car.respawnAt = G.elapsed + 8;
  explode(G, car.x, car.z, 1);
  // Tip the wreck on its side a touch and darken it.
  car.mesh.rotation.z = 0.12;
  car.mesh.position.y = 0.2;
  if (G.player.car === car) {
    // The driver is ejected when their car wrecks.
    ejectPlayer(G);
  }
}

export function ejectPlayer(G) {
  const p = G.player;
  if (!p.inCar || !p.car) return;
  const car = p.car;
  p.inCar = false;
  p.car = null;
  // Step out to the side of the wreck.
  const fwd = headingVec(car.heading);
  p.x = car.x - fwd.z * 2.4;
  p.z = car.z + fwd.x * 2.4;
  p.pos.set(p.x, 0, p.z);
  p.heading = car.heading;
}

// Respawn logic for wrecked cars: traffic and the boss coupe re-deal after 8 s;
// a wrecked police car stays out of action 8 s, then returns.
export function updateWrecks(G, dt) {
  for (const car of G.cars) {
    if (!car.wrecked) continue;
    car.wreckTimer += dt;
    if (G.elapsed >= car.respawnAt) {
      if (car.kind === 'boss') {
        repairCarObj(G, car);
        car.x = car.home.x;
        car.z = car.home.z;
        car.heading = car.home.heading;
        car.mesh.position.set(car.x, 0, car.z);
        car.mesh.rotation.y = car.heading;
      } else if (car.traffic || car.police) {
        repairCarObj(G, car);
        car.x = car.home.x;
        car.z = car.home.z;
        car.heading = car.home.heading;
        car.mesh.position.set(car.x, 0, car.z);
        car.mesh.rotation.y = car.heading;
      } else if (car.name === 'm1-coupe' || car.name === 'getaway') {
        // Mission cars re-deal so a mission can never soft-lock.
        repairCarObj(G, car);
        car.x = car.home.x;
        car.z = car.home.z;
        car.heading = car.home.heading;
        car.mesh.position.set(car.x, 0, car.z);
        car.mesh.rotation.y = car.heading;
      }
      // Other parked cars stay wrecked (a burnt shell).
    }
  }
}
