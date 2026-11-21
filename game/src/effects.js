// effects.js — pooled particles (explosions, smoke, fire, sparks), camera
// shake, muzzle flash and the damage vignette. One THREE.Points pool,
// recycled, so explosions cost no allocations at run time.
import * as THREE from 'three';
import { makeRng } from './util.js';

const POOL = 600;

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.rng = makeRng(4242);
    this.pos = new Float32Array(POOL * 3);
    this.col = new Float32Array(POOL * 3);
    this.vel = new Float32Array(POOL * 3);
    this.life = new Float32Array(POOL);
    this.maxLife = new Float32Array(POOL);
    this.size = new Float32Array(POOL);
    this.head = 0;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.points = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        size: 0.55,
        vertexColors: true,
        transparent: true,
        opacity: 0.92,
        depthWrite: false,
        sizeAttenuation: true,
      }),
    );
    this.points.frustumCulled = false;
    // Park every particle far underground until used.
    for (let i = 0; i < POOL; i++) this.pos[i * 3 + 1] = -100;
    scene.add(this.points);
    this.shakeTime = 0;
    this.shakeStrength = 0;
    this.flash = null;
    // Damage vignette (DOM overlay, driven from main.js via setVignette).
    this.vignetteEl = document.getElementById('vignette');
  }

  spawn(x, y, z, vx, vy, vz, life, r, g, b) {
    const i = this.head;
    this.head = (this.head + 1) % POOL;
    this.pos[i * 3] = x;
    this.pos[i * 3 + 1] = y;
    this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx;
    this.vel[i * 3 + 1] = vy;
    this.vel[i * 3 + 2] = vz;
    this.life[i] = life;
    this.maxLife[i] = life;
    this.col[i * 3] = r;
    this.col[i * 3 + 1] = g;
    this.col[i * 3 + 2] = b;
  }

  explode(x, z) {
    // Fireball: hot orange/yellow burst.
    for (let i = 0; i < 70; i++) {
      const a = this.rng.next() * Math.PI * 2;
      const sp = this.rng.range(2, 11);
      this.spawn(
        x, 1.2, z,
        Math.cos(a) * sp, this.rng.range(1, 9), Math.sin(a) * sp,
        this.rng.range(0.5, 1.1), 1.0, this.rng.range(0.35, 0.65), 0.08,
      );
    }
    // Smoke column: slow grey risers.
    for (let i = 0; i < 40; i++) {
      this.spawn(
        x + this.rng.range(-1.5, 1.5), 1.5 + this.rng.range(0, 2), z + this.rng.range(-1.5, 1.5),
        this.rng.range(-0.6, 0.6), this.rng.range(2.5, 5), this.rng.range(-0.6, 0.6),
        this.rng.range(1.2, 2.4), 0.22, 0.22, 0.24,
      );
    }
    // Sparks: fast bright streaks.
    for (let i = 0; i < 30; i++) {
      const a = this.rng.next() * Math.PI * 2;
      const sp = this.rng.range(12, 26);
      this.spawn(
        x, 1.0, z,
        Math.cos(a) * sp, this.rng.range(3, 12), Math.sin(a) * sp,
        this.rng.range(0.25, 0.6), 1.0, 0.85, 0.4,
      );
    }
    this.shake(0.7, 1.0);
    // Light flash: a quick additive sprite.
    if (!this.flash) {
      const cv = document.createElement('canvas');
      cv.width = 64;
      cv.height = 64;
      const g = cv.getContext('2d');
      const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
      grad.addColorStop(0, 'rgba(255,240,180,1)');
      grad.addColorStop(1, 'rgba(255,140,40,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, 64, 64);
      const tex = new THREE.CanvasTexture(cv);
      this.flash = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }),
      );
      this.flash.scale.set(16, 16, 1);
      this.scene.add(this.flash);
    }
    this.flash.position.set(x, 2.5, z);
    this.flash.material.opacity = 1;
    this.flash.userData.ttl = 0.35;
  }

  smokePuff(x, y, z) {
    for (let i = 0; i < 3; i++) {
      this.spawn(
        x + this.rng.range(-0.4, 0.4), y, z + this.rng.range(-0.4, 0.4),
        this.rng.range(-0.3, 0.3), this.rng.range(1.5, 3), this.rng.range(-0.3, 0.3),
        this.rng.range(0.8, 1.6), 0.25, 0.25, 0.26,
      );
    }
  }

  muzzle(x, y, z, dirX, dirZ) {
    for (let i = 0; i < 6; i++) {
      this.spawn(
        x, y, z,
        dirX * this.rng.range(6, 12) + this.rng.range(-1, 1),
        this.rng.range(-0.5, 1.5),
        dirZ * this.rng.range(6, 12) + this.rng.range(-1, 1),
        0.12, 1.0, 0.8, 0.3,
      );
    }
  }

  shake(duration, strength) {
    this.shakeTime = Math.max(this.shakeTime, duration);
    this.shakeStrength = Math.max(this.shakeStrength, strength);
  }

  shakeOffset() {
    if (this.shakeTime <= 0) return { x: 0, y: 0 };
    const s = this.shakeStrength * (this.shakeTime / 0.7);
    return {
      x: (this.rng.next() - 0.5) * 0.5 * s,
      y: (this.rng.next() - 0.5) * 0.35 * s,
    };
  }

  setVignette(amount) {
    if (this.vignetteEl) {
      this.vignetteEl.style.opacity = String(Math.max(0, Math.min(1, amount)));
    }
  }

  update(dt) {
    for (let i = 0; i < POOL; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.pos[i * 3 + 1] = -100;
        continue;
      }
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.vel[i * 3 + 1] -= 2.5 * dt; // light gravity on sparks, smoke rises anyway
      this.vel[i * 3] *= 1 - 0.4 * dt;
      this.vel[i * 3 + 2] *= 1 - 0.4 * dt;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
    if (this.shakeTime > 0) {
      this.shakeTime -= dt;
      if (this.shakeTime <= 0) this.shakeStrength = 0;
    }
    if (this.flash && this.flash.userData.ttl > 0) {
      this.flash.userData.ttl -= dt;
      this.flash.material.opacity = Math.max(0, this.flash.userData.ttl / 0.35);
      const s = 16 + (0.35 - this.flash.userData.ttl) * 30;
      this.flash.scale.set(s, s, 1);
    }
  }
}
