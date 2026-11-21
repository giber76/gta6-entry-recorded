// player.js — Marlo, the player character of Solara Bay.
// On foot he walks with W and turns with A/D or the mouse; E enters the
// nearest car, E again exits it. In a car the car drives him.
import * as THREE from 'three';
import { clamp, dirFromHeading } from './util.js';

const WALK_SPEED = 8;

function makeMarloMesh() {
  const g = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: 0x2a6a4a });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 1.0, 8), jacket);
  body.position.y = 1.0;
  g.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.26, 10, 8),
    new THREE.MeshLambertMaterial({ color: 0xc89878 })
  );
  head.position.y = 1.72;
  g.add(head);
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.28, 0.1, 10),
    new THREE.MeshLambertMaterial({ color: 0x1c1c22 })
  );
  cap.position.y = 1.9;
  g.add(cap);
  const legMat = new THREE.MeshLambertMaterial({ color: 0x2a2a33 });
  for (const x of [-0.14, 0.14]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.85, 6), legMat);
    leg.position.set(x, 0.42, 0);
    g.add(leg);
  }
  return g;
}

export class Player {
  constructor(scene) {
    this.x = 0;
    this.z = 120;
    this.heading = 0;
    this.health = 100;
    this.hasPistol = false;
    this.weapon = null;
    this.car = null; // the Car Marlo is driving, or null on foot
    this.walkPhase = 0;
    this.mesh = makeMarloMesh();
    this.mesh.position.set(this.x, 0, this.z);
    scene.add(this.mesh);
  }

  get inCar() {
    return this.car !== null;
  }

  // On-foot step. Returns nothing; the camera follows in main.js.
  updateOnFoot(dt, game) {
    const input = game.input;
    const turn = (input.down('KeyA') ? 1 : 0) - (input.down('KeyD') ? 1 : 0);
    this.heading += turn * 2.6 * dt;
    this.heading += game.input.takeMouseDX() * 0.0022;
    const f = dirFromHeading(this.heading);
    let moving = false;
    if (input.down('KeyW')) {
      this.x += f.x * WALK_SPEED * dt;
      this.z += f.z * WALK_SPEED * dt;
      moving = true;
    }
    if (input.down('KeyS')) {
      this.x -= f.x * WALK_SPEED * 0.55 * dt;
      this.z -= f.z * WALK_SPEED * 0.55 * dt;
      moving = true;
    }
    const fixed = game.city.resolveCircle(this.x, this.z, 0.5);
    this.x = fixed.x;
    this.z = fixed.z;
    if (moving) this.walkPhase += dt * 9;
    const bob = moving ? Math.sin(this.walkPhase) * 0.06 : 0;
    this.mesh.position.set(this.x, bob, this.z);
    this.mesh.rotation.y = this.heading;
  }

  syncToCar() {
    if (!this.car) return;
    this.x = this.car.x;
    this.z = this.car.z;
    this.heading = this.car.heading;
    this.mesh.position.set(this.x, -2, this.z); // hidden under the car
  }

  enterCar(car) {
    this.car = car;
    this.x = car.x;
    this.z = car.z;
    this.heading = car.heading;
    this.mesh.position.set(this.x, -2, this.z);
  }

  exitCar(game) {
    if (!this.car) return;
    const car = this.car;
    const f = dirFromHeading(car.heading);
    // Step out on the driver's side.
    const side = { x: Math.cos(car.heading), z: -Math.sin(car.heading) };
    this.x = car.x + side.x * 2.2;
    this.z = car.z + side.z * 2.2;
    const fixed = game.city.resolveCircle(this.x, this.z, 0.5);
    this.x = fixed.x;
    this.z = fixed.z;
    this.heading = car.heading;
    this.car = null;
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
    void f;
  }

  damage(amount, game) {
    this.health = clamp(this.health - amount, 0, 100);
    if (this.health <= 0) game.setBusted();
  }

  heal() {
    this.health = 100;
  }

  givePistol() {
    this.hasPistol = true;
    this.weapon = 'pistol';
  }

  speedKmh() {
    return this.car ? Math.abs(this.car.speed) * 3.6 : 0;
  }
}
