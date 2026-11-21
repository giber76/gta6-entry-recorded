// effects.js — explosions, smoke/fire and camera shake for Solara Bay.
// Two pooled THREE.Points systems (additive fire, normal smoke) plus a
// point-light flash. No textures from files: the sprite is a canvas radial.
import * as THREE from 'three';

function spriteTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  return t;
}

const MAX = 420;

class Pool {
  constructor(scene, additive, size) {
    this.geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(MAX * 3);
    this.col = new Float32Array(MAX * 3);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.mat = new THREE.PointsMaterial({
      size, map: spriteTexture(), transparent: true, depthWrite: false,
      vertexColors: true, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      opacity: 0.9,
    });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.parts = [];
    for (let i = 0; i < MAX; i++) {
      this.parts.push({ life: 0, max: 1, x: 0, y: -100, z: 0, vx: 0, vy: 0, vz: 0, r: 1, g: 1, b: 1, grav: 0, drag: 0 });
      this.pos[i * 3 + 1] = -100;
    }
    this.cursor = 0;
  }

  spawn(x, y, z, vx, vy, vz, life, r, g, b, grav = 0, drag = 0) {
    const p = this.parts[this.cursor];
    this.cursor = (this.cursor + 1) % MAX;
    p.life = life;
    p.max = life;
    p.x = x; p.y = y; p.z = z;
    p.vx = vx; p.vy = vy; p.vz = vz;
    p.r = r; p.g = g; p.b = b;
    p.grav = grav; p.drag = drag;
  }

  update(dt) {
    for (let i = 0; i < MAX; i++) {
      const p = this.parts[i];
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) {
        this.pos[i * 3 + 1] = -100;
        continue;
      }
      p.vy -= p.grav * dt;
      const dr = 1 - p.drag * dt;
      p.vx *= dr; p.vy *= dr; p.vz *= dr;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (p.y < 0.05) p.y = 0.05;
      const f = p.life / p.max;
      this.pos[i * 3] = p.x;
      this.pos[i * 3 + 1] = p.y;
      this.pos[i * 3 + 2] = p.z;
      this.col[i * 3] = p.r * f;
      this.col[i * 3 + 1] = p.g * f;
      this.col[i * 3 + 2] = p.b * f;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
  }
}

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.fire = new Pool(scene, true, 1.6);
    this.smoke = new Pool(scene, false, 2.6);
    this.flash = new THREE.PointLight(0xffaa33, 0, 40, 1.6);
    this.scene.add(this.flash);
    this.flashTime = 0;
    this.shake = 0;
  }

  explode(x, z) {
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 3 + Math.random() * 9;
      this.fire.spawn(x, 0.6 + Math.random(), z, Math.cos(a) * sp, 2 + Math.random() * 7, Math.sin(a) * sp, 0.5 + Math.random() * 0.5, 1, 0.55 + Math.random() * 0.3, 0.12, 9, 1.2);
    }
    for (let i = 0; i < 18; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 1 + Math.random() * 4;
      this.smoke.spawn(x, 1 + Math.random() * 2, z, Math.cos(a) * sp, 3 + Math.random() * 4, Math.sin(a) * sp, 1.6 + Math.random() * 1.2, 0.16, 0.16, 0.16, -1.5, 0.4);
    }
    this.flash.position.set(x, 4, z);
    this.flash.intensity = 60;
    this.flashTime = 0.35;
    this.shake = 1;
  }

  carSmoke(x, z, burning) {
    // a puff from the engine bay
    this.smoke.spawn(x, 1.1, z, (Math.random() - 0.5) * 0.8, 1.6 + Math.random(), (Math.random() - 0.5) * 0.8, 1.4, 0.2, 0.2, 0.2, -1.2, 0.3);
    if (burning) {
      this.fire.spawn(x, 0.9, z, (Math.random() - 0.5) * 1.2, 1.5 + Math.random() * 1.5, (Math.random() - 0.5) * 1.2, 0.4, 1, 0.45, 0.1, 4, 0.8);
    }
  }

  // returns a small random camera offset while shaking
  shakeOffset(dt) {
    if (this.shake <= 0) return { x: 0, y: 0 };
    this.shake = Math.max(0, this.shake - dt * 2.2);
    const s = this.shake * 0.35;
    return { x: (Math.random() - 0.5) * s, y: (Math.random() - 0.5) * s };
  }

  update(dt) {
    this.fire.update(dt);
    this.smoke.update(dt);
    if (this.flashTime > 0) {
      this.flashTime -= dt;
      this.flash.intensity = Math.max(0, this.flashTime / 0.35) * 60;
    } else {
      this.flash.intensity = 0;
    }
  }
}
