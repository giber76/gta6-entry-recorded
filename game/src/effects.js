// effects.js — explosions, smoke, muzzle flash and camera shake.
// All effects are cheap Three.js primitives; particles are pooled so a
// wreck never allocates mid-frame.

import { mulberry32 } from './util.js';

export function createEffects(world) {
  const THREE = window.THREE;
  const rng = mulberry32(99);
  const effects = {
    parts: [],
    flash: null,
  };

  // A pool of small glowing spheres reused for every explosion / puff.
  const pool = [];
  for (let i = 0; i < 40; i++) {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 6, 5),
      new THREE.MeshBasicMaterial({ color: 0xff8833, transparent: true, opacity: 0 }),
    );
    m.visible = false;
    world.scene.add(m);
    pool.push({ mesh: m, life: 0, maxLife: 1, vx: 0, vy: 0, vz: 0, grow: 1 });
  }
  let poolIndex = 0;

  function spawn(x, y, z, color, size, life, vx, vy, vz) {
    const p = pool[poolIndex];
    poolIndex = (poolIndex + 1) % pool.length;
    p.mesh.visible = true;
    p.mesh.position.set(x, y, z);
    p.mesh.scale.setScalar(size);
    p.mesh.material.color.setHex(color);
    p.mesh.material.opacity = 0.95;
    p.life = life;
    p.maxLife = life;
    p.vx = vx;
    p.vy = vy;
    p.vz = vz;
    p.grow = size;
    effects.parts.push(p);
  }

  // Full wreck explosion: fireball + smoke column + sparks + light flash.
  effects.explode = function (x, z, scale) {
    const s = scale || 1;
    for (let i = 0; i < 10; i++) {
      const a = rng() * Math.PI * 2;
      const r = rng() * 2 * s;
      spawn(
        x + Math.sin(a) * r,
        0.8 + rng() * 2,
        z + Math.cos(a) * r,
        i % 2 === 0 ? 0xff6622 : 0xffcc33,
        1.2 + rng() * 1.4,
        0.7 + rng() * 0.5,
        Math.sin(a) * 3,
        3 + rng() * 4,
        Math.cos(a) * 3,
      );
    }
    for (let i = 0; i < 6; i++) {
      spawn(
        x + (rng() - 0.5) * 2,
        1.5 + rng() * 3,
        z + (rng() - 0.5) * 2,
        0x555555,
        1.6 + rng(),
        1.4 + rng(),
        (rng() - 0.5) * 1.5,
        2 + rng() * 2,
        (rng() - 0.5) * 1.5,
      );
    }
    for (let i = 0; i < 8; i++) {
      const a = rng() * Math.PI * 2;
      spawn(
        x,
        1,
        z,
        0xffe9a8,
        0.35,
        0.4 + rng() * 0.3,
        Math.sin(a) * 14,
        4 + rng() * 8,
        Math.cos(a) * 14,
      );
    }
    // Light flash + camera shake + sound + scattering peds.
    const light = new THREE.PointLight(0xffaa33, 60, 30);
    light.position.set(x, 4, z);
    world.scene.add(light);
    effects.parts.push({ light, life: 0.35, maxLife: 0.35 });
    world.cameraShake = Math.min(1, world.cameraShake + 0.7 * s);
    world.audio.explosion();
    if (world.pedestrians) world.pedestrians.scatter(x, z, 25);
  };

  // Damage smoke (grey) or fire (orange) puff from a hurt car.
  effects.puff = function (x, z, burning) {
    spawn(
      x + (rng() - 0.5) * 1.5,
      1.4,
      z + (rng() - 0.5) * 1.5,
      burning ? 0xff7722 : 0x666666,
      burning ? 0.9 : 1.2,
      burning ? 0.5 : 1.1,
      (rng() - 0.5) * 0.8,
      2.5,
      (rng() - 0.5) * 0.8,
    );
  };

  // A short muzzle flash in front of Marlo.
  effects.muzzle = function (player) {
    const f = { x: Math.sin(player.heading), z: Math.cos(player.heading) };
    spawn(
      player.x + f.x * 1.2,
      1.3,
      player.z + f.z * 1.2,
      0xffdd66,
      0.5,
      0.09,
      0,
      0,
      0,
    );
  };

  effects.update = function (dt) {
    const alive = [];
    for (const p of effects.parts) {
      p.life -= dt;
      if (p.life <= 0) {
        if (p.mesh) {
          p.mesh.visible = false;
          p.mesh.material.opacity = 0;
        }
        if (p.light) world.scene.remove(p.light);
        continue;
      }
      alive.push(p);
      if (p.mesh) {
        p.mesh.position.x += p.vx * dt;
        p.mesh.position.y += p.vy * dt;
        p.mesh.position.z += p.vz * dt;
        p.vy -= 2 * dt;
        const t = p.life / p.maxLife;
        p.mesh.material.opacity = 0.95 * t;
        p.mesh.scale.setScalar(Math.max(0.1, p.grow * (1.6 - t * 0.6)));
      }
      if (p.light) {
        p.light.intensity = 60 * (p.life / p.maxLife);
      }
    }
    effects.parts = alive;
    if (world.cameraShake > 0) {
      world.cameraShake = Math.max(0, world.cameraShake - dt * 1.6);
    }
  };

  world.effects = effects;
  return effects;
}
