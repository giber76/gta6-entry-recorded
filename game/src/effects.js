// effects.js — explosions, smoke, sparks and camera shake for Solara Bay.
// A wrecked car fires one explosion burst, then a smoke plume while it burns.
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

export function initEffects(game) {
  const THREE = window.THREE;
  game.effects = {
    parts: [],
    shake: 0,
    flash: null,
    geo: new THREE.SphereGeometry(0.5, SPHERE_SEGMENTS, 5),
  };
}

// One particle: a sphere at (x, y, z) with a velocity, a lifetime in
// seconds, an optional growth rate and an optional gravity pull.
// spec: { color, size, vx, vy, vz, life, grow, gravity, opacity }
function spawnParticle(game, x, y, z, spec) {
  const parts = game.effects.parts;
  if (parts.length >= MAX_PARTICLES) {
    const old = parts.shift();
    game.scene.remove(old.node);
    old.node.material.dispose();
  }
  const mat = new window.THREE.MeshBasicMaterial({
    color: spec.color,
    transparent: true,
    opacity: spec.opacity ?? 0.9,
  });
  const node = new window.THREE.Mesh(game.effects.geo, mat);
  node.position.set(x, y, z);
  node.scale.setScalar((spec.size ?? 0.5) * 2);
  game.scene.add(node);
  const part = {
    node,
    v: new window.THREE.Vector3(spec.vx ?? 0, spec.vy ?? 0, spec.vz ?? 0),
    ttl: spec.life ?? 1,
    ttlMax: spec.life ?? 1,
    growth: spec.grow ?? 0,
    fall: spec.gravity ?? 0,
    opacity0: spec.opacity ?? 0.9,
  };
  parts.push(part);
  return part;
}

// A short, bright point light that dies within a quarter of a second.
function flashLight(game, x, z) {
  const THREE = window.THREE;
  if (game.effects.flash) game.scene.remove(game.effects.flash.light);
  const light = new THREE.PointLight(0xffa040, 3, 40);
  light.position.set(x, 4, z);
  game.scene.add(light);
  game.effects.flash = { light, life: 1 };
}

// A random outward direction and speed for a burst particle.
function burstVector(minSpeed, maxSpeed) {
  const a = randRange(0, Math.PI * 2);
  const sp = randRange(minSpeed, maxSpeed);
  return { vx: Math.cos(a) * sp, vz: Math.sin(a) * sp };
}

// A car blowing up: fireball, smoke column, sparks, light flash, camera
// shake, a bang, and every pedestrian nearby running for cover.
export function explodeCar(game, x, z) {
  if (!game.effects) return;
  // Fireball: orange spheres rushing up and out.
  for (let i = 0; i < 14; i++) {
    const v = burstVector(0.5, 3.5);
    spawnParticle(game, x, 1, z, {
      color: i % 3 === 0 ? 0xffd23c : 0xff6a1a,
      size: randRange(0.5, 1.1),
      vx: v.vx,
      vy: randRange(3, 8),
      vz: v.vz,
      life: randRange(0.5, 0.9),
      grow: 2.5,
      gravity: -2,
    });
  }
  // Smoke column: slow grey spheres that rise and swell.
  for (let i = 0; i < 10; i++) {
    spawnParticle(game, x + randRange(-1, 1), 1.5 + i * 0.4, z + randRange(-1, 1), {
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
    const v = burstVector(6, 14);
    spawnParticle(game, x, 1.2, z, {
      color: 0xffe08a,
      size: 0.16,
      vx: v.vx,
      vy: randRange(2, 7),
      vz: v.vz,
      life: randRange(0.3, 0.7),
      gravity: -12,
    });
  }
  flashLight(game, x, z);
  spawnDebris(game, x, z, 8);
  game.effects.shake = Math.min(1.6, game.effects.shake + 1.1);
  if (game.audio) game.audio.explosion();
  fleeFromBlast(game, x, z);
}

// A muzzle flash: a brief bright star at the gun's mouth, plus a
// couple of fast sparks flying forward along the shot direction.
export function spawnMuzzleFlash(game, x, y, z, dirX, dirZ) {
  if (!game.effects) return;
  spawnParticle(game, x, y, z, {
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
    spawnParticle(game, x, y, z, {
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
export function spawnDebris(game, x, z, count) {
  if (!game.effects) return;
  for (let i = 0; i < count; i++) {
    const v = burstVector(3, 9);
    spawnParticle(game, x, 1, z, {
      color: 0x2c2f33,
      size: randRange(0.25, 0.5),
      vx: v.vx,
      vy: randRange(3, 6),
      vz: v.vz,
      life: randRange(0.8, 1.4),
      gravity: -14,
    });
  }
}

// Continuous smoke from a burning car, called once per frame while the
// car is below 25 HP. Emits a dark plume that rises and drifts with
// the wind, plus an occasional ember.
export function emitBurningSmoke(game, x, z, dt) {
  if (!game.effects) return;
  game.effects._burnAcc = (game.effects._burnAcc || 0) + dt;
  const interval = 0.06;
  while (game.effects._burnAcc >= interval) {
    game.effects._burnAcc -= interval;
    spawnParticle(game, x + randRange(-0.6, 0.6), 1.2, z + randRange(-0.6, 0.6), {
      color: 0x1a1a1a,
      size: randRange(0.5, 0.9),
      vx: randRange(-0.4, 0.4),
      vy: randRange(2.5, 4),
      vz: randRange(-0.4, 0.4),
      life: randRange(1.2, 2),
      grow: 1.8,
      opacity: 0.75,
    });
    if (Math.random() < 0.3) {
      spawnParticle(game, x, 1, z, {
        color: 0xffa63c,
        size: 0.2,
        vx: randRange(-2, 2),
        vy: randRange(3, 6),
        vz: randRange(-2, 2),
        life: randRange(0.3, 0.6),
        gravity: -4,
      });
    }
  }
}
export function spawnSkidSmoke(game, x, z) {
  if (!game.effects) return;
  spawnParticle(game, x, 0.4, z, {
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
export function carExhaust(game, car, dt) {
  if (!game.effects) return;
  car.smokeTimer -= dt;
  if (car.smokeTimer > 0) return;
  if (car.health >= 50 || car.health <= 0 || car.wrecked) return;
  const burning = car.health < 25;
  car.smokeTimer = burning ? 0.12 : 0.25;
  spawnParticle(game, car.pos.x, 1.6, car.pos.z, {
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
export function updateEffects(game, dt) {
  if (!game.effects) return;
  const parts = game.effects.parts;
  for (const part of parts) {
    part.ttl -= dt;
    part.v.y += part.fall * dt;
    part.node.position.x += part.v.x * dt;
    part.node.position.y += part.v.y * dt;
    part.node.position.z += part.v.z * dt;
    if (part.growth) {
      const s = 1 + part.growth * dt;
      part.node.scale.multiplyScalar(s);
    }
    part.node.material.opacity = Math.max(0, part.opacity0 * (part.ttl / part.ttlMax));
  }
  for (let i = parts.length - 1; i >= 0; i--) {
    if (parts[i].ttl <= 0 || parts[i].node.position.y < -0.5) {
      game.scene.remove(parts[i].node);
      parts[i].node.material.dispose();
      parts.splice(i, 1);
    }
  }
  if (game.effects.flash) {
    game.effects.flash.life -= dt * 4;
    game.effects.flash.light.intensity = Math.max(0, game.effects.flash.life * 3);
    if (game.effects.flash.life <= 0) {
      game.scene.remove(game.effects.flash.light);
      game.effects.flash = null;
    }
  }
  game.effects.shake = Math.max(0, game.effects.shake - dt * 1.8);
}

// A random camera offset for this frame, scaled by the shake magnitude.
export function shakeOffset(game) {
  const s = game.effects ? game.effects.shake : 0;
  if (s <= 0.01) return { x: 0, y: 0 };
  return { x: (Math.random() - 0.5) * s, y: (Math.random() - 0.5) * s * 0.6 };
}
