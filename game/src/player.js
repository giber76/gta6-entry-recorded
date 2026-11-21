// player.js — Marlo, the player character.
// On foot he walks with W and turns with A/D (or the mouse); in a car he
// drives it. E enters/exits the nearest car. The pistol fires along the
// camera, and the raycast skips his own car.
import * as THREE from 'three';
import { clamp, forwardOf, dist2 } from './util.js';

export const WALK_SPEED = 7; // m/s — 2 game-s of W moves >10 m
export const PISTOL_DAMAGE = 15;
export const PISTOL_RANGE = 70;
export const PISTOL_COOLDOWN = 0.25;

export class Player {
  constructor(scene) {
    this.scene = scene;
    this.x = 0;
    this.z = 60;
    this.heading = Math.PI; // face north (-z) along road x=0
    this.health = 100;
    this.cash = 0;
    this.inCar = false;
    this.car = null;
    this.hasPistol = false;
    this.weapon = null;
    this.pistolCooldown = 0;
    this.walkPhase = 0;
    this.group = new THREE.Group();
    this._buildMesh();
    this.group.position.set(this.x, 0, this.z);
    scene.add(this.group);
  }

  _buildMesh() {
    const jacket = new THREE.MeshStandardMaterial({ color: 0x2a9d8f, roughness: 0.7 });
    const pants = new THREE.MeshStandardMaterial({ color: 0x2b2d42, roughness: 0.8 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xd9a066, roughness: 0.7 });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.78, 0.34), jacket);
    torso.position.y = 1.12;
    this.group.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), skin);
    head.position.y = 1.68;
    this.group.add(head);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.26, 0.12, 10), new THREE.MeshStandardMaterial({ color: 0xe76f51, roughness: 0.7 }));
    cap.position.y = 1.86;
    this.group.add(cap);
    this.legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.72, 0.26), pants);
    this.legL.position.set(-0.16, 0.36, 0);
    this.group.add(this.legL);
    this.legR = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.72, 0.26), pants);
    this.legR.position.set(0.16, 0.36, 0);
    this.group.add(this.legR);
    const armMat = jacket;
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.62, 0.2), armMat);
    armL.position.set(-0.42, 1.12, 0);
    this.group.add(armL);
    const armR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.62, 0.2), armMat);
    armR.position.set(0.42, 1.12, 0);
    this.group.add(armR);
    const sh = new THREE.Mesh(new THREE.CircleGeometry(0.55, 16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2;
    sh.position.y = 0.02;
    this.group.add(sh);
  }

  get speedKmh() {
    return this.inCar && this.car ? this.car.speedKmh : 0;
  }

  // On-foot step: forward/back with W/S, turn with A/D, mouse steers too.
  walk(fwd, strafe, turn, mouseDX, dt) {
    this.heading -= turn * 2.4 * dt;
    this.heading -= mouseDX * 0.0035;
    const f = forwardOf(this.heading);
    const mx = f.x * fwd + f.z * strafe;
    const mz = f.z * fwd - f.x * strafe;
    const len = Math.hypot(mx, mz);
    if (len > 0.01) {
      const s = WALK_SPEED * dt;
      this.x += (mx / len) * s;
      this.z += (mz / len) * s;
      this.walkPhase += dt * 9;
    }
    this.group.position.set(this.x, 0, this.z);
    this.group.rotation.y = this.heading;
    const swing = len > 0.01 ? Math.sin(this.walkPhase) * 0.45 : 0;
    this.legL.rotation.x = swing;
    this.legR.rotation.x = -swing;
  }

  teleport(x, z, heading) {
    this.x = x;
    this.z = z;
    if (heading !== undefined) this.heading = heading;
    if (this.inCar && this.car) {
      this.car.x = x;
      this.car.z = z;
      this.car.heading = this.heading;
    }
    this.group.position.set(this.x, 0, this.z);
    this.group.rotation.y = this.heading;
  }

  enterCar(car) {
    this.inCar = true;
    this.car = car;
    this.x = car.x;
    this.z = car.z;
    this.heading = car.heading;
    this.group.visible = false;
  }

  exitCar() {
    if (!this.car) return;
    const f = forwardOf(this.car.heading);
    // step out on the driver's (left) side
    this.x = this.car.x - f.z * 2.2;
    this.z = this.car.z + f.x * 2.2;
    this.heading = this.car.heading;
    this.inCar = false;
    this.car = null;
    this.group.visible = true;
    this.group.position.set(this.x, 0, this.z);
    this.group.rotation.y = this.heading;
  }

  givePistol() {
    this.hasPistol = true;
    this.weapon = 'pistol';
  }

  heal() {
    this.health = 100;
  }

  hurt(n) {
    this.health = Math.max(0, this.health - n);
  }

  sync(dt) {
    if (this.pistolCooldown > 0) this.pistolCooldown -= dt;
    if (!this.inCar) {
      this.group.position.set(this.x, 0, this.z);
      this.group.rotation.y = this.heading;
    }
  }

  // Aim point for the pistol: from the shooter's chest, along the camera.
  aimOrigin(camDir) {
    if (this.inCar && this.car) {
      return { x: this.car.x + camDir.x * 2.0, y: 1.25, z: this.car.z + camDir.z * 2.0 };
    }
    return { x: this.x, y: 1.45, z: this.z };
  }
}

// Ray vs a sphere (car body / viper torso). Returns distance or Infinity.
export function raySphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, r) {
  const lx = cx - ox;
  const ly = cy - oy;
  const lz = cz - oz;
  const tca = lx * dx + ly * dy + lz * dz;
  if (tca < 0) return Infinity;
  const d2 = lx * lx + ly * ly + lz * lz - tca * tca;
  const r2 = r * r;
  if (d2 > r2) return Infinity;
  return tca - Math.sqrt(r2 - d2);
}
