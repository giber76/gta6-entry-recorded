// effects.js — pooled particles, explosions, smoke, muzzle flashes and
// tracers for Solara Bay. One THREE.Points cloud, no per-particle objects.
import * as THREE from 'three';

const MAX_PARTICLES = 400;

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.particles.push({ x: 0, y: -999, z: 0, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 1, r: 1, g: 1, b: 1 });
    }
    this.cursor = 0;
    const geo = new THREE.BufferGeometry();
    this.positions = new Float32Array(MAX_PARTICLES * 3);
    this.colors = new Float32Array(MAX_PARTICLES * 3);
    for (let i = 0; i < MAX_PARTICLES; i++) this.positions[i * 3 + 1] = -999;
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    this.points = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ size: 0.55, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false })
    );
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.tracers = [];
    this.vignette = 0;
  }

  spawn(x, y, z, vx, vy, vz, life, r, g, b) {
    const p = this.particles[this.cursor];
    this.cursor = (this.cursor + 1) % MAX_PARTICLES;
    p.x = x;
    p.y = y;
    p.z = z;
    p.vx = vx;
    p.vy = vy;
    p.vz = vz;
    p.life = life;
    p.maxLife = life;
    p.r = r;
    p.g = g;
    p.b = b;
  }

  burst(x, y, z, colorHex, count) {
    const r = ((colorHex >> 16) & 255) / 255;
    const g = ((colorHex >> 8) & 255) / 255;
    const b = (colorHex & 255) / 255;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 2 + Math.random() * 5;
      this.spawn(x, y, z, Math.cos(a) * sp, Math.random() * 3, Math.sin(a) * sp, 0.35 + Math.random() * 0.3, r, g, b);
    }
  }

  explosion(x, y, z) {
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 3 + Math.random() * 9;
      this.spawn(x, y + 0.5, z, Math.cos(a) * sp, 2 + Math.random() * 6, Math.sin(a) * sp, 0.6 + Math.random() * 0.5, 1.0, 0.55 + Math.random() * 0.3, 0.15);
    }
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 1 + Math.random() * 3;
      this.spawn(x, y + 1, z, Math.cos(a) * sp, 2.5 + Math.random() * 2, Math.sin(a) * sp, 1.2 + Math.random() * 0.8, 0.25, 0.25, 0.25);
    }
  }

  smoke(x, y, z, isFire) {
    if (isFire) {
      this.spawn(x, y, z, (Math.random() - 0.5) * 0.6, 1.6 + Math.random(), (Math.random() - 0.5) * 0.6, 0.5, 1.0, 0.4, 0.1);
    }
    this.spawn(x, y, z, (Math.random() - 0.5) * 0.8, 1.2 + Math.random(), (Math.random() - 0.5) * 0.8, 1.0, 0.3, 0.3, 0.3);
  }

  muzzle(x, y, z) {
    this.spawn(x, y, z, 0, 0, 0, 0.08, 1.0, 0.9, 0.5);
    this.spawn(x, y, z, 0, 0.3, 0, 0.08, 1.0, 0.8, 0.4);
  }

  tracer(x0, y0, z0, x1, y1, z1, colorHex) {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(x0, y0, z0),
      new THREE.Vector3(x1, y1, z1),
    ]);
    const mat = new THREE.LineBasicMaterial({ color: colorHex, transparent: true, opacity: 0.85 });
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);
    this.tracers.push({ line, life: 0.09 });
  }

  flashVignette(amount) {
    this.vignette = Math.max(this.vignette, amount);
  }

  update(dt) {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.particles[i];
      if (p.life > 0) {
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        p.vy -= 1.5 * dt;
        this.positions[i * 3] = p.x;
        this.positions[i * 3 + 1] = p.y;
        this.positions[i * 3 + 2] = p.z;
        const f = Math.max(0, p.life / p.maxLife);
        this.colors[i * 3] = p.r * f;
        this.colors[i * 3 + 1] = p.g * f;
        this.colors[i * 3 + 2] = p.b * f;
      } else {
        this.positions[i * 3 + 1] = -999;
      }
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const tr = this.tracers[i];
      tr.life -= dt;
      tr.line.material.opacity = Math.max(0, tr.life / 0.09);
      if (tr.life <= 0) {
        this.scene.remove(tr.line);
        this.tracers.splice(i, 1);
      }
    }
    if (this.vignette > 0) this.vignette = Math.max(0, this.vignette - dt * 1.4);
  }
}
