// player.js — Marlo: on-foot movement, entering/exiting cars, health.
import * as THREE from 'three';
import { clamp, headingVec } from './util.js';
import { collideBuildings, clampToWorld } from './city.js';
import { stepCarDrive, ejectPlayer } from './vehicles.js';

export const WALK_SPEED = 6.5;

export function makePlayerMesh() {
  const g = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: 0xffd23f });
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98a5a });
  const pants = new THREE.MeshLambertMaterial({ color: 0x22303e });
  const jacket = new THREE.MeshLambertMaterial({ color: 0x27324a });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.8, 0.36), jacket);
  torso.position.y = 1.08;
  torso.name = 'torso';
  g.add(torso);
  const shirtFront = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.6, 0.05), shirt);
  shirtFront.position.set(0, 1.08, 0.2);
  g.add(shirtFront);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.23, 12, 10), skin);
  head.position.y = 1.66;
  head.name = 'head';
  g.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.25, 0.1, 10),
    new THREE.MeshLambertMaterial({ color: 0xc0392b }));
  cap.position.y = 1.84;
  g.add(cap);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.68, 0.24), pants);
  legL.position.set(-0.15, 0.34, 0);
  legL.name = 'legL';
  g.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.68, 0.24), pants);
  legR.position.set(0.15, 0.34, 0);
  legR.name = 'legR';
  g.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.6, 0.18), jacket);
  armL.position.set(-0.4, 1.05, 0);
  armL.name = 'armL';
  g.add(armL);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.6, 0.18), jacket);
  armR.position.set(0.4, 1.05, 0);
  armR.name = 'armR';
  g.add(armR);
  return g;
}

export function initPlayer(G) {
  const mesh = makePlayerMesh();
  mesh.position.set(0, 0, 90);
  G.scene.add(mesh);
  G.player = {
    mesh,
    pos: mesh.position,
    x: 0,
    z: 90,
    heading: Math.PI, // face north (-z), toward the city
    health: 100,
    inCar: false,
    car: null,
    hasPistol: false,
    weapon: null,
    speed: 0,
    vx: 0,
    vz: 0,
    walkPhase: 0,
  };
}

export function nearestEnterableCar(G, maxDist) {
  let best = null;
  let bestD = Infinity;
  for (const car of G.cars) {
    if (car.wrecked) continue;
    const dx = car.x - G.player.x;
    const dz = car.z - G.player.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < bestD && d <= maxDist) {
      bestD = d;
      best = car;
    }
  }
  return { car: best, dist: bestD };
}

export function enterCar(G, car) {
  const p = G.player;
  p.inCar = true;
  p.car = car;
  car.parked = false;
  p.heading = car.heading;
  p.x = car.x;
  p.z = car.z;
  p.pos.set(p.x, 0, p.z);
  p.mesh.visible = false;
}

export function exitCar(G) {
  const p = G.player;
  if (!p.inCar || !p.car) return;
  const car = p.car;
  const fwd = headingVec(car.heading);
  p.inCar = false;
  p.car = null;
  p.x = car.x - fwd.z * 2.6;
  p.z = car.z + fwd.x * 2.6;
  p.heading = car.heading;
  p.pos.set(p.x, 0, p.z);
  p.mesh.visible = true;
  p.mesh.position.set(p.x, 0, p.z);
}

export function updatePlayer(G, dt, input) {
  const p = G.player;
  if (p.health <= 0 && G.state === 'playing') {
    G.state = 'busted';
    return;
  }
  if (p.inCar && p.car) {
    // Driving: W forward, S brake/reverse, A/D steer.
    const throttle = (input.w ? 1 : 0) + (input.s ? -1 : 0);
    const steer = (input.a ? -1 : 0) + (input.d ? 1 : 0);
    stepCarDrive(G, p.car, throttle, steer, dt);
    p.x = p.car.x;
    p.z = p.car.z;
    p.heading = p.car.heading;
    p.speed = p.car.speed;
    const fwd = headingVec(p.heading);
    p.vx = fwd.x * p.speed;
    p.vz = fwd.z * p.speed;
    p.pos.set(p.x, 0, p.z);
    if (p.car.wrecked) ejectPlayer(G);
    return;
  }
  // On foot: W walks forward, A/D turn.
  const turning = (input.a ? 1 : 0) + (input.d ? -1 : 0);
  p.heading += turning * 2.6 * dt;
  let move = 0;
  if (input.w) move = WALK_SPEED;
  if (input.s) move = -WALK_SPEED * 0.5;
  const fwd = headingVec(p.heading);
  p.vx = fwd.x * move;
  p.vz = fwd.z * move;
  p.speed = move;
  let nx = p.x + p.vx * dt;
  let nz = p.z + p.vz * dt;
  const res = collideBuildings(G, nx, nz, 0.6);
  nx = res.x;
  nz = res.z;
  const clamped = clampToWorld(nx, nz);
  p.x = clamped.x;
  p.z = clamped.z;
  p.pos.set(p.x, 0, p.z);
  p.mesh.position.set(p.x, 0, p.z);
  p.mesh.rotation.y = p.heading;
  // Walk cycle.
  if (move !== 0) {
    p.walkPhase += dt * 7;
    const swing = Math.sin(p.walkPhase) * 0.5;
    const legL = p.mesh.getObjectByName('legL');
    const legR = p.mesh.getObjectByName('legR');
    const armL = p.mesh.getObjectByName('armL');
    const armR = p.mesh.getObjectByName('armR');
    if (legL) legL.rotation.x = swing;
    if (legR) legR.rotation.x = -swing;
    if (armL) armL.rotation.x = -swing * 0.7;
    if (armR) armR.rotation.x = swing * 0.7;
  }
}
