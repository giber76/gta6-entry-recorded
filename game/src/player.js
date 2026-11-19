// player.js — Marlo Vance on foot: WASD movement, sprint, and the
// third-person camera. Driving lives in vehicles.js; this file only moves
// Marlo while he is walking.

import { collideCircle } from './city.js';
import { clamp as clampNum, turnToward } from './util.js';

const WALK_SPEED = 6;
const SPRINT_SPEED = 10;

function buildMarlo(THREE) {
  const group = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: 0x2e6f8e });
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98d64 });
  const jeans = new THREE.MeshLambertMaterial({ color: 0x2b3a55 });
  const shoes = new THREE.MeshLambertMaterial({ color: 0x1c1c1c });

  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 1.05, 10), jacket);
  torso.position.y = 1.05;
  torso.castShadow = true;
  group.add(torso);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), skin);
  skull.position.y = 1.85;
  skull.castShadow = true;
  group.add(skull);
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.34, 0.12, 12),
    new THREE.MeshLambertMaterial({ color: 0xd8d8d8 })
  );
  cap.position.y = 2.08;
  group.add(cap);
  const shinL = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.7, 8), jeans);
  shinL.position.set(-0.2, 0.35, 0);
  group.add(shinL);
  const shinR = shinL.clone();
  shinR.position.x = 0.2;
  group.add(shinR);
  const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.13, 0.75, 8), jacket);
  armL.position.set(-0.55, 1.15, 0);
  group.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.55;
  group.add(armR);
  return { group, body: torso, head: skull, legL: shinL, legR: shinR, armL, armR };
}

export function createPlayer(G) {
  const THREE = window.THREE;
  const parts = buildMarlo(THREE);
  parts.group.position.set(G.city.locations.start.x, 0, G.city.locations.start.z);
  G.scene.add(parts.group);
  const player = {
    ...parts,
    pos: parts.group.position,
    yaw: Math.PI,
    health: 100,
    cash: 0,
    inCar: false,
    car: null,
    weapon: 'fists', // 'fists' | 'pistol'
    hasPistol: false,
    speed: 0,
    walkPhase: 0,
    punchCooldown: 0,
    shootCooldown: 0,
  };
  G.player = player;
  return player;
}

// Camera-relative movement vector: forward is where the camera looks.
// Returns [mx, mz] and whether Marlo is moving.
function walkVector(G) {
  const input = G.moveInput();
  const sin = Math.sin(G.camYaw);
  const cos = Math.cos(G.camYaw);
  const mx = input.y * sin + input.x * cos;
  const mz = input.y * cos - input.x * sin;
  return [mx, mz, Math.hypot(mx, mz) > 0.01];
}

function swingLimbs(p, swing) {
  p.legL.rotation.x = swing;
  p.legR.rotation.x = -swing;
  p.armL.rotation.x = -swing * 0.7;
  p.armR.rotation.x = swing * 0.7;
}

function settleLimbs(p) {
  p.legL.rotation.x *= 0.8;
  p.legR.rotation.x *= 0.8;
  p.armL.rotation.x *= 0.8;
  p.armR.rotation.x *= 0.8;
}

export function updatePlayer(G, dt) {
  const p = G.player;
  if (p.inCar || p.health <= 0) return;
  p.punchCooldown = Math.max(0, p.punchCooldown - dt);
  p.shootCooldown = Math.max(0, p.shootCooldown - dt);

  const sprint = G.sprinting();
  const speed = sprint ? SPRINT_SPEED : WALK_SPEED;
  const [mx, mz, moving] = walkVector(G);
  p.speed = moving ? speed : 0;
  if (!moving) {
    settleLimbs(p);
    p.group.rotation.y = p.yaw;
    return;
  }
  const nx = p.pos.x + mx * speed * dt;
  const nz = p.pos.z + mz * speed * dt;
  const fixed = collideCircle(G, nx, nz, 0.6);
  p.pos.x = fixed.x;
  p.pos.z = fixed.z;
  p.yaw = turnToward(p.yaw, Math.atan2(mx, mz), dt * 12);
  p.walkPhase += dt * (sprint ? 13 : 9);
  swingLimbs(p, Math.sin(p.walkPhase) * (sprint ? 0.7 : 0.5));
  p.group.rotation.y = p.yaw;
}

// Where the camera wants to be: behind and above the target, at a
// distance and height that depend on whether Marlo is driving.
function cameraRig(G, dt) {
  const p = G.player;
  if (p.inCar && p.car) {
    const carYaw = p.car.heading;
    let dy = carYaw - G.camYaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    G.camYaw += dy * Math.min(1, dt * 1.6);
    return { target: p.car.group.position, dist: 11, height: 4.6 };
  }
  return { target: p.pos, dist: 8.5, height: 3.6 };
}

// Third-person orbit camera. Drag the mouse to look; while driving it
// trails behind the car so turns feel smooth.
export function updateCamera(G, dt) {
  const THREE = window.THREE;
  const p = G.player;
  G.camYaw -= G.lookDX * 0.005;
  G.camPitch = clampNum((G.camPitch ?? 0.32) - G.lookDY * 0.004, -0.15, 1.1);
  G.lookDX = 0;
  G.lookDY = 0;

  const rig = cameraRig(G, dt);
  const target = rig.target;
  const yaw = G.camYaw;
  const pitch = G.camPitch ?? 0.32;
  const dist = rig.dist;
  const cx = target.x - Math.sin(yaw) * Math.cos(pitch) * dist;
  const cz = target.z - Math.cos(yaw) * Math.cos(pitch) * dist;
  const cy = (target.y || 0) + 1.6 + Math.sin(pitch) * dist;
  const camPos = new THREE.Vector3(cx, Math.max(cy, 1.2), cz);
  G.camera.position.lerp(camPos, Math.min(1, dt * 10));
  G.camera.lookAt(target.x, (target.y || 0) + 1.6, target.z);
}

export function damagePlayer(G, amount, cause) {
  const p = G.player;
  if (p.health <= 0 || G.state !== 'playing') return;
  p.health = Math.max(0, p.health - amount);
  G.hudFlash = 1;
  if (p.health <= 0) {
    G.state = 'busted';
    if (G.audio) G.audio.busted();
    if (G.onBusted) G.onBusted(cause);
  }
}

export function healPlayer(G, amount) {
  G.player.health = Math.min(100, G.player.health + amount);
}
