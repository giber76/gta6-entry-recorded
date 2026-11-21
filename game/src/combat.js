// combat.js — shooting and the Viper enemies for Solara Bay.
// The pistol fires along the camera; the raycast skips the player's own
// car. Vipers hold a ~15 m standoff, strafe, and back off when Marlo
// closes in. M6 guards stand watch and do not shoot.
import * as THREE from 'three';
import { raySphere } from './player.js';
import { PISTOL_DAMAGE, PISTOL_RANGE } from './player.js';
import { clamp, dist2, angleDiff } from './util.js';

export class Viper {
  constructor(scene, x, z, opts = {}) {
    this.scene = scene;
    this.x = x;
    this.z = z;
    this.heading = 0;
    this.health = opts.health ?? 45; // 3 pistol rounds
    this.shoots = opts.shoots ?? true;
    this.alive = true;
    this.shootAcc = 1 + Math.random();
    this.strafeDir = Math.random() < 0.5 ? 1 : -1;
    this.strafeAcc = 0;
    this.group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.6, 3, 8), new THREE.MeshStandardMaterial({ color: 0x8a1f1f, roughness: 0.8 }));
    body.position.y = 1.05;
    this.group.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), new THREE.MeshStandardMaterial({ color: 0xc98a5a, roughness: 0.7 }));
    head.position.y = 1.68;
    this.group.add(head);
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.7), new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.4, metalness: 0.6 }));
    gun.position.set(0.3, 1.15, 0.4);
    this.group.add(gun);
    const sh = new THREE.Mesh(new THREE.CircleGeometry(0.45, 12), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2;
    sh.position.y = 0.02;
    this.group.add(sh);
    this.group.position.set(x, 0, z);
    scene.add(this.group);
  }

  hit(n) {
    if (!this.alive) return false;
    this.health -= n;
    if (this.health <= 0) {
      this.alive = false;
      this.group.visible = false;
      return true;
    }
    return false;
  }

  update(dt, px, pz, player) {
    if (!this.alive) return;
    const d = dist2(this.x, this.z, px, pz);
    // face the player
    this.heading = Math.atan2(px - this.x, pz - this.z);
    // hold ~15 m: back off when Marlo closes in, close in when far
    let radial = 0;
    if (d < 12) radial = -1;
    else if (d > 19) radial = 1;
    this.strafeAcc += dt;
    if (this.strafeAcc > 2.2) {
      this.strafeAcc = 0;
      this.strafeDir *= -1;
    }
    const mx = Math.sin(this.heading) * radial + Math.cos(this.heading) * this.strafeDir * 0.8;
    const mz = Math.cos(this.heading) * radial - Math.sin(this.heading) * this.strafeDir * 0.8;
    const len = Math.hypot(mx, mz) || 1;
    const sp = 1.6;
    this.x += (mx / len) * sp * dt;
    this.z += (mz / len) * sp * dt;
    this.x = clamp(this.x, -165, 165);
    this.z = clamp(this.z, -165, 165);
    this.group.position.set(this.x, 0, this.z);
    this.group.rotation.y = this.heading;
    // shoot back (only the standoff Vipers, not the M6 guards)
    if (this.shoots && d < 45) {
      this.shootAcc -= dt;
      if (this.shootAcc <= 0) {
        this.shootAcc = 2.4 + Math.random() * 0.8;
        if (Math.random() < 0.42) player.hurt(4);
      }
    }
  }
}

export class Combat {
  constructor(game) {
    this.game = game;
  }

  // Fire one pistol round from the shooter along the camera direction.
  // Returns 'car' | 'viper' | 'miss' and the hit object.
  shoot(origin, dir) {
    const g = this.game;
    let best = Infinity;
    let bestKind = 'miss';
    let bestObj = null;
    const consider = (t, kind, obj) => {
      if (t < best && t <= PISTOL_RANGE) {
        best = t;
        bestKind = kind;
        bestObj = obj;
      }
    };
    // cars (skip the player's own car, skip wrecked)
    for (const c of g.allCars()) {
      if (c.wrecked) continue;
      if (g.player.inCar && g.player.car === c) continue;
      const t = raySphere(origin.x, origin.y, origin.z, dir.x, dir.y, dir.z, c.x, 0.85, c.z, 2.3);
      consider(t, 'car', c);
    }
    // vipers
    for (const v of g.vipers) {
      if (!v.alive) continue;
      const t = raySphere(origin.x, origin.y, origin.z, dir.x, dir.y, dir.z, v.x, 1.2, v.z, 1.5);
      consider(t, 'viper', v);
    }
    if (bestKind === 'car') {
      const wrecked = bestObj.damage(PISTOL_DAMAGE);
      if (wrecked) g.onCarWrecked(bestObj);
      return { kind: 'car', obj: bestObj, wrecked };
    }
    if (bestKind === 'viper') {
      const killed = bestObj.hit(PISTOL_DAMAGE);
      if (killed) g.onViperKilled(bestObj);
      return { kind: 'viper', obj: bestObj, killed };
    }
    return { kind: 'miss', obj: null };
  }
}
