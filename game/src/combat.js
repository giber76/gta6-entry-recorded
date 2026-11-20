// combat.js — pistol shooting + Viper enemies for Solara Bay.
// Shots are a horizontal ray from Marlo's chest along the camera yaw.
// The ray skips Marlo's own car, reaches 70 m, and deals 15 damage.
// Vipers hold a ~15 m standoff, strafe slowly, back off when Marlo
// closes in, and shoot back rarely and weakly.

import { dist2d, headingTo, angleDelta, clamp, mulberry32, forwardOf } from './util.js';

export const PISTOL_DAMAGE = 15;
export const PISTOL_RANGE = 70;
export const PISTOL_COOLDOWN = 0.25;
export const VIPER_HEALTH = 100;

export class Viper {
  constructor(world, x, z, role) {
    this.world = world;
    this.x = x;
    this.z = z;
    this.heading = 0;
    this.health = VIPER_HEALTH;
    this.role = role; // 'm3' | 'm4' | 'm6'
    this.alive = true;
    this.strafeDir = Math.random() > 0.5 ? 1 : -1;
    this.strafeTimer = 1 + Math.random() * 2;
    this.shootTimer = 2 + Math.random() * 1.5;
    this.deathTimer = 0;
    this.buildMesh();
  }

  buildMesh() {
    const THREE = window.THREE;
    const g = new THREE.Group();
    const vest = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
    const pants = new THREE.MeshLambertMaterial({ color: 0x2a2a30 });
    const skin = new THREE.MeshLambertMaterial({ color: 0xb98a62 });
    const band = new THREE.MeshLambertMaterial({ color: 0x8a1a1a });

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.8, 0.36), vest);
    torso.position.y = 1.05;
    g.add(torso);
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.75, 0.32), pants);
    legs.position.y = 0.38;
    g.add(legs);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.4), skin);
    head.position.y = 1.68;
    g.add(head);
    const bandana = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.12, 0.44), band);
    bandana.position.y = 1.86;
    g.add(bandana);
    // A visible gun so the standoff reads in screenshots.
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.7), vest);
    gun.position.set(0.3, 1.15, 0.3);
    g.add(gun);

    this.mesh = g;
    this.mesh.position.set(this.x, 0, this.z);
    this.world.scene.add(this.mesh);
  }

  damage(amount) {
    if (!this.alive) return;
    this.health -= amount;
    if (this.health <= 0) {
      this.health = 0;
      this.alive = false;
      this.deathTimer = 0;
      // Fall over.
      this.mesh.rotation.x = -Math.PI / 2;
      this.mesh.position.y = 0.3;
      this.world.missions.onViperDown(this);
    }
  }

  update(dt) {
    if (!this.alive) {
      this.deathTimer += dt;
      if (this.deathTimer > 6) {
        this.world.scene.remove(this.mesh);
        this.gone = true;
      }
      return;
    }
    const w = this.world;
    const p = w.player;
    const d = dist2d(this.x, this.z, p.x, p.z);
    // Face the player.
    this.heading = headingTo(this.x, this.z, p.x, p.z);

    // Hold ~15 m: back off if Marlo closes in, close in if too far.
    let mx = 0;
    let mz = 0;
    if (d < 11) {
      mx = (this.x - p.x) / (d || 1);
      mz = (this.z - p.z) / (d || 1);
    } else if (d > 19) {
      mx = (p.x - this.x) / (d || 1);
      mz = (p.z - this.z) / (d || 1);
    }
    // Strafe sideways, flipping direction every couple of seconds.
    this.strafeTimer -= dt;
    if (this.strafeTimer <= 0) {
      this.strafeTimer = 1.5 + Math.random() * 2;
      this.strafeDir *= -1;
    }
    const px = -Math.cos(this.heading) * this.strafeDir;
    const pz = Math.sin(this.heading) * this.strafeDir;
    const speed = 1.3;
    this.x += (mx * 2.2 + px * speed) * dt;
    this.z += (mz * 2.2 + pz * speed) * dt;
    this.x = clamp(this.x, -175, 175);
    this.z = clamp(this.z, -175, 175);
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;

    // Shoot back: rare, weak, only inside 40 m.
    this.shootTimer -= dt;
    if (this.shootTimer <= 0) {
      this.shootTimer = 2.2 + Math.random() * 1.5;
      if (d < 40 && w.state === 'playing') {
        p.hurt(3);
      }
    }
  }
}

export function createCombat(world) {
  const combat = {
    cooldown: 0,
  };

  // Fire one pistol round along the camera yaw. Returns the thing hit.
  combat.fire = function () {
    const p = world.player;
    if (!p.hasPistol || world.state !== 'playing') return null;
    if (combat.cooldown > 0) return null;
    combat.cooldown = PISTOL_COOLDOWN;
    world.audio.shoot();
    world.effects.muzzle(p);

    const f = forwardOf(p.heading);
    const ox = p.x;
    const oz = p.z;
    let best = null;
    let bestAlong = PISTOL_RANGE;

    function consider(tx, tz, radius, target) {
      const dx = tx - ox;
      const dz = tz - oz;
      const along = dx * f.x + dz * f.z;
      if (along <= 0 || along > bestAlong) return;
      // Perpendicular distance from the ray to the target centre.
      const perp = Math.abs(dx * f.z - dz * f.x);
      if (perp > radius) return;
      bestAlong = along;
      best = target;
    }

    // Vipers first (they are the mission targets).
    for (const v of world.vipers) {
      if (!v.alive) continue;
      consider(v.x, v.z, 1.5, { type: 'viper', viper: v });
    }
    // Then every car except Marlo's own.
    for (const car of world.cars) {
      if (car.wrecked) continue;
      if (p.inCar && car === p.car) continue;
      consider(car.x, car.z, 2.1, { type: 'car', car });
    }

    if (!best) return null;
    if (best.type === 'viper') {
      best.viper.damage(PISTOL_DAMAGE);
    } else {
      best.car.damage(PISTOL_DAMAGE, 'pistol');
    }
    return best;
  };

  combat.update = function (dt) {
    if (combat.cooldown > 0) combat.cooldown -= dt;
    // Mouse click on the canvas also fires.
    if (world.input.wasPressed('Mouse0')) combat.fire();
    // Prune dead Vipers whose meshes were removed.
    world.vipers = world.vipers.filter((v) => !v.gone);
    for (const v of world.vipers) v.update(dt);
  };

  combat.spawnViper = function (x, z, role) {
    const v = new Viper(world, x, z, role);
    world.vipers.push(v);
    return v;
  };

  combat.clearVipers = function (role) {
    for (const v of world.vipers) {
      if (role && v.role !== role) continue;
      if (!v.alive) continue;
      v.alive = false;
      v.gone = true;
      world.scene.remove(v.mesh);
    }
    world.vipers = world.vipers.filter((v) => !v.gone);
  };

  combat.aliveCount = function () {
    let n = 0;
    for (const v of world.vipers) if (v.alive) n++;
    return n;
  };

  world.combat = combat;
  return combat;
}
