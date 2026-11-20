// vehicles.js — car physics, damage and wrecks for Solara Bay.
// One Car class serves mission cars, parked cars, traffic and police:
// same body, same 100 health, same wreck behaviour. Only the driver
// (player / traffic AI / police AI) differs.

import { clamp, forwardOf, wrapAngle } from './util.js';
import { pushOutOfBuildings, clampToWorld } from './city.js';

export const CAR_HEALTH = 100;
export const TOP_SPEED = 40; // m/s (~144 km/h)
export const ACCEL = 17; // m/s^2
export const BRAKE = 30;
export const REVERSE_TOP = 12;

const BODY_COLORS = [0xc23b2e, 0x2e6fc2, 0x3a3a3a, 0xd8b13c, 0x4a7d4a, 0x8a5ac2, 0xc2c2c2];

export class Car {
  constructor(world, opts) {
    this.world = world;
    this.x = opts.x;
    this.z = opts.z;
    this.heading = opts.heading || 0;
    this.speed = 0;
    this.health = CAR_HEALTH;
    this.kind = opts.kind || 'traffic'; // mission | parked | traffic | police
    this.label = opts.label || this.kind;
    this.wrecked = false;
    this.wreckTimer = 0;
    this.respawnAt = null; // {x, z, heading} for cars that come back
    this.respawnDelay = opts.respawnDelay || 0;
    this.smokeTimer = 0;
    this.burnTimer = 0;
    this.hitCooldown = 0; // seconds before this car can damage again
    this.driver = null; // 'player' | 'traffic' | 'police' | null
    this.route = opts.route || null; // traffic loop waypoints
    this.routeIndex = 0;
    this.yieldTimer = 0;
    this.id = world.nextCarId++;
    this.buildMesh(opts.color);
  }

  buildMesh(color) {
    const THREE = window.THREE;
    const g = new THREE.Group();
    const paint = new THREE.MeshLambertMaterial({
      color: color !== undefined ? color : BODY_COLORS[this.id % BODY_COLORS.length],
    });
    const dark = new THREE.MeshLambertMaterial({ color: 0x1c1c20 });
    const glass = new THREE.MeshLambertMaterial({ color: 0x9fd4e8 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.65, 4.4), paint);
    body.position.y = 0.55;
    g.add(body);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.2), glass);
    cabin.position.set(0, 1.1, -0.2);
    g.add(cabin);
    const axleF = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.5, 0.6), dark);
    axleF.position.set(0, 0.3, 1.45);
    g.add(axleF);
    const axleR = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.5, 0.6), dark);
    axleR.position.set(0, 0.3, -1.45);
    g.add(axleR);
    // Headlights so cars read at night / in screenshots.
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
    const lampL = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.15, 0.1), lampMat);
    lampL.position.set(-0.6, 0.6, 2.22);
    g.add(lampL);
    const lampR = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.15, 0.1), lampMat);
    lampR.position.set(0.6, 0.6, 2.22);
    g.add(lampR);

    this.mesh = g;
    this.bodyMat = paint;
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
    this.world.scene.add(this.mesh);
  }

  // Drive inputs: throttle -1..1, steer -1..1. dt in game seconds.
  drive(dt, throttle, steer) {
    if (this.wrecked) return;
    const w = this.world;
    if (throttle > 0) {
      this.speed += ACCEL * throttle * dt;
    } else if (throttle < 0) {
      if (this.speed > 0.5) this.speed -= BRAKE * dt;
      else this.speed -= ACCEL * 0.6 * dt;
    } else {
      // Engine drag + rolling resistance.
      this.speed -= this.speed * 0.6 * dt;
      if (Math.abs(this.speed) < 0.1) this.speed = 0;
    }
    this.speed = clamp(this.speed, -REVERSE_TOP, TOP_SPEED);
    // Steering bites harder at low speed, less at top speed.
    const steerAuthority = clamp(Math.abs(this.speed) / 12, 0.25, 1);
    this.heading += steer * steerAuthority * 1.9 * dt * Math.sign(this.speed || 1);
    this.heading = wrapAngle(this.heading);

    const f = forwardOf(this.heading);
    let nx = this.x + f.x * this.speed * dt;
    let nz = this.z + f.z * this.speed * dt;
    const clamped = clampToWorld(nx, nz);
    nx = clamped.x;
    nz = clamped.z;
    // Buildings: slide along them, and a hard hit costs health.
    const before = { x: this.x, z: this.z };
    const fixed = pushOutOfBuildings(w, nx, nz, 1.6);
    const hitWall = Math.abs(fixed.x - nx) > 0.01 || Math.abs(fixed.z - nz) > 0.01;
    if (hitWall) {
      const impact = Math.abs(this.speed);
      if (impact > 9 && this.hitCooldown <= 0) {
        this.damage(Math.min(20, (impact - 9) * 1.6), 'building');
        this.hitCooldown = 1;
        w.audio.crash();
      }
      this.speed *= 0.45;
    }
    this.x = fixed.x;
    this.z = fixed.z;
    void before;
    this.syncMesh();
  }

  // Plain movement without player input (used by traffic / police).
  moveTo(dt, nx, nz, heading) {
    this.x = nx;
    this.z = nz;
    this.heading = heading;
    this.syncMesh();
  }

  damage(amount, source) {
    if (this.wrecked) return;
    this.health -= amount;
    if (this.health <= 0) {
      this.health = 0;
      this.wreck();
    }
  }

  repair() {
    if (this.wrecked) return;
    this.health = CAR_HEALTH;
  }

  wreck() {
    if (this.wrecked) return;
    this.wrecked = true;
    this.speed = 0;
    this.wreckTimer = 0;
    this.bodyMat.color.setHex(0x222222);
    this.world.effects.explode(this.x, this.z, 1);
    if (this.driver === 'player') {
      this.world.player.ejectFromCar();
    }
  }

  respawn() {
    if (!this.respawnAt) return;
    this.x = this.respawnAt.x;
    this.z = this.respawnAt.z;
    this.heading = this.respawnAt.heading || 0;
    this.speed = 0;
    this.health = CAR_HEALTH;
    this.wrecked = false;
    this.mesh.visible = true;
    this.bodyMat.color.setHex(this.respawnAt.color);
    this.syncMesh();
  }

  update(dt) {
    if (this.hitCooldown > 0) this.hitCooldown -= dt;
    if (this.wrecked) {
      this.wreckTimer += dt;
      if (this.respawnAt && this.respawnDelay > 0 && this.wreckTimer >= this.respawnDelay) {
        this.respawn();
      }
      return;
    }
    // Smoke below 50 health, fire below 25.
    if (this.health < 50) {
      this.smokeTimer -= dt;
      if (this.smokeTimer <= 0) {
        this.smokeTimer = this.health < 25 ? 0.12 : 0.3;
        this.world.effects.puff(this.x, this.z, this.health < 25);
      }
    }
    this.syncMesh();
  }

  syncMesh() {
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
  }

  get speedKmh() {
    return Math.abs(this.speed) * 3.6;
  }
}

// The player drives this car with W/S/A/D.
export function drivePlayerCar(world, dt) {
  const car = world.player.car;
  if (!car || car.wrecked) return;
  const input = world.input;
  let throttle = 0;
  if (input.held('KeyW') || input.held('ArrowUp')) throttle = 1;
  else if (input.held('KeyS') || input.held('ArrowDown')) throttle = -1;
  let steer = 0;
  if (input.held('KeyA') || input.held('ArrowLeft')) steer = -1;
  else if (input.held('KeyD') || input.held('ArrowRight')) steer = 1;
  car.drive(dt, throttle, steer);
  world.player.x = car.x;
  world.player.z = car.z;
  world.player.heading = car.heading;
  world.player.speed = car.speed;
}
