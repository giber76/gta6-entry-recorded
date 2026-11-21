// vehicles.js — car bodies, arcade driving physics, damage and wrecks.
// A car is a small Group of shared-geometry boxes. Physics is arcade:
// strong acceleration, speed-sensitive steering, gentle collisions.
import * as THREE from 'three';
import { clamp, forwardOf } from './util.js';

const bodyGeo = new THREE.BoxGeometry(2.0, 0.62, 4.4);
const cabinGeo = new THREE.BoxGeometry(1.7, 0.55, 2.2);
const wheelGeo = new THREE.BoxGeometry(1.9, 0.5, 0.55);
const wheelGeoFront = new THREE.BoxGeometry(1.9, 0.5, 0.55);

const paintCache = new Map();
function paint(color) {
  if (!paintCache.has(color)) {
    paintCache.set(color, new THREE.MeshLambertMaterial({ color }));
  }
  return paintCache.get(color);
}
const glassMat = new THREE.MeshLambertMaterial({ color: 0x1a2530 });
const wheelMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
const lightMat = new THREE.MeshBasicMaterial({ color: 0xffe9a0 });

export const CAR_COLORS = {
  coupe: 0xc23a2e,
  sedan: 0x3a6ac2,
  taxi: 0xd8b93a,
  truck: 0x7a7a7a,
  police: 0x222831,
  boss: 0x111111,
  getaway: 0x2e7a4a,
};

export class Car {
  constructor(type, color, x, z, heading) {
    this.type = type;
    this.group = new THREE.Group();
    this.body = new THREE.Mesh(bodyGeo, paint(color));
    this.body.position.y = 0.55;
    this.group.add(this.body);
    this.cabin = new THREE.Mesh(cabinGeo, glassMat);
    this.cabin.position.set(0, 1.05, -0.25);
    this.group.add(this.cabin);
    this.wheelsF = new THREE.Mesh(wheelGeoFront, wheelMat);
    this.wheelsF.position.set(0, 0.28, 1.45);
    this.group.add(this.wheelsF);
    this.wheelsR = new THREE.Mesh(wheelGeo, wheelMat);
    this.wheelsR.position.set(0, 0.28, -1.45);
    this.group.add(this.wheelsR);
    const head = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.16, 0.1), lightMat);
    head.position.set(0, 0.62, 2.21);
    this.group.add(head);
    const tail = new THREE.Mesh(
      new THREE.BoxGeometry(1.7, 0.14, 0.08),
      new THREE.MeshBasicMaterial({ color: 0xc22a2a }),
    );
    tail.position.set(0, 0.62, -2.21);
    this.group.add(tail);
    this.group.position.set(x, 0, z);
    this.group.rotation.y = heading;
    this.x = x;
    this.z = z;
    this.heading = heading;
    this.speed = 0; // m/s, forward positive
    this.health = 100;
    this.wrecked = false;
    this.wreckTimer = 0;
    this.damageCooldown = 0;
    this.smoking = false;
    this.burning = false;
    this.topSpeed = 46; // m/s (~166 km/h)
    this.accel = 26;
    this.brake = 42;
    this.reverseTop = 12;
  }

  get speedKmh() {
    return Math.abs(this.speed) * 3.6;
  }

  // Drive with arcade input. `input` = {forward, back, left, right} bools.
  // dt is a small fixed substep. Returns nothing.
  drive(input, dt) {
    if (this.wrecked) {
      this.speed *= Math.max(0, 1 - 3 * dt);
      return;
    }
    if (input.forward) this.speed += this.accel * dt;
    else if (input.back) {
      if (this.speed > 0.5) this.speed -= this.brake * dt;
      else this.speed -= this.accel * 0.45 * dt;
    } else {
      // Coast down gently.
      this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 9 * dt);
    }
    this.speed = clamp(this.speed, -this.reverseTop, this.topSpeed);
    // Steering: stronger at low speed, gentler at top speed.
    const steerAuthority = clamp(1.15 - Math.abs(this.speed) / this.topSpeed, 0.35, 1.15);
    const turnRate = 2.1 * steerAuthority * clamp(Math.abs(this.speed) / 6, 0, 1);
    if (input.left) this.heading += turnRate * dt * Math.sign(this.speed || 1);
    if (input.right) this.heading -= turnRate * dt * Math.sign(this.speed || 1);
    const f = forwardOf(this.heading);
    this.x += f.x * this.speed * dt;
    this.z += f.z * this.speed * dt;
    this.sync();
  }

  sync() {
    this.group.position.set(this.x, 0, this.z);
    this.group.rotation.y = this.heading;
  }

  teleport(x, z, heading) {
    this.x = x;
    this.z = z;
    this.heading = heading;
    this.speed = 0;
    this.sync();
  }

  damage(amount, effects, atX, atZ) {
    if (this.wrecked || this.damageCooldown > 0) return false;
    this.damageCooldown = 0.35;
    this.health -= amount;
    if (this.health < 50) this.smoking = true;
    if (this.health < 25) this.burning = true;
    if (this.health <= 0) {
      this.health = 0;
      this.wreck();
      if (effects) effects.explode(this.x, this.z);
      return true;
    }
    return false;
  }

  wreck() {
    this.wrecked = true;
    this.wreckTimer = 0;
    this.speed = 0;
    // Tip the wreck slightly and darken it.
    this.group.rotation.z = 0.1;
    this.body.material = paint(0x2a2a2a);
  }

  repair() {
    this.health = 100;
    this.wrecked = false;
    this.smoking = false;
    this.burning = false;
    this.wreckTimer = 0;
    this.group.rotation.z = 0;
  }

  respawn(x, z, heading) {
    this.repair();
    this.teleport(x, z, heading);
  }
}

// Circle-vs-circle push for two cars. Returns true if they touched.
export function collideCars(a, b, minDist = 3.4) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const d2 = dx * dx + dz * dz;
  if (d2 >= minDist * minDist || d2 < 1e-6) return false;
  const d = Math.sqrt(d2);
  const push = (minDist - d) / 2;
  const nx = dx / d;
  const nz = dz / d;
  a.x -= nx * push;
  a.z -= nz * push;
  b.x += nx * push;
  b.z += nz * push;
  a.sync();
  b.sync();
  return true;
}
