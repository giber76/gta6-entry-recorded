// player.js — Marlo Vance on foot: WASD movement, sprint, and the
// third-person camera. Driving lives in vehicles.js; this file only moves
// Marlo while he is walking. The camera shakes with the explosion
// magnitude the effects system reports each frame, and it trails behind
// the car while driving.

import { collideCircle } from './city.js';
import { clamp as clampNum, turnToward } from './util.js';
import { shakeOffset } from './effects.js';

const SPEEDS = { walk: 6, sprint: 10 };

// Marlo's body, as a parts table: [shape, skin, x, y, z, castShadow?].
function buildMarlo(THREE) {
  const group = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: 0x2e6f8e });
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98d64 });
  const jeans = new THREE.MeshLambertMaterial({ color: 0x2b3a55 });
  const capSkin = new THREE.MeshLambertMaterial({ color: 0xd8d8d8 });
  const plan = [
    [new THREE.CylinderGeometry(0.42, 0.5, 1.05, 10), jacket, 0, 1.05, 0, true],
    [new THREE.SphereGeometry(0.32, 12, 10), skin, 0, 1.85, 0, true],
    [new THREE.CylinderGeometry(0.34, 0.34, 0.12, 12), capSkin, 0, 2.08, 0, false],
    [new THREE.CylinderGeometry(0.16, 0.18, 0.7, 8), jeans, -0.2, 0.35, 0, false],
    [new THREE.CylinderGeometry(0.12, 0.13, 0.75, 8), jacket, -0.55, 1.15, 0, false],
  ];
  const built = [];
  for (const [shape, mat, x, y, z, shadow] of plan) {
    const piece = new THREE.Mesh(shape, mat);
    piece.position.set(x, y, z);
    piece.castShadow = shadow;
    group.add(piece);
    built.push(piece);
  }
  const shinR = built[3].clone();
  shinR.position.x = 0.2;
  group.add(shinR);
  const armR = built[4].clone();
  armR.position.x = 0.55;
  group.add(armR);
  return { group, body: built[0], head: built[1], legL: built[3], legR: shinR, armL: built[4], armR };
}

export function createPlayer(game) {
  const THREE = window.THREE;
  const parts = buildMarlo(THREE);
  parts.group.position.set(game.city.locations.start.x, 0, game.city.locations.start.z);
  game.scene.add(parts.group);
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
  game.player = player;
  return player;
}

// Camera-relative movement vector: forward is where the camera looks.
// Returns [mx, mz] and whether Marlo is moving.
function walkVector(game) {
  const input = game.moveInput();
  const sin = Math.sin(game.camYaw);
  const cos = Math.cos(game.camYaw);
  const mx = input.y * sin + input.x * cos;
  const mz = input.y * cos - input.x * sin;
  return [mx, mz, Math.hypot(mx, mz) > 0.01];
}

function poseLimbs(p, swing) {
  p.legL.rotation.x = swing;
  p.legR.rotation.x = -swing;
  p.armL.rotation.x = -swing * 0.7;
  p.armR.rotation.x = swing * 0.7;
}

function relaxLimbs(p) {
  p.legL.rotation.x *= 0.8;
  p.legR.rotation.x *= 0.8;
  p.armL.rotation.x *= 0.8;
  p.armR.rotation.x *= 0.8;
}

// A slow heartbeat when Marlo is badly hurt (below 25 health),
// once per second, so the danger is audible as well as visible.
function heartbeatCheck(game, p, dt) {
  if (p.health < 25) {
    p.heartTimer = (p.heartTimer || 0) - dt;
    if (p.heartTimer <= 0) {
      p.heartTimer = 1;
      if (game.audio) game.audio.heartbeat();
    }
  } else {
    p.heartTimer = 0;
  }
}

// Out of combat for a while, Marlo slowly patches himself up
// (1 HP per second after 10 seconds without taking damage).
function regenCheck(game, p, dt) {
  p.regenTimer = (p.regenTimer || 0) + dt;
  if (p.regenTimer > 10 && p.health < 100) {
    healPlayer(game, dt * 1);
  }
}

export function updatePlayer(game, dt) {
  const p = game.player;
  if (p.inCar || p.health <= 0) return;
  p.punchCooldown = Math.max(0, p.punchCooldown - dt);
  p.shootCooldown = Math.max(0, p.shootCooldown - dt);
  heartbeatCheck(game, p, dt);
  regenCheck(game, p, dt);

  const sprint = game.sprinting();
  const speed = sprint ? SPEEDS.sprint : SPEEDS.walk;
  const [mx, mz, moving] = walkVector(game);
  p.speed = moving ? speed : 0;
  if (!moving) {
    relaxLimbs(p);
    p.group.rotation.y = p.yaw;
    return;
  }
  const nx = p.pos.x + mx * speed * dt;
  const nz = p.pos.z + mz * speed * dt;
  const fixed = collideCircle(game, nx, nz, 0.6);
  p.pos.x = fixed.x;
  p.pos.z = fixed.z;
  p.yaw = turnToward(p.yaw, Math.atan2(mx, mz), dt * 12);
  p.walkPhase += dt * (sprint ? 13 : 9);
  poseLimbs(p, Math.sin(p.walkPhase) * (sprint ? 0.7 : 0.5));
  p.group.rotation.y = p.yaw;
}

// Where the camera wants to be: behind and above the target, at a
// distance and height that depend on whether Marlo is driving.
function cameraRig(game, dt) {
  const p = game.player;
  if (p.inCar && p.car) {
    const carYaw = p.car.heading;
    let dy = carYaw - game.camYaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    game.camYaw += dy * Math.min(1, dt * 1.6);
    return { target: p.car.group.position, dist: 11, height: 4.6 };
  }
  return { target: p.pos, dist: 8.5, height: 3.6 };
}

// Third-person orbit camera. Drag the mouse to look; while driving it
// trails behind the car so turns feel smooth. Explosions shake it.
export function updateCamera(game, dt) {
  const THREE = window.THREE;
  const p = game.player;
  game.camYaw -= game.lookDX * 0.005;
  game.camPitch = clampNum((game.camPitch ?? 0.32) - game.lookDY * 0.004, -0.15, 1.1);
  game.lookDX = 0;
  game.lookDY = 0;

  const rig = cameraRig(game, dt);
  const target = rig.target;
  const yaw = game.camYaw;
  const pitch = game.camPitch ?? 0.32;
  const dist = rig.dist;
  const cx = target.x - Math.sin(yaw) * Math.cos(pitch) * dist;
  const cz = target.z - Math.cos(yaw) * Math.cos(pitch) * dist;
  const cy = (target.y || 0) + 1.6 + Math.sin(pitch) * dist;
  const camPos = new THREE.Vector3(cx, Math.max(cy, 1.2), cz);
  // Explosion shake: a random offset that decays with the shake magnitude.
  const shake = shakeOffset(game);
  camPos.x += shake.x;
  camPos.y += shake.y;
  game.camera.position.lerp(camPos, Math.min(1, dt * 10));
  game.camera.lookAt(target.x, (target.y || 0) + 1.6, target.z);
}

export function damagePlayer(game, amount, cause) {
  const p = game.player;
  if (p.health <= 0 || game.state !== 'playing') return;
  p.health = Math.max(0, p.health - amount);
  p.regenTimer = 0; // Taking damage restarts the regen clock.
  game.hudFlash = 1;
  if (p.health <= 0) {
    game.state = 'busted';
    if (game.audio) game.audio.busted();
    if (game.onBusted) game.onBusted(cause);
  }
}

export function healPlayer(game, amount) {
  game.player.health = Math.min(100, game.player.health + amount);
}
