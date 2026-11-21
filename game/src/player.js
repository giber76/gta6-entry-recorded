// player.js — Marlo on foot: walking, turning, entering/exiting cars,
// health and the pistol. Marlo is a simple stylised figure built from
// boxes so the game needs no art assets.
import * as THREE from 'three';
import { clamp, forwardOf } from './util.js';

function makeMarloMesh() {
  const g = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98a5a });
  const shirt = new THREE.MeshLambertMaterial({ color: 0x2e6a8a });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2a2f38 });
  const hair = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), shirt);
  torso.position.y = 1.12;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.42, 0.38), skin);
  head.position.y = 1.7;
  g.add(head);
  const hairM = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.16, 0.42), hair);
  hairM.position.y = 1.94;
  g.add(hairM);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.78, 0.26), pants);
  legL.position.set(-0.17, 0.39, 0);
  g.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.17;
  g.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.66, 0.2), shirt);
  armL.position.set(-0.42, 1.14, 0);
  g.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.42;
  g.add(armR);
  // Pistol in the right hand (hidden until issued).
  const gun = new THREE.Mesh(
    new THREE.BoxGeometry(0.09, 0.14, 0.42),
    new THREE.MeshLambertMaterial({ color: 0x222222 }),
  );
  gun.position.set(0.42, 0.82, 0.3);
  gun.visible = false;
  g.add(gun);
  g.userData = { legL, legR, armL, armR, gun };
  return g;
}

export class Player {
  constructor(scene) {
    this.mesh = makeMarloMesh();
    scene.add(this.mesh);
    this.x = 0;
    this.z = 120;
    this.heading = 0;
    this.health = 100;
    this.hasPistol = false;
    this.weapon = null;
    this.inCar = false;
    this.car = null;
    this.walkSpeed = 7;
    this.pistolCooldown = 0;
    this.walkPhase = 0;
    this.sync();
  }

  sync() {
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
    this.mesh.userData.gun.visible = this.hasPistol;
  }

  givePistol() {
    this.hasPistol = true;
    this.weapon = 'pistol';
    this.sync();
  }

  heal() {
    this.health = 100;
  }

  damage(amount) {
    this.health = Math.max(0, this.health - amount);
    return this.health <= 0;
  }

  teleport(x, z, heading) {
    this.x = x;
    this.z = z;
    this.heading = heading;
    if (this.car) this.car.teleport(x, z, heading);
    this.sync();
  }

  enterCar(car) {
    this.inCar = true;
    this.car = car;
    this.mesh.visible = false;
    this.sync();
  }

  exitCar() {
    if (!this.car) return;
    // Step out to the driver's side (left of the car's forward).
    const h = this.car.heading;
    this.x = this.car.x + Math.cos(h) * 2.2;
    this.z = this.car.z - Math.sin(h) * 2.2;
    this.heading = this.car.heading;
    this.inCar = false;
    this.car = null;
    this.mesh.visible = true;
    this.sync();
  }

  // On-foot movement for one substep. Returns distance moved.
  walk(input, dt, colliders, pushOut) {
    const turnRate = 2.6;
    if (input.left) this.heading += turnRate * dt;
    if (input.right) this.heading -= turnRate * dt;
    let mx = 0;
    let mz = 0;
    if (input.forward) {
      const f = forwardOf(this.heading);
      mx += f.x;
      mz += f.z;
    }
    if (input.back) {
      const f = forwardOf(this.heading);
      mx -= f.x * 0.6;
      mz -= f.z * 0.6;
    }
    const len = Math.hypot(mx, mz);
    let moved = 0;
    if (len > 0) {
      const nx = this.x + (mx / len) * this.walkSpeed * dt;
      const nz = this.z + (mz / len) * this.walkSpeed * dt;
      const fixed = pushOut(nx, nz, 0.6, colliders);
      moved = Math.hypot(fixed.x - this.x, fixed.z - this.z);
      this.x = fixed.x;
      this.z = fixed.z;
      this.walkPhase += dt * 11;
      const swing = Math.sin(this.walkPhase) * 0.45;
      this.mesh.userData.legL.rotation.x = swing;
      this.mesh.userData.legR.rotation.x = -swing;
      this.mesh.userData.armL.rotation.x = -swing * 0.7;
      this.mesh.userData.armR.rotation.x = swing * 0.7;
    } else {
      this.mesh.userData.legL.rotation.x *= 0.8;
      this.mesh.userData.legR.rotation.x *= 0.8;
      this.mesh.userData.armL.rotation.x *= 0.8;
      this.mesh.userData.armR.rotation.x *= 0.8;
    }
    this.pistolCooldown = Math.max(0, this.pistolCooldown - dt);
    this.sync();
    return moved;
  }

  update(dt) {
    this.pistolCooldown = Math.max(0, this.pistolCooldown - dt);
  }
}
