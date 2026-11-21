// combat.js — pistol shooting and the Viper gunmen of Solara Bay.
// The pistol is hitscan: a ray from Marlo along his heading, range 70 m,
// 15 damage a round, cooldown 0.25 s. The ray skips Marlo's own car.
// Vipers hold a ~15 m standoff, strafe, and shoot back.
import * as THREE from 'three';
import { dist2, headingTo } from './util.js';

const PISTOL_RANGE = 70;
const PISTOL_DAMAGE = 15;
const PISTOL_COOLDOWN = 0.25;

function raySphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, r) {
  const lx = cx - ox;
  const ly = cy - oy;
  const lz = cz - oz;
  const t = lx * dx + ly * dy + lz * dz;
  if (t < 0) return null;
  const px = ox + dx * t - cx;
  const py = oy + dy * t - cy;
  const pz = oz + dz * t - cz;
  const d2 = px * px + py * py + pz * pz;
  if (d2 > r * r) return null;
  return t;
}

export class Viper {
  constructor(scene, x, z) {
    this.x = x;
    this.z = z;
    this.hp = 30;
    this.alive = true;
    this.shootTimer = 1 + Math.random();
    this.strafeDir = Math.random() < 0.5 ? 1 : -1;
    this.strafeTimer = 2;
    this.deathTimer = 0;
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.36, 1.0, 8),
      new THREE.MeshLambertMaterial({ color: 0x2a2a33 })
    );
    body.position.y = 1.0;
    g.add(body);
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 8, 6),
      new THREE.MeshLambertMaterial({ color: 0xb08060 })
    );
    head.position.y = 1.7;
    g.add(head);
    const band = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.09, 0.5),
      new THREE.MeshBasicMaterial({ color: 0xcc2222 })
    );
    band.position.y = 1.82;
    g.add(band);
    const gun = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.08, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x111111 })
    );
    gun.position.set(0.2, 1.15, 0.3);
    g.add(gun);
    this.mesh = g;
    this.mesh.position.set(x, 0, z);
    scene.add(this.mesh);
  }

  update(dt, game) {
    if (!this.alive) {
      this.deathTimer -= dt;
      return;
    }
    const player = game.player;
    const d = dist2(this.x, this.z, player.x, player.z);
    // Hold a ~15 m standoff: close in past 20 m, back off inside 10 m.
    let mx = 0;
    let mz = 0;
    if (d > 20) {
      const h = headingTo(this.x, this.z, player.x, player.z);
      mx = Math.sin(h) * 2.5;
      mz = Math.cos(h) * 2.5;
    } else if (d < 10) {
      const h = headingTo(player.x, player.z, this.x, this.z);
      mx = Math.sin(h) * 2.5;
      mz = Math.cos(h) * 2.5;
    }
    // Strafe sideways.
    this.strafeTimer -= dt;
    if (this.strafeTimer <= 0) {
      this.strafeTimer = 2 + Math.random();
      this.strafeDir *= -1;
    }
    const toPlayer = headingTo(this.x, this.z, player.x, player.z);
    const strafeH = toPlayer + (Math.PI / 2) * this.strafeDir;
    mx += Math.sin(strafeH) * 1.5;
    mz += Math.cos(strafeH) * 1.5;
    this.x += mx * dt;
    this.z += mz * dt;
    const fixed = game.city.resolveCircle(this.x, this.z, 0.5);
    this.x = fixed.x;
    this.z = fixed.z;
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = toPlayer;
    // Shoot back at Marlo.
    this.shootTimer -= dt;
    if (this.shootTimer <= 0 && d < 50 && game.state === 'playing') {
      this.shootTimer = 1.4 + Math.random() * 0.6;
      game.effects.tracer(this.x, 1.3, this.z, player.x, 1.2, player.z, 0xffe9a8);
      if (player.car) player.car.damage(3, game);
      else player.damage(3, game);
    }
  }

  damage(amount, game) {
    if (!this.alive) return;
    this.hp -= amount;
    if (this.hp <= 0) {
      this.alive = false;
      this.deathTimer = 1.5;
      this.mesh.rotation.z = Math.PI / 2;
      this.mesh.position.y = 0.3;
      game.effects.burst(this.x, 1, this.z, 0xcc2222, 8);
    }
  }

  remove(scene) {
    scene.remove(this.mesh);
  }
}

export class Combat {
  constructor(scene) {
    this.scene = scene;
    this.cooldown = 0;
    this.tracerMat = new THREE.LineBasicMaterial({
      color: 0xffe9a8,
      transparent: true,
      opacity: 0.9,
    });
    this.tracers = [];
  }

  update(dt) {
    if (this.cooldown > 0) this.cooldown -= dt;
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const tr = this.tracers[i];
      tr.life -= dt;
      tr.line.material.opacity = Math.max(0, tr.life / 0.07);
      if (tr.life <= 0) {
        this.scene.remove(tr.line);
        this.tracers.splice(i, 1);
      }
    }
  }

  addTracer(x0, y0, z0, x1, y1, z1) {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(x0, y0, z0),
      new THREE.Vector3(x1, y1, z1),
    ]);
    const line = new THREE.Line(geo, this.tracerMat.clone());
    this.scene.add(line);
    this.tracers.push({ line, life: 0.07 });
  }

  // Fire one pistol round along Marlo's heading. Returns what it hit.
  shoot(game) {
    if (this.cooldown > 0) return null;
    const player = game.player;
    if (!player.hasPistol) return null;
    this.cooldown = PISTOL_COOLDOWN;
    const ox = player.x;
    const oy = 1.2;
    const oz = player.z;
    const dx = Math.sin(player.heading);
    const dy = 0;
    const dz = Math.cos(player.heading);
    let bestT = PISTOL_RANGE;
    let best = null;
    const cars = [
      ...game.traffic.parked,
      ...game.traffic.cars,
      ...game.police.cruisers,
    ];
    if (game.missions.bossCoupe) cars.push(game.missions.bossCoupe);
    if (game.missions.getawayCar) cars.push(game.missions.getawayCar);
    if (game.missions.m1Coupe) cars.push(game.missions.m1Coupe);
    for (const car of cars) {
      if (!car || car.wrecked) continue;
      if (car === player.car) continue; // never shoot your own car
      const t = raySphere(ox, oy, oz, dx, dy, dz, car.x, 0.9, car.z, 2.3);
      if (t !== null && t < bestT) {
        bestT = t;
        best = { kind: 'car', car };
      }
    }
    for (const e of game.enemies) {
      if (!e.alive) continue;
      const t = raySphere(ox, oy, oz, dx, dy, dz, e.x, 1.0, e.z, 1.3);
      if (t !== null && t < bestT) {
        bestT = t;
        best = { kind: 'enemy', enemy: e };
      }
    }
    const hx = ox + dx * bestT;
    const hz = oz + dz * bestT;
    this.addTracer(ox, oy, oz, hx, 1.1, hz);
    game.effects.muzzle(ox + dx * 1.2, 1.2, oz + dz * 1.2);
    game.audio.shot();
    if (best) {
      if (best.kind === 'car') {
        best.car.damage(PISTOL_DAMAGE, game);
        game.effects.burst(hx, 1.0, hz, 0xffcc66, 5);
      } else {
        best.enemy.damage(PISTOL_DAMAGE, game);
        game.effects.burst(hx, 1.1, hz, 0xff6666, 6);
      }
    }
    return best;
  }
}
