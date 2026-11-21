// traffic.js — ambient traffic cars that drive the road grid, and the six
// parked cars Marlo can steal. Traffic is gentle: bumps cost a little
// speed, never a dead stop, so the player's drive is never ruined by it.
import { Car, CAR_COLORS, collideCars } from './vehicles.js';
import { ROADS, collideCircle } from './city.js';
import { makeRng, clamp } from './util.js';

export const PARKED_SPOTS = [
  { x: 44, z: 124 },
  { x: 86, z: -46 },
  { x: -36, z: 84 },
  { x: -4, z: -84 },
  { x: 124, z: 4 },
  { x: -84, z: -4 },
];

export class Traffic {
  constructor(scene, colliders) {
    this.scene = scene;
    this.colliders = colliders;
    this.rng = makeRng(777);
    this.cars = []; // moving traffic
    this.parked = []; // the six parked cars
    const palette = [CAR_COLORS.sedan, CAR_COLORS.taxi, CAR_COLORS.truck, 0x9a4a6a, 0x4a7a6a];
    // Parked cars: sit along road edges, facing along the road.
    for (const spot of PARKED_SPOTS) {
      const onVerticalRoad = Math.abs(spot.x % 40) < 8 || ROADS.includes(Math.round(spot.x / 40) * 40);
      const heading = onVerticalRoad ? 0 : Math.PI / 2;
      const car = new Car('sedan', palette[this.parked.length % palette.length], spot.x, spot.z, heading);
      // Parked cars keep full driving stats (a stolen one must drive);
      // they stay put simply because nothing drives them.
      this.scene.add(car.group);
      this.parked.push(car);
    }
    // Moving traffic: 10 cars spread over the grid.
    for (let i = 0; i < 10; i++) {
      const vertical = this.rng.chance(0.5);
      const road = ROADS[this.rng.int(1, 7)];
      const along = this.rng.range(-140, 140);
      const x = vertical ? road : along;
      const z = vertical ? along : road;
      const heading = vertical ? (this.rng.chance(0.5) ? 0 : Math.PI) : (this.rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2);
      const car = new Car('sedan', palette[this.rng.int(0, palette.length - 1)], x, z, heading);
      car.topSpeed = this.rng.range(9, 13);
      car.accel = 8;
      this.scene.add(car.group);
      this.cars.push({ car, road, vertical, dir: heading, stuck: 0 });
    }
  }

  get parkedCount() {
    return this.parked.filter((c) => !c.wrecked).length;
  }

  nearestParked(x, z, maxDist = 5) {
    let best = null;
    let bestD = maxDist;
    for (const c of this.parked) {
      if (c.wrecked) continue;
      const d = Math.hypot(c.x - x, c.z - z);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return best;
  }

  // Move traffic along the grid. At an intersection, sometimes turn.
  update(dt, playerCar, effects) {
    for (const t of this.cars) {
      const car = t.car;
      if (car.wrecked) {
        car.wreckTimer += dt;
        if (car.wreckTimer > 8) {
          // Respawn the traffic car somewhere fresh.
          const vertical = this.rng.chance(0.5);
          const road = ROADS[this.rng.int(1, 7)];
          const along = this.rng.range(-140, 140);
          car.respawn(vertical ? road : along, vertical ? along : road, this.rng.chance(0.5) ? 0 : Math.PI);
          car.topSpeed = this.rng.range(9, 13);
          t.vertical = vertical;
          t.road = road;
        }
        continue;
      }
      car.damageCooldown = Math.max(0, car.damageCooldown - dt);
      // Drive forward on the current road.
      car.drive({ forward: true, back: false, left: false, right: false }, dt);
      // Snap back onto the road line (traffic keeps its lane).
      if (t.vertical) car.x += (t.road - car.x) * Math.min(1, 2 * dt);
      else car.z += (t.road - car.z) * Math.min(1, 2 * dt);
      car.sync();
      // At an intersection, sometimes turn onto the crossing road.
      const nearX = ROADS.some((r) => Math.abs(car.x - r) < 2);
      const nearZ = ROADS.some((r) => Math.abs(car.z - r) < 2);
      if (nearX && nearZ && this.rng.chance(dt * 0.25)) {
        const turnLeft = this.rng.chance(0.5);
        const nh = car.heading + (turnLeft ? Math.PI / 2 : -Math.PI / 2);
        car.heading = ((nh + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
        const vertical = Math.abs(Math.sin(car.heading)) < 0.5;
        t.vertical = vertical;
        t.road = vertical ? Math.round(car.x / 40) * 40 : Math.round(car.z / 40) * 40;
        t.road = clamp(t.road, -160, 160);
      }
      // Keep inside the city; wrap around the far edge.
      if (car.x > 175 || car.x < -175 || car.z > 175 || car.z < -175) {
        car.teleport(
          clamp(-car.x, -150, 150),
          clamp(-car.z, -150, 150),
          car.heading + Math.PI,
        );
      }
      // Gentle collision with the player's car: shove the traffic car
      // aside, cost the player almost nothing.
      if (playerCar && !playerCar.wrecked) {
        if (collideCars(playerCar, car, 3.6)) {
          playerCar.speed *= 0.94;
          if (car.health > 0) {
            car.health -= 1;
            if (car.health <= 0) {
              car.wreck();
              effects.explode(car.x, car.z);
            }
          }
        }
      }
      // Traffic cars nudge each other apart.
      for (const o of this.cars) {
        if (o !== t && !o.car.wrecked) collideCars(car, o.car, 3.6);
      }
      // Buildings stop traffic (they drive on roads, so this is a safety net).
      const fixed = collideCircle(car.x, car.z, 2.2, this.colliders);
      if (fixed) {
        car.x = fixed.x;
        car.z = fixed.z;
        car.speed *= 0.5;
        car.sync();
      }
    }
    // Parked cars: smoke/fire puffs while damaged.
    for (const c of this.parked) {
      c.damageCooldown = Math.max(0, c.damageCooldown - dt);
      if (c.wrecked) continue;
      if (c.burning && this.rng.chance(dt * 8)) effects.smokePuff(c.x, 1.2, c.z);
      else if (c.smoking && this.rng.chance(dt * 4)) effects.smokePuff(c.x, 1.0, c.z);
    }
  }
}
