// vehicles.js — arcade car physics + damage for Solara Bay.
// A car is a small Three.js group (body, cabin, wheels, light bar for
// police) driven by a simple forward-speed + heading model that slides
// along buildings instead of stopping dead.
//
// Heading convention: forward = (sin h, 0, cos h). h = 0 faces +z (south),
// h = PI/2 faces +x (east), h = PI faces -z (north). Pressing D (steer +1)
// turns right, which DECREASES h; A (steer -1) turns left.
import * as THREE from 'three';
import { clamp, forwardOf } from './util.js';

const WHEEL_GEO = new THREE.CylinderGeometry(0.34, 0.34, 0.26, 10);
WHEEL_GEO.rotateZ(Math.PI / 2);
const WHEEL_MAT = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.9 });
const GLASS_MAT = new THREE.MeshStandardMaterial({ color: 0x1a2a3a, roughness: 0.15, metalness: 0.4 });

export const CAR_TOP_SPEED = 46; // m/s (~166 km/h)
export const CAR_ACCEL = 24; // m/s^2
export const CAR_BRAKE = 34;
export const CAR_REVERSE_SPEED = 12;

let carSeq = 0;

export class Car {
  constructor(scene, opts = {}) {
    this.id = ++carSeq;
    this.scene = scene;
    this.kind = opts.kind || 'traffic'; // traffic | parked | police | mission | player
    this.color = opts.color ?? 0xcccccc;
    this.x = opts.x ?? 0;
    this.z = opts.z ?? 0;
    this.heading = opts.heading ?? 0;
    this.speed = 0; // signed m/s along heading
    this.health = 100;
    this.wrecked = false;
    this.wreckTimer = 0;
    this.respawnAt = null; // {x, z, heading} for traffic respawn
    this.ramCooldown = 0;
    this.group = new THREE.Group();
    this._buildMesh(opts);
    this.group.position.set(this.x, 0, this.z);
    this.group.rotation.y = this.heading;
    scene.add(this.group);
  }

  _buildMesh(opts) {
    const bodyMat = new THREE.MeshStandardMaterial({ color: this.color, roughness: 0.35, metalness: 0.55 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.62, 4.3), bodyMat);
    body.position.y = 0.62;
    this.group.add(body);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.55, 2.1), GLASS_MAT);
    cabin.position.set(0, 1.12, -0.25);
    this.group.add(cabin);
    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.14, 1.1), bodyMat);
    hood.position.set(0, 0.98, 1.45);
    this.group.add(hood);
    const lightMat = new THREE.MeshStandardMaterial({ color: 0xfff2b0, emissive: 0xffedb0, emissiveIntensity: 0.5 });
    for (const sx of [-0.62, 0.62]) {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.08), lightMat);
      hl.position.set(sx, 0.68, 2.16);
      this.group.add(hl);
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.08), new THREE.MeshStandardMaterial({ color: 0xaa1111, emissive: 0x660000, emissiveIntensity: 0.6 }));
      tl.position.set(sx, 0.68, -2.16);
      this.group.add(tl);
    }
    this.wheels = [];
    for (const [wx, wz] of [[-0.85, 1.35], [0.85, 1.35], [-0.85, -1.35], [0.85, -1.35]]) {
      const w = new THREE.Mesh(WHEEL_GEO, WHEEL_MAT);
      w.position.set(wx, 0.34, wz);
      this.group.add(w);
      this.wheels.push(w);
    }
    if (this.kind === 'police') {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.18, 0.4), new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.4 }));
      bar.position.set(0, 1.5, -0.25);
      this.group.add(bar);
      this.lightL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.42), new THREE.MeshStandardMaterial({ color: 0xff2222, emissive: 0xff0000, emissiveIntensity: 2 }));
      this.lightL.position.set(-0.28, 1.5, -0.25);
      this.group.add(this.lightL);
      this.lightR = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.42), new THREE.MeshStandardMaterial({ color: 0x2244ff, emissive: 0x0000ff, emissiveIntensity: 2 }));
      this.lightR.position.set(0.28, 1.5, -0.25);
      this.group.add(this.lightR);
    }
    // blob shadow (cheap ground contact)
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 5), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2;
    sh.position.y = 0.02;
    this.group.add(sh);
    this.bodyMat = bodyMat;
  }

  // One arcade step: throttle 0..1 (W), brake 0..1 (S), steer -1..1 (A=-1, D=+1).
  drive(throttle, brake, steer, dt) {
    if (this.wrecked) return;
    const top = this.kind === 'police' ? CAR_TOP_SPEED * 0.86 : CAR_TOP_SPEED;
    if (throttle > 0) this.speed += CAR_ACCEL * throttle * dt;
    if (brake > 0) {
      if (this.speed > 0.5) this.speed -= CAR_BRAKE * brake * dt;
      else this.speed -= CAR_ACCEL * 0.55 * brake * dt; // reverse
    }
    if (throttle <= 0 && brake <= 0) {
      this.speed -= this.speed * 0.6 * dt;
      if (Math.abs(this.speed) < 0.05) this.speed = 0;
    }
    this.speed = clamp(this.speed, -CAR_REVERSE_SPEED, top);
    // Steering: sharper at low speed, gentler at top speed. D (+1) turns
    // right (heading decreases); reversing flips the sense.
    const dir = this.speed >= 0 ? 1 : -1;
    const rate = 2.3 * clamp(1.05 - (Math.abs(this.speed) / CAR_TOP_SPEED) * 0.6, 0.45, 1);
    this.heading -= steer * rate * dt * dir;
    const f = forwardOf(this.heading);
    this.x += f.x * this.speed * dt;
    this.z += f.z * this.speed * dt;
  }

  // Kinematic step used by AI cars that set speed/heading directly.
  move(dt) {
    if (this.wrecked) return;
    const f = forwardOf(this.heading);
    this.x += f.x * this.speed * dt;
    this.z += f.z * this.speed * dt;
  }

  sync(dt, t) {
    this.group.position.set(this.x, 0, this.z);
    this.group.rotation.y = this.heading;
    const spin = (this.speed * dt) / 0.34;
    for (const w of this.wheels) w.rotation.x += spin;
    if (this.kind === 'police' && this.lightL) {
      const on = Math.floor(t * 4) % 2 === 0;
      this.lightL.material.emissiveIntensity = on ? 2.4 : 0.25;
      this.lightR.material.emissiveIntensity = on ? 0.25 : 2.4;
    }
    if (this.ramCooldown > 0) this.ramCooldown -= dt;
  }

  damage(n) {
    if (this.wrecked) return false;
    this.health = Math.max(0, this.health - n);
    if (this.health <= 0) {
      this.wrecked = true;
      this.wreckTimer = 0;
      this.speed = 0;
      return true; // just wrecked
    }
    return false;
  }

  repair() {
    this.health = 100;
    this.wrecked = false;
    this.wreckTimer = 0;
  }

  get speedKmh() {
    return Math.abs(this.speed) * 3.6;
  }
}
