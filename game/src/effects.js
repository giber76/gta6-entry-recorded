// effects.js — explosions (fireball, smoke column, sparks, light flash,
// camera shake), damage smoke/fire on hurt cars, and the muzzle flash.
import * as THREE from 'three';
import { scatterPeds } from './pedestrians.js';
import { playExplosion } from './audio.js';

export function explode(G, x, z, y) {
  playExplosion(G);
  addShake(G, 0.7);
  scatterPeds(G, x, z, 26);
  // Fireball: an expanding orange sphere that fades.
  const fireMat = new THREE.MeshBasicMaterial({ color: 0xff7722, transparent: true, opacity: 0.95 });
  const fire = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 10), fireMat);
  fire.position.set(x, (y || 1) + 0.6, z);
  G.scene.add(fire);
  // Smoke column: grey spheres rising.
  const smokeMat = new THREE.MeshBasicMaterial({ color: 0x555555, transparent: true, opacity: 0.7 });
  const smokes = [];
  for (let i = 0; i < 5; i++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(1.1 + i * 0.35, 8, 8), smokeMat.clone());
    s.position.set(x + (G.rng() - 0.5) * 1.5, (y || 1) + 1 + i * 1.2, z + (G.rng() - 0.5) * 1.5);
    G.scene.add(s);
    smokes.push(s);
  }
  // Flash light (no shadow, short-lived).
  const light = new THREE.PointLight(0xff8844, 60, 30);
  light.position.set(x, 3, z);
  G.scene.add(light);
  G.effects.push({ kind: 'explosion', fire, smokes, light, t: 0, dur: 1.1 });
  // Damage flash on the HUD.
  G.damageFlash = 1;
}

export function addShake(G, amt) {
  G.cameraShake = Math.min(1.2, G.cameraShake + amt);
}

export function updateEffects(G, dt) {
  if (G.damageFlash > 0) G.damageFlash = Math.max(0, G.damageFlash - dt * 2.2);
  if (G.cameraShake > 0) G.cameraShake = Math.max(0, G.cameraShake - dt * 1.6);
  if (G.muzzleTimer > 0) G.muzzleTimer -= dt;
  for (let i = G.effects.length - 1; i >= 0; i--) {
    const e = G.effects[i];
    e.t += dt;
    const k = e.t / e.dur;
    if (e.kind === 'explosion') {
      const s = 1 + k * 4.5;
      e.fire.scale.set(s, s * 0.8, s);
      e.fire.material.opacity = Math.max(0, 0.95 - k);
      for (let j = 0; j < e.smokes.length; j++) {
        const sm = e.smokes[j];
        sm.position.y += dt * 2.2;
        sm.material.opacity = Math.max(0, 0.7 - k * 0.8);
        sm.scale.setScalar(1 + k * 1.5);
      }
      e.light.intensity = Math.max(0, 60 * (1 - k * 1.6));
      if (k >= 1) {
        G.scene.remove(e.fire);
        for (const sm of e.smokes) G.scene.remove(sm);
        G.scene.remove(e.light);
        G.effects.splice(i, 1);
      }
    }
  }
  // Smoke / fire on hurt cars (health < 50 smoke, < 25 fire).
  for (const car of G.cars) {
    if (car.wrecked || car.health >= 50) continue;
    car.smokeTimer -= dt;
    if (car.smokeTimer <= 0) {
      car.smokeTimer = car.health < 25 ? 0.25 : 0.6;
      const mat = new THREE.MeshBasicMaterial({
        color: car.health < 25 ? 0x333333 : 0x777777,
        transparent: true,
        opacity: 0.55,
      });
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 8), mat);
      puff.position.set(car.x + (G.rng() - 0.5), 1.6, car.z + (G.rng() - 0.5));
      G.scene.add(puff);
      G.effects.push({ kind: 'puff', mesh: puff, t: 0, dur: 1.4 });
    }
  }
  for (let i = G.effects.length - 1; i >= 0; i--) {
    const e = G.effects[i];
    if (e.kind !== 'puff') continue;
    e.t += dt;
    const k = e.t / e.dur;
    e.mesh.position.y += dt * 1.8;
    e.mesh.material.opacity = Math.max(0, 0.55 - k * 0.6);
    e.mesh.scale.setScalar(1 + k * 1.6);
    if (k >= 1) {
      G.scene.remove(e.mesh);
      G.effects.splice(i, 1);
    }
  }
}
