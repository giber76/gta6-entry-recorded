// traffic.js — road traffic and the six parked cars of Solara Bay.
// Traffic cars loop around city blocks on the road grid; a wrecked traffic
// car respawns after 8 seconds. Parked cars are static until wrecked.
import { Car } from './vehicles.js';
import { dist2, headingTo } from './util.js';
import { ROADS } from './city.js';

const PARKED_SPOTS = [
  { x: 44, z: 124, h: Math.PI / 2, color: 0xc8a03a },
  { x: 86, z: -46, h: 0, color: 0x7a3a3a },
  { x: -84, z: 44, h: Math.PI / 2, color: 0x3a6a8a },
  { x: 124, z: -84, h: 0, color: 0x4a7a4a },
  { x: -124, z: -4, h: Math.PI / 2, color: 0x8a8a8a },
  { x: 4, z: 164, h: Math.PI / 2, color: 0x9a5a8a },
];

const TRAFFIC_COLORS = [0xb8b8b8, 0x5a7a9a, 0x9a5a5a, 0x6a8a5a, 0xd8d0c0];

export class Traffic {
  constructor(scene, rng) {
    this.scene = scene;
    this.rng = rng;
    this.parked = [];
    for (const s of PARKED_SPOTS) {
      this.parked.push(new Car(scene, s.x, s.z, s.h, s.color, 'parked'));
    }
    this.cars = [];
    // Eight traffic cars, each looping a rectangle of roads.
    for (let i = 0; i < 8; i++) {
      const rx = ROADS[1 + Math.floor(rng() * 7)];
      const rz = ROADS[1 + Math.floor(rng() * 7)];
      const w = 40 + Math.floor(rng() * 2) * 40;
      const h = 40 + Math.floor(rng() * 2) * 40;
      const car = new Car(scene, rx, rz, rng() * Math.PI * 2, TRAFFIC_COLORS[i % TRAFFIC_COLORS.length], 'traffic');
      car.speed = 10 + rng() * 4;
      car.loop = [
        { x: rx, z: rz },
        { x: rx + w, z: rz },
        { x: rx + w, z: rz + h },
        { x: rx, z: rz + h },
      ];
      car.loopIndex = 1;
      car.homeX = rx;
      car.homeZ = rz;
      this.cars.push(car);
    }
  }

  parkedCount() {
    let n = 0;
    for (const c of this.parked) if (!c.wrecked) n++;
    return n;
  }

  nearestParked(x, z) {
    let best = null;
    let bestD = Infinity;
    for (const c of this.parked) {
      if (c.wrecked) continue;
      const d = dist2(x, z, c.x, c.z);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return best ? { car: best, dist: bestD } : null;
  }

  nearestCar(x, z, maxDist) {
    let best = null;
    let bestD = maxDist;
    const all = [...this.parked, ...this.cars];
    for (const c of all) {
      if (c.wrecked) continue;
      const d = dist2(x, z, c.x, c.z);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return best ? { car: best, dist: bestD } : null;
  }

  update(dt, game) {
    for (const car of this.cars) {
      if (car.wrecked) {
        if (car.wreckTimer <= 0) {
          car.repair();
          car.x = car.homeX;
          car.z = car.homeZ;
          car.heading = 0;
          car.speed = 10;
          car.loopIndex = 1;
          car.syncMesh();
        }
        continue;
      }
      const target = car.loop[car.loopIndex];
      const d = dist2(car.x, car.z, target.x, target.z);
      if (d < 6) {
        car.loopIndex = (car.loopIndex + 1) % car.loop.length;
        continue;
      }
      const want = headingTo(car.x, car.z, target.x, target.z);
      let diff = want - car.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      car.heading += Math.max(-1.6 * dt, Math.min(1.6 * dt, diff));
      car.speed += (12 - car.speed) * Math.min(1, dt);
      const f = { x: Math.sin(car.heading), z: Math.cos(car.heading) };
      car.x += f.x * car.speed * dt;
      car.z += f.z * car.speed * dt;
      const fixed = game.city.resolveCircle(car.x, car.z, 1.4);
      car.x = fixed.x;
      car.z = fixed.z;
      // Soft bump with the player's car.
      const pc = game.player.car;
      if (pc && !pc.wrecked) {
        const pd = dist2(car.x, car.z, pc.x, pc.z);
        if (pd < 3.4 && pd > 0.01) {
          const push = (3.4 - pd) / 2;
          const nx = (car.x - pc.x) / pd;
          const nz = (car.z - pc.z) / pd;
          car.x += nx * push;
          car.z += nz * push;
          pc.x -= nx * push;
          pc.z -= nz * push;
          if (car.ramCooldown <= 0) {
            car.ramCooldown = 1.5;
            pc.damage(2, game);
            pc.speed *= 0.85;
          }
        }
      }
      car.syncMesh();
      car.update(dt, game);
    }
    for (const c of this.parked) c.update(dt, game);
  }
}
