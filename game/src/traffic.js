// traffic.js — road traffic + parked cars for Solara Bay.
// Traffic cars cruise the road grid and turn at intersections; parked cars
// sit at the kerb. Wrecked traffic respawns after 8 s.
import { Car } from './vehicles.js';
import { mulberry32, range, pick, clamp } from './util.js';
import { ROADS } from './city.js';

const TRAFFIC_COLORS = [0xd94a4a, 0x4a90c9, 0xe8e8e8, 0x2a2d34, 0xe9c46a, 0x7a9a5a, 0x9b5de5, 0xc9c9c9];

// Fixed parked-car spots. The first two are exact (the play-test uses them).
export const PARKED_SPOTS = [
  { x: 44, z: 124, heading: Math.PI / 2 },
  { x: 86, z: -46, heading: 0 },
  { x: -6, z: 84, heading: Math.PI },
  { x: 126, z: -6, heading: -Math.PI / 2 },
  { x: -126, z: 6, heading: Math.PI / 2 },
  { x: 6, z: -126, heading: 0 },
];

export class Traffic {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.rng = mulberry32(4242);
    this.cars = [];
    this.parked = [];
    for (const s of PARKED_SPOTS) {
      const c = new Car(scene, { kind: 'parked', color: pick(this.rng, TRAFFIC_COLORS), x: s.x, z: s.z, heading: s.heading });
      this.parked.push(c);
      this.cars.push(c);
    }
    for (let i = 0; i < 8; i++) this._spawnTraffic();
  }

  _spawnTraffic() {
    const rng = this.rng;
    const vertical = rng() < 0.5;
    const road = pick(rng, ROADS);
    const along = range(rng, -150, 150);
    const dir = rng() < 0.5 ? 1 : -1;
    const lane = dir > 0 ? 3 : -3;
    const x = vertical ? road + lane : along;
    const z = vertical ? along : road + lane;
    const heading = vertical ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    const c = new Car(this.scene, { kind: 'traffic', color: pick(rng, TRAFFIC_COLORS), x, z, heading });
    c.speed = range(rng, 10, 14);
    c.vertical = vertical;
    c.road = road;
    c.dir = dir;
    c.lane = lane;
    this.cars.push(c);
  }

  get parkedCount() {
    return this.parked.filter((c) => !c.wrecked).length;
  }

  // Drive traffic along roads; turn at intersections; avoid the player a
  // little so a test drive is not ruined by a random rear-end.
  update(dt, playerCar) {
    for (const c of this.cars) {
      if (c.kind !== 'traffic') continue;
      if (c.wrecked) {
        c.wreckTimer += dt;
        if (c.wreckTimer > 8) {
          c.repair();
          const rng = this.rng;
          const vertical = rng() < 0.5;
          const road = pick(rng, ROADS);
          const along = range(rng, -150, 150);
          const dir = rng() < 0.5 ? 1 : -1;
          c.vertical = vertical;
          c.road = road;
          c.dir = dir;
          c.lane = dir > 0 ? 3 : -3;
          c.x = vertical ? road + c.lane : along;
          c.z = vertical ? along : road + c.lane;
          c.heading = vertical ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2);
          c.speed = range(rng, 10, 14);
        }
        continue;
      }
      // slow for the car ahead (including the player) on the same road
      let target = 13;
      if (playerCar) {
        const dx = playerCar.x - c.x;
        const dz = playerCar.z - c.z;
        const ahead = c.vertical ? Math.abs(dx) < 4 && Math.sign(dz) === c.dir : Math.abs(dz) < 4 && Math.sign(dx) === c.dir;
        const dist = Math.hypot(dx, dz);
        if (ahead && dist < 14) target = 4;
      }
      c.speed += clamp(target - c.speed, -8 * dt, 8 * dt);
      // turn at intersections (every 40 m)
      const along = c.vertical ? c.z : c.x;
      const near = Math.round(along / 40) * 40;
      if (Math.abs(along - near) < 1.2 && this.rng() < 0.35) {
        const turn = pick(this.rng, [-1, 0, 1]);
        if (turn !== 0) {
          const newVertical = !c.vertical;
          const newRoad = near;
          const newDir = turn * c.dir;
          c.vertical = newVertical;
          c.road = newRoad;
          c.dir = newDir;
          c.lane = newDir > 0 ? 3 : -3;
          c.heading = newVertical ? (newDir > 0 ? 0 : Math.PI) : (newDir > 0 ? Math.PI / 2 : -Math.PI / 2);
          if (newVertical) c.x = newRoad + c.lane;
          else c.z = newRoad + c.lane;
        }
      }
      // stay in lane (nudge back to the road centre line)
      if (c.vertical) c.x += clamp((c.road + c.lane) - c.x, -1, 1) * dt * 2;
      else c.z += clamp((c.road + c.lane) - c.z, -1, 1) * dt * 2;
      c.move(dt);
      // wrap around the city edge
      if (c.x > 166 || c.x < -166 || c.z > 166 || c.z < -166) {
        c.x = clamp(c.x, -160, 160);
        c.z = clamp(c.z, -160, 160);
        c.heading += Math.PI;
        c.dir *= -1;
        c.lane = c.dir > 0 ? 3 : -3;
      }
      c.sync(dt, 0);
    }
    for (const c of this.parked) c.sync(dt, 0);
  }
}
