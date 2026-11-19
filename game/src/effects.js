// effects.js — particles for Solara Bay: explosions, smoke, sparks and
// muzzle flashes. Everything is a shared-geometry mesh that grows, rises
// and shrinks away, so no per-particle materials and no textures. The
// camera shake lives here too (G.shake, decayed by updateEffects).

export function initEffects(G) {
  const THREE = window.THREE;
  const geo = new THREE.SphereGeometry(0.5, 6, 5);
  const mats = {
    fire: new THREE.MeshBasicMaterial({ color: 0xff7a1a }),
    ember: new THREE.MeshBasicMaterial({ color: 0xffd23c }),
    smoke: new THREE.MeshBasicMaterial({ color: 0x2e2e2e, transparent: true, opacity: 0.8 }),
    spark: new THREE.MeshBasicMaterial({ color: 0xfff2a8 }),
  };
  G.effects = { geo, mats, parts: [], lights: [] };
  G.shake = 0;
  return G.effects;
}

function addPart(G, mat, x, y, z, vx, vy, vz, life, grow, base) {
  const fx = G.effects;
  if (fx.parts.length > 120) {
    const old = fx.parts.shift();
    G.scene.remove(old.mesh);
  }
  const mesh = new THREE.Mesh(fx.geo, mat);
  mesh.position.set(x, y, z);
  mesh.scale.setScalar(base);
  G.scene.add(mesh);
  fx.parts.push({ mesh, vx, vy, vz, life, maxLife: life, grow, base });
}

function addLight(G, x, y, z, intensity, distance, life) {
  const THREE = window.THREE;
  const light = new THREE.PointLight(0xffa040, intensity, distance, 1.6);
  light.position.set(x, y, z);
  G.scene.add(light);
  G.effects.lights.push({ light, life, maxLife: life, intensity });
}

// A full explosion: fireball core, smoke column, sparks, a light flash
// and a camera kick. big=true doubles the scale (cars), false is a
// small pop (barrels, gun hits on fuel — currently unused).
export function spawnExplosion(G, x, z, big) {
  const s = big ? 1 : 0.6;
  const THREE = window.THREE;
  addPart(G, G.effects.mats.fire, x, 1.2, z, 0, 1.5, 0, 0.55, 3.2 * s, 2.2 * s);
  addPart(G, G.effects.mats.ember, x, 1.6, z, 0, 2.2, 0, 0.4, 2.4 * s, 1.4 * s);
  for (let i = 0; i < 8; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 0.5 + Math.random() * 1.6;
    addPart(G, G.effects.mats.smoke, x + Math.cos(a) * r, 1 + Math.random(), z + Math.sin(a) * r,
      Math.cos(a) * 0.8, 2 + Math.random() * 1.5, Math.sin(a) * 0.8, 2.2 + Math.random(), 1.6, 0.8 + Math.random() * 0.8);
  }
  for (let i = 0; i < 12; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 6 + Math.random() * 10;
    addPart(G, G.effects.mats.spark, x, 1.2, z, Math.cos(a) * sp, 2 + Math.random() * 5, Math.sin(a) * sp,
      0.35 + Math.random() * 0.2, -0.5, 0.22);
  }
  addLight(G, x, 3, z, 7 * s, 42, 0.5);
  G.shake = Math.max(G.shake, 1);
  if (G.audio) G.audio.explosion();
}

// One smoke puff, for a damaged car (throttled by the caller).
export function spawnSmokePuff(G, x, z) {
  addPart(G, G.effects.mats.smoke, x + (Math.random() - 0.5), 1.4, z + (Math.random() - 0.5),
    (Math.random() - 0.5) * 0.6, 2.2, (Math.random() - 0.5) * 0.6, 2, 1.8, 0.7);
}

// A small flame lick, for a burning car (throttled by the caller).
export function spawnFirePuff(G, x, z) {
  addPart(G, G.effects.mats.ember, x + (Math.random() - 0.5), 1.2, z + (Math.random() - 0.5),
    (Math.random() - 0.5) * 0.4, 1.5, (Math.random() - 0.5) * 0.4, 0.4, 1.2, 0.5);
}

// A few sparks, for a bullet striking metal.
export function spawnSparks(G, x, y, z) {
  for (let i = 0; i < 6; i++) {
    const a = Math.random() * Math.PI * 2;
    addPart(G, G.effects.mats.spark, x, y, z, Math.cos(a) * 5, 1 + Math.random() * 3, Math.sin(a) * 5,
      0.3, -0.4, 0.18);
  }
}

// A brief light at the muzzle when a shot is fired.
export function muzzleFlash(G, x, y, z) {
  addLight(G, x, y, z, 3.5, 14, 0.07);
}

export function updateEffects(G, dt) {
  const fx = G.effects;
  if (!fx) return;
  for (const p of fx.parts) {
    p.life -= dt;
    p.mesh.position.x += p.vx * dt;
    p.mesh.position.y += p.vy * dt;
    p.mesh.position.z += p.vz * dt;
    p.vy += p.grow * dt * 0.4;
    const age = 1 - p.life / p.maxLife;
    const scale = p.base * (1 + p.grow * age);
    p.mesh.scale.setScalar(Math.max(0.05, scale * (p.life < 0.25 ? p.life / 0.25 : 1)));
  }
  for (let i = fx.parts.length - 1; i >= 0; i--) {
    if (fx.parts[i].life <= 0) {
      G.scene.remove(fx.parts[i].mesh);
      fx.parts.splice(i, 1);
    }
  }
  for (let i = fx.lights.length - 1; i >= 0; i--) {
    const l = fx.lights[i];
    l.life -= dt;
    l.light.intensity = l.intensity * Math.max(0, l.life / l.maxLife);
    if (l.life <= 0) {
      G.scene.remove(l.light);
      fx.lights.splice(i, 1);
    }
  }
  if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 1.8);
}
