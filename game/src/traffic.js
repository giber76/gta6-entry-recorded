// traffic.js — road traffic + parked cars for Solara Bay.
// Traffic cars loop the road grid at a calm speed and yield when the
// player is right in front of them, so they never block a mission drive.
// Parked cars sit at fixed spots; wrecking one drops the parked count.

import { Car } from './vehicles.js';
import { PARKED_SPOTS } from './city.js';
import { dist2d, headingTo, angleDelta, clamp, mulberry32 } from './util.js';

const TRAFFIC_SPEED = 10; // m/s
const YIELD_DIST = 13;

// A rectangular loop around the road grid, driven clockwise.
function makeLoop(rng, half) {
  const pts = [
    { x: -half, z: -half },
    { x: half, z: -half },
    { x: half, z: half },
    { x: -half, z: half },
  ];
  // Random rotation so cars do not all bunch at one corner.
  const rot = Math.floor(rng() * 4);
  return pts.slice(rot).concat(pts.slice(0, rot));
}

export function createTraffic(world) {
  const traffic = {
    cars: [],
    parked: [],
  };
  const rng = mulberry32(777001);

  // Parked cars at the fixed spots (6 of them).
  for (const spot of PARKED_SPOTS) {
    const car = new Car(world, {
      x: spot.x,
      z: spot.z,
      heading: rng() * Math.PI * 2,
      kind: 'parked',
      label: 'parked',
      color: 0x8a8f96,
    });
    traffic.parked.push(car);
    traffic.cars.push(car);
    world.cars.push(car);
  }

  // Traffic cars on rectangular loops. They stay on the +/-30 and +/-90
  // roads so the central avenues and the 160 ring stay clear for missions.
  const loops = [makeLoop(rng, 30), makeLoop(rng, 90), makeLoop(rng, 30), makeLoop(rng, 90)];
  for (let i = 0; i < 4; i++) {
    const loop = loops[i];
    const start = loop[i % loop.length];
    const car = new Car(world, {
      x: start.x,
      z: start.z,
      heading: 0,
      kind: 'traffic',
      label: 'traffic',
      route: loop,
      respawnDelay: 8,
    });
    car.routeIndex = (i + 1) % loop.length;
    car.driver = 'traffic';
    traffic.cars.push(car);
    world.cars.push(car);
  }

  traffic.parkedAlive = function () {
    let n = 0;
    for (const c of traffic.parked) if (!c.wrecked) n++;
    return n;
  };

  traffic.update = function (dt) {
    for (const car of traffic.cars) {
      if (car.kind === 'parked') continue;
      if (car.wrecked) continue;
      // Yield: stop when the player is right ahead of this car.
      const p = world.player;
      const dx = p.x - car.x;
      const dz = p.z - car.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      const ahead = dx * Math.sin(car.heading) + dz * Math.cos(car.heading);
      if (d < YIELD_DIST && ahead > 0) {
        car.speed = Math.max(0, car.speed - 20 * dt);
      } else {
        car.speed = Math.min(TRAFFIC_SPEED, car.speed + 6 * dt);
      }
      // Steer toward the next loop waypoint.
      const target = car.route[car.routeIndex];
      if (dist2d(car.x, car.z, target.x, target.z) < 4) {
        car.routeIndex = (car.routeIndex + 1) % car.route.length;
      } else {
        const want = headingTo(car.x, car.z, target.x, target.z);
        const turn = angleDelta(car.heading, want);
        car.heading += clamp(turn, -1.4 * dt, 1.4 * dt);
      }
      const f = { x: Math.sin(car.heading), z: Math.cos(car.heading) };
      const nx = car.x + f.x * car.speed * dt;
      const nz = car.z + f.z * car.speed * dt;
      car.moveTo(dt, nx, nz, car.heading);
      // Bump the player's car on contact (small damage, short cooldown).
      if (p.inCar && p.car && !p.car.wrecked) {
        const dd = dist2d(car.x, car.z, p.car.x, p.car.z);
        if (dd < 3.4 && car.hitCooldown <= 0) {
          car.hitCooldown = 1;
          p.car.damage(5, 'traffic');
          world.audio.crash();
        }
      }
    }
  };

  world.traffic = traffic;
  return traffic;
}
