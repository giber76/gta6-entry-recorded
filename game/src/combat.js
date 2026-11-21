// combat.js — the pistol and the Vipers. Shooting is a ray from the
// camera along where it aims; it tests enemy spheres and car bodies,
// skips the player's own car, and reaches 70 m. Vipers hold a standoff
// at ~15 m, strafe, back off when Marlo closes in, and shoot back.
import * as THREE from 'three';
import { makeRng, clamp, headingTo, dist2D } from './util.js';

export const PISTOL_DAMAGE = 15;
export const PISTOL_RANGE = 70;
const COOLDOWN = 0.25;

function makeViperMesh() {
  const g = new THREE.Group();
  const suit = new THREE.MeshLambertMaterial({ color: 0x1f1f24 });
  const skin = new THREE.MeshLambertMaterial({ color: 0xb07a4a });
  const vest = new THREE.MeshLambertMaterial({ color: 0x5a1f1f });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), suit);
  torso.position.y = 1.12;
  g.add(torso);
  const vestM = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.4, 0.38), vest);
  vestM.position.y = 1.18;
  g.add(vestM);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.42, 0.38), skin);
  head.position.y = 1.7;
  g.add(head);
  const shades = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.1, 0.1), new THREE.MeshLambertMaterial({ color: 0x000000 }));
  shades.position.set(0, 1.74, 0.2);
  g.add(shades);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.78, 0.26), suit);
  legL.position.set(-0.17, 0.39, 0);
  g.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.17;
  g.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.66, 0.2), suit);
  armL.position.set(-0.42, 1.14, 0);
  g.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.42;
  g.add(armR);
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.14, 0.46), new THREE.MeshLambertMaterial({ color: 0x222222 }));
  gun.position.set(0.42, 0.85, 0.32);
  g.add(gun);
  g.userData = { legL, legR };
  return g;
}

export class Vipers {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
    this.rng = makeRng(999);
  }

  get count() {
    return this.list.filter((v) => v.alive).length;
  }

  get alive() {
    return this.list.filter((v) => v.alive);
  }

  spawn(x, z, count, spread = 8) {
    for (let i = 0; i < count; i++) {
      const mesh = makeViperMesh();
      const px = x + this.rng.range(-spread, spread);
      const pz = z + this.rng.range(-spread, spread);
      mesh.position.set(px, 0, pz);
      this.scene.add(mesh);
      this.list.push({
        mesh, x: px, z: pz, heading: 0,
        health: 30, alive: true,
        shootCooldown: this.rng.range(0.6, 1.6),
        strafeDir: this.rng.chance(0.5) ? 1 : -1,
        strafeTimer: this.rng.range(1, 2.5),
        phase: this.rng.range(0, Math.PI * 2),
      });
    }
  }

  clear() {
    for (const v of this.list) this.scene.remove(v.mesh);
    this.list = [];
  }

  nearest(x, z) {
    let best = null;
    let bestD = Infinity;
    for (const v of this.alive) {
      const d = dist2D(x, z, v.x, v.z);
      if (d < bestD) {
        bestD = d;
        best = v;
      }
    }
    return best;
  }

  // Damage the nearest Viper to a ray. Returns the Viper hit, if any.
  rayHit(origin, dir, maxDist) {
    let best = null;
    let bestT = maxDist;
    for (const v of this.alive) {
      // Sphere at chest height, radius 1.3.
      const cx = v.x - origin.x;
      const cy = 1.2 - origin.y;
      const cz = v.z - origin.z;
      const t = cx * dir.x + cy * dir.y + cz * dir.z;
      if (t < 0 || t > bestT) continue;
      const dx = cx - dir.x * t;
      const dy = cy - dir.y * t;
      const dz = cz - dir.z * t;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < 1.3 * 1.3) {
        bestT = t;
        best = v;
      }
    }
    return best ? { viper: best, dist: bestT } : null;
  }

  damage(viper, amount, effects) {
    viper.health -= amount;
    if (viper.health <= 0 && viper.alive) {
      viper.alive = false;
      viper.mesh.visible = false;
      // Fall over: sink the mesh slightly and lay it down.
      viper.mesh.rotation.x = -Math.PI / 2;
      viper.mesh.position.y = 0.3;
      viper.mesh.visible = true;
      effects.explode(viper.x, viper.z);
      return true;
    }
    return false;
  }

  update(dt, player, effects, onPlayerHit) {
    for (const v of this.alive) {
      const dx = player.x - v.x;
      const dz = player.z - v.z;
      const d = Math.hypot(dx, dz);
      // Face Marlo.
      v.heading = Math.atan2(dx, dz);
      // Standoff: hold ~15 m; back off if Marlo closes in, close in if far.
      let moveX = 0;
      let moveZ = 0;
      if (d < 12) {
        moveX = -dx / d;
        moveZ = -dz / d;
      } else if (d > 20) {
        moveX = dx / d;
        moveZ = dz / d;
      }
      // Strafe sideways, flipping direction every couple of seconds.
      v.strafeTimer -= dt;
      if (v.strafeTimer <= 0) {
        v.strafeDir *= -1;
        v.strafeTimer = this.rng.range(1, 2.5);
      }
      const sx = -dz / (d || 1);
      const sz = dx / (d || 1);
      const speed = 3.2;
      const mx = (moveX + sx * v.strafeDir * 0.8) * speed * dt;
      const mz = (moveZ + sz * v.strafeDir * 0.8) * speed * dt;
      v.x = clamp(v.x + mx, -175, 180);
      v.z = clamp(v.z + mz, -175, 180);
      v.phase += dt * 9;
      const swing = Math.sin(v.phase) * 0.45;
      v.mesh.userData.legL.rotation.x = swing;
      v.mesh.userData.legR.rotation.x = -swing;
      v.mesh.position.set(v.x, 0, v.z);
      v.mesh.rotation.y = v.heading;
      // Shoot back: slow, inaccurate, modest damage.
      v.shootCooldown -= dt;
      if (v.shootCooldown <= 0 && d < 45) {
        v.shootCooldown = this.rng.range(1.1, 2.0);
        if (this.rng.chance(0.45)) {
          effects.muzzle(v.x, 1.3, v.z, dx / d, dz / d);
          onPlayerHit(this.rng.int(3, 6));
        }
      }
    }
  }
}

// Ray-vs-car-bodies: each car is a sphere (r=2.6) at its centre +0.8 up.
// Returns {car, dist} for the nearest hit, or null.
export function rayHitCars(origin, dir, maxDist, cars, skipCar) {
  let best = null;
  let bestT = maxDist;
  for (const c of cars) {
    if (c === skipCar || c.wrecked) continue;
    const cx = c.x - origin.x;
    const cy = 0.8 - origin.y;
    const cz = c.z - origin.z;
    const t = cx * dir.x + cy * dir.y + cz * dir.z;
    if (t < 0 || t > bestT) continue;
    const dx = cx - dir.x * t;
    const dy = cy - dir.y * t;
    const dz = cz - dir.z * t;
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 < 2.6 * 2.6) {
      bestT = t;
      best = c;
    }
  }
  return best ? { car: best, dist: bestT } : null;
}

export class Pistol {
  constructor() {
    this.cooldown = 0;
  }

  get ready() {
    return this.cooldown <= 0;
  }

  update(dt) {
    this.cooldown = Math.max(0, this.cooldown - dt);
  }

  // Fire once along `dir` from `origin`. Hits the nearest Viper or car
  // body inside range; the player's own car is never a target.
  fire(origin, dir, ctx) {
    if (!this.ready) return null;
    this.cooldown = COOLDOWN;
    const { vipers, cars, skipCar, effects, player } = ctx;
    const vHit = vipers.rayHit(origin, dir, PISTOL_RANGE);
    const cHit = rayHitCars(origin, dir, PISTOL_RANGE, cars, skipCar);
    let target = null;
    let kind = null;
    if (vHit && (!cHit || vHit.dist <= cHit.dist)) {
      target = vHit.viper;
      kind = 'viper';
    } else if (cHit) {
      target = cHit.car;
      kind = 'car';
    }
    // Muzzle flash at the shooter's position.
    const f = { x: dir.x, z: dir.z };
    effects.muzzle(origin.x + f.x * 0.8, origin.y, origin.z + f.z * 0.8, f.x, f.z);
    if (kind === 'viper') {
      const killed = vipers.damage(target, PISTOL_DAMAGE, effects);
      return { kind, target, killed };
    }
    if (kind === 'car') {
      const wrecked = target.damage(PISTOL_DAMAGE, effects);
      return { kind, target, wrecked };
    }
    return { kind: 'miss' };
  }
}
