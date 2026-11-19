// effects.js — explosions, smoke, sparks and camera shake for Solara Bay.
//
// Every effect is a short-lived particle: a mesh with a velocity, a life
// and a fade. An explosion also flashes a point light, shakes the camera
// and sends nearby pedestrians running. The car damage system in
// vehicles.js feeds this file; the camera in player.js reads the shake
// magnitude each frame. Particles are capped so a chain of wrecks can
// never flood the scene.

import { fleeFromBlast } from './pedestrians.js';
import { randRange } from './util.js';

const MAX_PARTICLES = 140;
const SPHERE_SEGMENTS = 6;

export function initEffects(G) {
  const THREE = window.THREE;
  G.effects = {
    parts: [],
    shake: 0,
    flash: null,
    geo: new THREE.SphereGeometry(0.5, SPHERE_SEGMENTS, 5),
  };
}

// One particle: a sphere at (x, y, z) with a velocity, a lifetime in
// seconds, an optional growth rate and an optional gravity pull.
// opts: { color, size, vx, vy, vz, life, grow, gravity, opacity }
function spawnParticle(G, x, y, z, opts) {
  const parts = G.effects.parts;
  if (parts.length >= MAX_PARTICLES) {
    const old = parts.shift();
    G.scene.remove(old.mesh);
    old.mesh.material.dispose();
  }
  const mat = new window.THREE.MeshBasicMaterial({
    color: opts.color,
    transparent: true,
    opacity: opts.opacity ?? 0.9,
  });
  const mesh = new window.THREE.Mesh(G.effects.geo, mat);
  mesh.position.set(x, y, z);
  mesh.scale.setScalar((opts.size ?? 0.5) * 2);
  G.scene.add(mesh);
  const part = {
    mesh,
    vel: new window.THREE.Vector3(opts.vx ?? 0, opts.vy ?? 0, opts.vz ?? 0),
    life: opts.life ?? 1,
    maxLife: opts.life ?? 1,
    grow: opts.grow ?? 0,
    gravity: opts.gravity ?? 0,
    startOpacity: opts.opacity ?? 0.9,
  };
  parts.push(part);
  return part;
}

// A short, bright point light that dies within a quarter of a second.
function flashLight(G, x, z) {
  const THREE = window.THREE;
  if (G.effects.flash) G.scene.remove(G.effects.flash.light);
  const light = new THREE.PointLight(0xffa040, 3, 40);
  light.position.set(x, 4, z);
  G.scene.add(light);
  G.effects.flash = { light, life: 1 };
}

// A car blowing up: fireball, smoke column, sparks, light flash, camera
// shake, a bang, and every pedestrian nearby running for cover.
export function explodeCar(G, x, z) {
  if (!G.effects) return;
  // Fireball: orange spheres rushing up and out.
  for (let i = 0; i < 14; i++) {
    const a = randRange(0, Math.PI * 2);
    const r = randRange(0.5, 3.5);
    spawnParticle(G, x, 1, z, {
      color: i % 3 === 0 ? 0xffd23c : 0xff6a1a,
      size: randRange(0.5, 1.1),
      vx: Math.cos(a) * r,
      vy: randRange(3, 8),
      vz: Math.sin(a) * r,
      life: randRange(0.5, 0.9),
      grow: 2.5,
      gravity: -2,
    });
  }
  // Smoke column: slow grey spheres that rise and swell.
  for (let i = 0; i < 10; i++) {
    spawnParticle(G, x + randRange(-1, 1), 1.5 + i * 0.4, z + randRange(-1, 1), {
      color: 0x555555,
      size: randRange(0.8, 1.4),
      vx: randRange(-0.5, 0.5),
      vy: randRange(1.5, 3),
      vz: randRange(-0.5, 0.5),
      life: randRange(1.2, 2),
      grow: 1.8,
      opacity: 0.75,
    });
  }
  // Sparks: fast bright flecks with real gravity.
  for (let i = 0; i < 16; i++) {
    const a = randRange(0, Math.PI * 2);
    const sp = randRange(6, 14);
    spawnParticle(G, x, 1.2, z, {
      color: 0xffe08a,
      size: 0.16,
      vx: Math.cos(a) * sp,
      vy: randRange(2, 7),
      vz: Math.sin(a) * sp,
      life: randRange(0.3, 0.7),
      gravity: -12,
    });
  }
  flashLight(G, x, z);
  spawnDebris(G, x, z, 8);
  G.effects.shake = Math.min(1.6, G.effects.shake + 1.1);
  if (G.audio) G.audio.explosion();
  fleeFromBlast(G, x, z);
}

// A muzzle flash: a brief bright star at the gun's mouth, plus a
// couple of fast sparks flying forward along the shot direction.
export function spawnMuzzleFlash(G, x, y, z, dirX, dirZ) {
  if (!G.effects) return;
  spawnParticle(G, x, y, z, {
    color: 0xffe08a,
    size: 0.7,
    vx: dirX * 2,
    vy: 0.5,
    vz: dirZ * 2,
    life: 0.09,
    grow: 1,
    opacity: 1,
  });
  for (let i = 0; i < 3; i++) {
    const spread = randRange(-0.4, 0.4);
    spawnParticle(G, x, y, z, {
      color: 0xffd23c,
      size: 0.14,
      vx: dirX * randRange(8, 12) - dirZ * spread * 8,
      vy: randRange(0, 2),
      vz: dirZ * randRange(8, 12) + dirX * spread * 8,
      life: randRange(0.15, 0.3),
      gravity: -6,
    });
  }
}

// Tumbling debris from a wreck: dark chunks that arc out, bounce once
// on the ground and lie still until they fade.
export function spawnDebris(G, x, z, count) {
  if (!G.effects) return;
  for (let i = 0; i < count; i++) {
    const a = randRange(0, Math.PI * 2);
    const sp = randRange(3, 9);
    spawnParticle(G, x, 1, z, {
      color: 0x2c2f33,
      size: randRange(0.25, 0.5),
      vx: Math.cos(a) * sp,
      vy: randRange(3, 6),
      vz: Math.sin(a) * sp,
      life: randRange(0.8, 1.4),
      gravity: -14,
    });
  }
}

// A puff of tyre smoke at the rear wheels while handbraking at speed.
export function spawnSkidSmoke(G, x, z) {
  if (!G.effects) return;
  spawnParticle(G, x, 0.4, z, {
    color: 0x888888,
    size: 0.6,
    vx: randRange(-0.5, 0.5),
    vy: randRange(0.8, 1.5),
    vz: randRange(-0.5, 0.5),
    life: randRange(0.4, 0.8),
    grow: 2,
    opacity: 0.6,
  });
}

// A damaged car smokes below half health and burns below a quarter.
// Called every frame for a hurt car; the puff timer throttles the rate.
export function carExhaust(G, car, dt) {
  if (!G.effects) return;
  car.smokeTimer -= dt;
  if (car.smokeTimer > 0) return;
  if (car.health >= 50 || car.health <= 0 || car.wrecked) return;
  const burning = car.health < 25;
  car.smokeTimer = burning ? 0.12 : 0.25;
  spawnParticle(G, car.pos.x, 1.6, car.pos.z, {
    color: burning ? 0xff7a1a : 0x777777,
    size: burning ? 0.5 : 0.7,
    vx: randRange(-0.4, 0.4),
    vy: randRange(1.5, 2.5),
    vz: randRange(-0.4, 0.4),
    life: randRange(0.6, 1.1),
    grow: 1.5,
    opacity: 0.7,
  });
}

// Advance every live particle, fade the flash light and decay the shake.
export function updateEffects(G, dt) {
  if (!G.effects) return;
  const parts = G.effects.parts;
  for (const part of parts) {
    part.life -= dt;
    part.vel.y += part.gravity * dt;
    part.mesh.position.x += part.vel.x * dt;
    part.mesh.position.y += part.vel.y * dt;
    part.mesh.position.z += part.vel.z * dt;
    if (part.grow) {
      const s = 1 + part.grow * dt;
      part.mesh.scale.multiplyScalar(s);
    }
    part.mesh.material.opacity = Math.max(0, part.startOpacity * (part.life / part.maxLife));
  }
  for (let i = parts.length - 1; i >= 0; i--) {
    if (parts[i].life <= 0 || parts[i].mesh.position.y < -0.5) {
      G.scene.remove(parts[i].mesh);
      parts[i].mesh.material.dispose();
      parts.splice(i, 1);
    }
  }
  if (G.effects.flash) {
    G.effects.flash.life -= dt * 4;
    G.effects.flash.light.intensity = Math.max(0, G.effects.flash.life * 3);
    if (G.effects.flash.life <= 0) {
      G.scene.remove(G.effects.flash.light);
      G.effects.flash = null;
    }
  }
  G.effects.shake = Math.max(0, G.effects.shake - dt * 1.8);
}

// A random camera offset for this frame, scaled by the shake magnitude.
export function shakeOffset(G) {
  const s = G.effects ? G.effects.shake : 0;
  if (s <= 0.01) return { x: 0, y: 0 };
  return { x: (Math.random() - 0.5) * s, y: (Math.random() - 0.5) * s * 0.6 };
}
