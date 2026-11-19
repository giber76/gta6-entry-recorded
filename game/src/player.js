// player.js — Marlo Vance on foot: WASD movement, sprint, and the third-person camera.
// Driving is handled by vehicles.js; this file only moves the player when on foot.

import { collideCircle } from './city.js';
import { clamp as clampNum, turnToward } from './util.js';

export function createPlayer(G) {
  const THREE = window.THREE;
  const group = new THREE.Group();

  const jacket = new THREE.MeshLambertMaterial({ color: 0x2e6f8e });
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98d64 });
  const jeans = new THREE.MeshLambertMaterial({ color: 0x2b3a55 });
  const shoes = new THREE.MeshLambertMaterial({ color: 0x1c1c1c });

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 1.05, 10), jacket);
  body.position.y = 1.05;
  body.castShadow = true;
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), skin);
  head.position.y = 1.85;
  head.castShadow = true;
  group.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.12, 12), new THREE.MeshLambertMaterial({ color: 0xd8d8d8 }));
  cap.position.y = 2.08;
  group.add(cap);
  const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.7, 8), jeans);
  legL.position.set(-0.2, 0.35, 0);
  group.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.2;
  group.add(legR);
  const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.13, 0.75, 8), jacket);
  armL.position.set(-0.55, 1.15, 0);
  group.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.55;
  group.add(armR);

  group.position.set(G.city.locations.start.x, 0, G.city.locations.start.z);
  G.scene.add(group);

  const player = {
    group,
    body,
    head,
    legL,
    legR,
    armL,
    armR,
    pos: group.position,
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

export function updatePlayer(G, dt) {
  const p = G.player;
  if (p.inCar || p.health <= 0) return;
  p.punchCooldown = Math.max(0, p.punchCooldown - dt);
  p.shootCooldown = Math.max(0, p.shootCooldown - dt);

  const input = G.moveInput();
  const sprint = G.sprinting();
  const speed = sprint ? 10 : 6;
  // Camera-relative movement: forward is where the camera looks.
  const sin = Math.sin(G.camYaw);
  const cos = Math.cos(G.camYaw);
  const mx = input.y * sin + input.x * cos;
  const mz = input.y * cos - input.x * sin;
  const moving = Math.hypot(mx, mz) > 0.01;
  p.speed = moving ? speed : 0;
  if (moving) {
    const nx = p.pos.x + mx * speed * dt;
    const nz = p.pos.z + mz * speed * dt;
    const fixed = collideCircle(G, nx, nz, 0.6);
    p.pos.x = fixed.x;
    p.pos.z = fixed.z;
    const targetYaw = Math.atan2(mx, mz);
    p.yaw = turnToward(p.yaw, targetYaw, dt * 12);
    p.walkPhase += dt * (sprint ? 13 : 9);
    const swing = Math.sin(p.walkPhase) * (sprint ? 0.7 : 0.5);
    p.legL.rotation.x = swing;
    p.legR.rotation.x = -swing;
    p.armL.rotation.x = -swing * 0.7;
    p.armR.rotation.x = swing * 0.7;
  } else {
    p.legL.rotation.x *= 0.8;
    p.legR.rotation.x *= 0.8;
    p.armL.rotation.x *= 0.8;
    p.armR.rotation.x *= 0.8;
  }
  p.group.rotation.y = p.yaw;
}

// Third-person orbit camera. Drag the mouse to look; while driving it trails the car.
export function updateCamera(G, dt) {
  const THREE = window.THREE;
  const p = G.player;
  G.camYaw -= G.lookDX * 0.005;
  G.camPitch = clampNum((G.camPitch ?? 0.32) - G.lookDY * 0.004, -0.15, 1.1);
  G.lookDX = 0;
  G.lookDY = 0;

  let target;
  let desiredYaw;
  let dist = 8.5;
  let height = 3.6;
  if (p.inCar && p.car) {
    target = p.car.group.position;
    // Trail behind the car's heading, easing toward it so turns feel smooth.
    const carYaw = p.car.heading;
    let dy = carYaw - G.camYaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    G.camYaw += dy * Math.min(1, dt * 1.6);
    desiredYaw = G.camYaw;
    dist = 11;
    height = 4.6;
  } else {
    target = p.pos;
    desiredYaw = G.camYaw;
  }
  const yaw = desiredYaw;
  const pitch = G.camPitch ?? 0.32;
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
