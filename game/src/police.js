// police.js — police cruisers: patrol when the heat is off, chase and ram
// when wanted > 0, and bust Marlo if they pin him down. A wrecked cruiser
// stays out of action 8 s, then returns.
import { createCar, stepCarDrive, damageCarObj } from './vehicles.js';
import { headingVec } from './util.js';

export const POLICE_TOP_SPEED = 38;

export function initPolice(G) {
  G.police = [];
  const spots = [
    { x: -60, z: -60, heading: 0 },
    { x: 60, z: 60, heading: Math.PI },
    { x: 0, z: 120, heading: Math.PI / 2 },
  ];
  for (const s of spots) {
    const car = createCar(G, {
      x: s.x,
      z: s.z,
      heading: s.heading,
      color: 0x111114,
      kind: 'police',
    });
    car.patrolTarget = { x: -s.x, z: -s.z };
    car.caughtTimer = 0;
    G.police.push(car);
  }
}

function flashLights(car, t) {
  const on = Math.floor(t * 6) % 2 === 0;
  const red = car.mesh.getObjectByName('lightRed');
  const blue = car.mesh.getObjectByName('lightBlue');
  if (red) red.material.emissiveIntensity = on ? 2.2 : 0.15;
  if (blue) blue.material.emissiveIntensity = on ? 0.15 : 2.2;
}

export function updatePolice(G, dt) {
  const p = G.player;
  const wanted = G.wanted;
  for (const car of G.police) {
    if (car.wrecked) continue;
    flashLights(car, G.elapsed);
    if (car.ramCooldown > 0) car.ramCooldown -= dt;
    if (wanted > 0) {
      // Chase: aim at a point just ahead of the player (intercept), so the
      // cruiser cuts in from the front or side instead of only tailing.
      const pdx = p.x - car.x;
      const pdz = p.z - car.z;
      const dist = Math.sqrt(pdx * pdx + pdz * pdz);
      const px = p.x + p.vx * 0.9;
      const pz = p.z + p.vz * 0.9;
      const tx = px - car.x;
      const tz = pz - car.z;
      const wantHeading = Math.atan2(tx, tz);
      let dh = wantHeading - car.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      const steer = Math.max(-1, Math.min(1, dh * 1.8));
      if (car.speed < POLICE_TOP_SPEED) stepCarDrive(G, car, 0.9, steer, dt);
      else stepCarDrive(G, car, 0, steer, dt);
      // Ram: close and moving into the player's car -> damage it.
      if (dist < 4.2 && car.ramCooldown <= 0) {
        const closing = (car.speed - p.speed) > 2;
        if (p.inCar && p.car) {
          damageCarObj(G, p.car, 5);
          car.ramCooldown = 1.1;
        } else if (closing) {
          // A cruiser brushing Marlo on foot shoves him, never one-shots.
          p.health = Math.max(1, p.health - 2);
          car.ramCooldown = 1.1;
        }
      }
      // Caught: a cruiser within 3 m while Marlo is slow, for 3 s -> busted.
      const playerSpeed = Math.abs(p.speed || 0);
      if (dist < 3.0 && playerSpeed < 5) {
        car.caughtTimer += dt;
        if (car.caughtTimer >= 3) {
          G.state = 'busted';
          return;
        }
      } else {
        car.caughtTimer = 0;
      }
    } else {
      // Patrol: cruise toward the patrol target, pick a new one on arrival.
      const tx = car.patrolTarget.x - car.x;
      const tz = car.patrolTarget.z - car.z;
      const dist = Math.sqrt(tx * tx + tz * tz);
      const wantHeading = Math.atan2(tx, tz);
      let dh = wantHeading - car.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      const steer = Math.max(-1, Math.min(1, dh * 1.5));
      if (car.speed < 11) stepCarDrive(G, car, 0.5, steer, dt);
      else stepCarDrive(G, car, 0, steer, dt);
      if (dist < 8) {
        car.patrolTarget = {
          x: (G.rng() * 2 - 1) * 140,
          z: (G.rng() * 2 - 1) * 140,
        };
      }
      car.caughtTimer = 0;
    }
  }
}
