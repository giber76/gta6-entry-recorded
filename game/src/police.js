// police.js — police pursuit for Solara Bay.
// When wanted > 0, two patrol cars chase Marlo. They are slower than his
// car, so a fast driver escapes; they ram (small damage) when they touch
// his car, and they only bust him if they pin him down while he is barely
// moving. Wrecked patrol cars sit out 8 s, then return while wanted > 0.

import { Car } from './vehicles.js';
import { dist2d, headingTo, angleDelta, clamp } from './util.js';

const POLICE_TOP = 28; // m/s — slower than the player's 40
const RAM_RANGE = 3.6;
const RAM_DAMAGE = 8;
const BUST_RANGE = 3.2;
const BUST_SPEED = 2; // player must be slower than this to be pinned
const BUST_TIME = 3; // game-seconds pinned before busted
const SPAWN_DIST = 45;

export function createPolice(world) {
  const police = {
    cars: [],
    bustTimer: 0,
  };

  function spawnOne(x, z) {
    const car = new Car(world, {
      x,
      z,
      heading: 0,
      kind: 'police',
      label: 'police',
      color: 0x1a1a22,
      respawnDelay: 8,
    });
    car.driver = 'police';
    car.respawnAt = { x, z, heading: 0, color: 0x1a1a22 };
    // Light bar so patrol cars read in the dark and in screenshots.
    const THREE = window.THREE;
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 0.18, 0.5),
      new THREE.MeshBasicMaterial({ color: 0x2244ff }),
    );
    bar.position.set(0, 1.45, -0.2);
    car.mesh.add(bar);
    police.cars.push(car);
    world.cars.push(car);
    return car;
  }

  police.ensurePatrol = function () {
    if (world.wanted <= 0) return;
    // Prune patrol cars that were wrecked long ago and already respawned
    // elsewhere is handled by the Car respawn; just keep two active.
    const active = police.cars.filter((c) => !c.wrecked);
    if (active.length >= 2) return;
    const p = world.player;
    const angle = Math.random() * Math.PI * 2;
    const x = p.x + Math.sin(angle) * SPAWN_DIST;
    const z = p.z + Math.cos(angle) * SPAWN_DIST;
    spawnOne(x, z);
  };

  police.clearPatrol = function () {
    for (const car of police.cars) {
      car.wrecked = true;
      car.respawnAt = null; // never comes back once cleared
      car.mesh.visible = false;
    }
    police.cars = [];
    police.bustTimer = 0;
  };

  police.update = function (dt) {
    const p = world.player;
    if (world.wanted > 0) police.ensurePatrol();

    let pinned = false;
    for (const car of police.cars) {
      if (car.wrecked) continue;
      if (world.wanted <= 0) {
        // Heat is off: cruise away and fade out.
        car.speed = Math.max(0, car.speed - 8 * dt);
        car.drive(dt, 0, 0);
        continue;
      }
      // Chase: steer at the player, top speed below the player's.
      const want = headingTo(car.x, car.z, p.x, p.z);
      const turn = angleDelta(car.heading, want);
      car.heading += clamp(turn, -1.8 * dt, 1.8 * dt);
      const d = dist2d(car.x, car.z, p.x, p.z);
      if (d > 8) car.speed = Math.min(POLICE_TOP, car.speed + 12 * dt);
      else car.speed = Math.max(6, car.speed - 6 * dt);
      const f = { x: Math.sin(car.heading), z: Math.cos(car.heading) };
      const nx = car.x + f.x * car.speed * dt;
      const nz = car.z + f.z * car.speed * dt;
      car.moveTo(dt, nx, nz, car.heading);

      // Ram the player's car on contact.
      if (p.inCar && p.car && !p.car.wrecked && d < RAM_RANGE && car.hitCooldown <= 0) {
        car.hitCooldown = 1;
        p.car.damage(RAM_DAMAGE, 'police');
        world.audio.crash();
      }
      // Ram Marlo on foot.
      if (!p.inCar && d < 2.2 && car.hitCooldown <= 0) {
        car.hitCooldown = 1;
        p.hurt(6);
      }
      // Pin-down check: close and the player is barely moving.
      const playerSpeed = Math.abs(p.speed || 0);
      if (d < BUST_RANGE && playerSpeed < BUST_SPEED) pinned = true;
    }

    if (pinned && world.wanted > 0) {
      police.bustTimer += dt;
      if (police.bustTimer >= BUST_TIME) {
        police.bustTimer = 0;
        world.setState('busted');
      }
    } else {
      police.bustTimer = 0;
    }

    // Drop the patrol once the heat is gone: wrecked cars never return,
    // live cars fade out once they are far from the player.
    if (world.wanted <= 0) {
      for (const car of police.cars) {
        if (car.wrecked) {
          car.respawnAt = null;
          continue;
        }
        if (dist2d(car.x, car.z, p.x, p.z) > 120) {
          car.wrecked = true;
          car.respawnAt = null;
          car.mesh.visible = false;
        }
      }
      police.cars = police.cars.filter((c) => !c.wrecked);
    }
  };

  world.police = police;
  return police;
}
