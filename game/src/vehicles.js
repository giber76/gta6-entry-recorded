// vehicles.js — cars for Solara Bay: player-driven arcade physics, traffic,
// parked cars, police cruisers and the boss coupe. Every car has 100 health;
// at 0 it wrecks with an explosion and the driver is ejected.
import * as THREE from 'three';
import { clamp, dirFromHeading } from './util.js';

export const TOP_SPEED = 46; // m/s, about 166 km/h
const ACCEL = 22;
const BRAKE = 30;
const REVERSE_TOP = 12;

function makeCarMesh(color, isPolice) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.62, 4.4), bodyMat);
  body.position.y = 0.62;
  g.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.55, 2.2),
    new THREE.MeshLambertMaterial({ color: 0x1c2733 })
  );
  cabin.position.set(0, 1.15, -0.25);
  g.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
  const wheels = [];
  for (const [x, z] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.38, z);
    g.add(w);
    wheels.push(w);
  }
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const x of [-0.7, 0.7]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.15, 0.1), lightMat);
    hl.position.set(x, 0.7, 2.22);
    g.add(hl);
  }
  let lightBar = null;
  if (isPolice) {
    lightBar = new THREE.Group();
    const red = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.18, 0.3),
      new THREE.MeshBasicMaterial({ color: 0xff2222 })
    );
    red.position.x = -0.3;
    const blue = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.18, 0.3),
      new THREE.MeshBasicMaterial({ color: 0x2266ff })
    );
    blue.position.x = 0.3;
    lightBar.add(red);
    lightBar.add(blue);
    lightBar.position.set(0, 1.55, 0.1);
    lightBar.userData.red = red;
    lightBar.userData.blue = blue;
    g.add(lightBar);
  }
  return { group: g, wheels, lightBar };
}

export class Car {
  constructor(scene, x, z, heading, color, kind) {
    this.kind = kind; // 'player' | 'traffic' | 'parked' | 'police' | 'boss'
    this.x = x;
    this.z = z;
    this.heading = heading;
    this.speed = 0;
    this.health = 100;
    this.wrecked = false;
    this.wreckTimer = 0;
    this.smokeTimer = 0;
    this.ramCooldown = 0;
    this.homeX = x;
    this.homeZ = z;
    this.homeHeading = heading;
    const built = makeCarMesh(color, kind === 'police');
    this.mesh = built.group;
    this.wheels = built.wheels;
    this.lightBar = built.lightBar;
    this.mesh.position.set(x, 0, z);
    this.mesh.rotation.y = heading;
    scene.add(this.mesh);
  }

  forward() {
    return dirFromHeading(this.heading);
  }

  // Arcade driving step. throttle: 1 forward, -1 brake/reverse. steer: -1..1.
  drive(dt, throttle, steer) {
    if (this.wrecked) return;
    const f = this.forward();
    if (throttle > 0) {
      this.speed += ACCEL * dt;
    } else if (throttle < 0) {
      if (this.speed > 0.5) this.speed -= BRAKE * dt;
      else this.speed -= ACCEL * 0.6 * dt;
    } else {
      this.speed -= this.speed * 0.8 * dt;
    }
    this.speed = clamp(this.speed, -REVERSE_TOP, TOP_SPEED);
    // Steering bites harder at low speed, less at top speed.
    const steerAuthority = clamp(Math.abs(this.speed) / 10, 0.15, 1);
    this.heading += steer * 1.9 * steerAuthority * dt * Math.sign(this.speed || 1);
    this.x += f.x * this.speed * dt;
    this.z += f.z * this.speed * dt;
    this.syncMesh();
  }

  syncMesh() {
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
    for (const w of this.wheels) w.rotation.x += this.speed * 0.016;
  }

  damage(amount, game) {
    if (this.wrecked) return false;
    this.health -= amount;
    if (this.health <= 0) {
      this.health = 0;
      this.wreck(game);
      return true;
    }
    return false;
  }

  wreck(game) {
    if (this.wrecked) return;
    this.wrecked = true;
    this.wreckTimer = 8;
    this.speed = 0;
    if (game) {
      game.effects.explosion(this.x, 1, this.z);
      game.audio.explosion();
      game.peds.scatter(this.x, this.z, 14);
      game.shake = Math.max(game.shake, 0.7);
    }
    // Tip the wreck on its side a little.
    this.mesh.rotation.z = 0.12;
  }

  repair() {
    this.health = 100;
    if (this.wrecked) {
      this.wrecked = false;
      this.mesh.rotation.z = 0;
    }
  }

  update(dt, game) {
    if (this.wrecked) {
      this.wreckTimer -= dt;
      return;
    }
    if (this.ramCooldown > 0) this.ramCooldown -= dt;
    // Smoke below 50 health, fire below 25.
    if (this.health < 50) {
      this.smokeTimer -= dt;
      if (this.smokeTimer <= 0) {
        this.smokeTimer = this.health < 25 ? 0.08 : 0.22;
        game.effects.smoke(this.x, 1.2, this.z, this.health < 25);
      }
    }
    if (this.lightBar) {
      const on = Math.floor(game.elapsed * 4) % 2 === 0;
      this.lightBar.userData.red.material.color.setHex(on ? 0xff2222 : 0x661111);
      this.lightBar.userData.blue.material.color.setHex(on ? 0x113366 : 0x2266ff);
    }
  }

  remove(scene) {
    scene.remove(this.mesh);
  }
}
