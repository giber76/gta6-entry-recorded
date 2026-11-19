// traffic.js — AI cars cruising the road grid: they turn at intersections,
// yield to the player's car ahead of them, and keep the city feeling alive.

import { ROADS } from './city.js';
import { makeRng } from './util.js';
import { createCar } from './vehicles.js';

const TRAFFIC_COUNT = 10;
const COLORS = [0xc0392b, 0x2e86c1, 0x27ae60, 0xf1c40f, 0x8e44ad, 0x95a5a6, 0xe67e22, 0xd5dbdb];

export function spawnTraffic(G) {
  const rng = makeRng(777);
  G.trafficCars = [];
  for (let i = 0; i < TRAFFIC_COUNT; i++) {
    const axis = rng.chance(0.5) ? 'x' : 'z';
    const road = rng.pick(ROADS);
    const along = rng.range(-150, 150);
    const lane = rng.chance(0.5) ? 2.6 : -2.6;
    const dir = rng.chance(0.5) ? 1 : -1;
    const x = axis === 'x' ? along : road + lane;
    const z = axis === 'x' ? road + lane : along;
    const heading = axis === 'x' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
    const car = createCar(G, {
      x,
      z,
      heading,
      color: COLORS[i % COLORS.length],
    });
    car.traffic = { axis, dir, lane, speed: rng.range(8, 12), cruise: rng.range(8, 12) };
    G.trafficCars.push(car);
  }
  return G.trafficCars;
}

function nearestIntersection(value) {
  let best = ROADS[0];
  let bestD = Infinity;
  for (const r of ROADS) {
    const d = Math.abs(value - r);
    if (d < bestD) {
      bestD = d;
      best = r;
    }
  }
  return { road: best, dist: bestD };
}

export function updateTraffic(G, dt) {
  const p = G.player;
  for (const car of G.trafficCars) {
    const t = car.traffic;
    // Yield: if the player's car is close ahead in the same lane, brake.
    let targetSpeed = t.cruise;
    if (p.inCar && p.car) {
      const dx = p.car.pos.x - car.pos.x;
      const dz = p.car.pos.z - car.pos.z;
      const ahead = dx * Math.sin(car.heading) + dz * Math.cos(car.heading);
      const side = Math.abs(dx * Math.cos(car.heading) - dz * Math.sin(car.heading));
      if (ahead > 0 && ahead < 15 && side < 3.5) targetSpeed = 0;
    }
    t.speed += (targetSpeed - t.speed) * Math.min(1, dt * 2.5);

    car.pos.x += Math.sin(car.heading) * t.speed * dt;
    car.pos.z += Math.cos(car.heading) * t.speed * dt;

    // At an intersection, sometimes turn onto the crossing road.
    const along = t.axis === 'x' ? car.pos.x : car.pos.z;
    const near = nearestIntersection(along);
    if (near.dist < 1.2 && Math.abs(t.speed) > 0.5) {
      if (Math.random() < 0.35) {
        const newAxis = t.axis === 'x' ? 'z' : 'x';
        const newDir = Math.random() < 0.5 ? 1 : -1;
        const newLane = Math.random() < 0.5 ? 2.6 : -2.6;
        if (newAxis === 'x') {
          car.pos.z = near.road + newLane;
          car.heading = newDir > 0 ? Math.PI / 2 : -Math.PI / 2;
        } else {
          car.pos.x = near.road + newLane;
          car.heading = newDir > 0 ? 0 : Math.PI;
        }
        t.axis = newAxis;
        t.dir = newDir;
        t.lane = newLane;
      }
    }

    // Wrap around the city edge so traffic never runs out.
    if (car.pos.x > 165 || car.pos.x < -165 || car.pos.z > 165 || car.pos.z < -165) {
      const axis = Math.random() < 0.5 ? 'x' : 'z';
      const road = ROADS[Math.floor(Math.random() * ROADS.length)];
      const lane = Math.random() < 0.5 ? 2.6 : -2.6;
      const dir = Math.random() < 0.5 ? 1 : -1;
      const edge = dir > 0 ? -158 : 158;
      if (axis === 'x') {
        car.pos.x = edge;
        car.pos.z = road + lane;
        car.heading = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        car.pos.z = edge;
        car.pos.x = road + lane;
        car.heading = dir > 0 ? 0 : Math.PI;
      }
      t.axis = axis;
      t.dir = dir;
      t.lane = lane;
    }

    car.group.rotation.y = car.heading;
    const spin = t.speed * dt * 2.6;
    for (const w of car.wheels) w.rotation.x += spin;
  }
}
