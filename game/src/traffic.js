// traffic.js — AI cars cruising the road grid. They turn at intersections,
// brake for the player's car ahead of them, and wrap around the city edge
// so the streets never empty out. Spawns are seeded; turns and wrap-arounds
// roll plain Math.random so they never disturb the seeded layout streams.
// A wrecked traffic car is towed and respawns after 8 s, so the streets
// stay busy even after a pile-up.

import { ROADS } from './city.js';
import { makeRng } from './util.js';
import { createCar, damageCar } from './vehicles.js';
import { carExhaust, emitBurningSmoke } from './effects.js';

const CARS_ON_ROAD = 10;
const PAINT_JOBS = [0xc0392b, 0x2e86c1, 0x27ae60, 0xf1c40f, 0x8e44ad, 0x95a5a6, 0xe67e22, 0xd5dbdb];
const WRECK_RESPAWN_SECONDS = 8;

// A heading for a direction on an axis: x runs east/west, z north/south.
function headingFor(axis, dir) {
  if (axis === 'x') return dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  return dir > 0 ? 0 : Math.PI;
}

// Pick a starting spot on the grid: a road, a lane offset, a direction.
function dealStart(rng) {
  const along = rng.chance(0.5) ? 'x' : 'z';
  const street = rng.pick(ROADS);
  const run = rng.range(-150, 150);
  const offset = rng.chance(0.5) ? 2.6 : -2.6;
  const sense = rng.chance(0.5) ? 1 : -1;
  const x = along === 'x' ? run : street + offset;
  const z = along === 'x' ? street + offset : run;
  return { along, street, offset, sense, x, z, bearing: headingFor(along, sense) };
}

export function spawnTraffic(game) {
  const rng = makeRng(777);
  game.trafficCars = [];
  for (let i = 0; i < CARS_ON_ROAD; i++) {
    const spot = dealStart(rng);
    const car = createCar(game, {
      x: spot.x,
      z: spot.z,
      heading: spot.bearing,
      color: PAINT_JOBS[i % PAINT_JOBS.length],
    });
    car.traffic = {
      axis: spot.along,
      dir: spot.sense,
      lane: spot.offset,
      speed: rng.range(8, 12),
      cruise: rng.range(8, 12),
    };
    game.trafficCars.push(car);
  }
  return game.trafficCars;
}

// A wrecked car is towed away and a fresh one joins the grid after 8 s.
function respawnRide(game, car) {
  const spot = dealStart(makeRng((Math.random() * 1e9) | 0));
  car.pos.x = spot.x;
  car.pos.z = spot.z;
  car.heading = spot.bearing;
  car.group.rotation.y = spot.bearing;
  car.health = 100;
  car.wrecked = false;
  car.wreckTimer = 0;
  car.speed = 0;
  car.traffic = {
    axis: spot.along,
    dir: spot.sense,
    lane: spot.offset,
    speed: 8 + Math.random() * 4,
    cruise: 8 + Math.random() * 4,
  };
}

function closestCrossing(where) {
  let near = ROADS[0];
  let nearD = Infinity;
  for (const r of ROADS) {
    const d = Math.abs(where - r);
    if (d < nearD) {
      nearD = d;
      near = r;
    }
  }
  return { road: near, dist: nearD };
}

// How fast this car wants to go: full cruise, unless the player's car is
// sitting right ahead of it in the same lane.
function wantedSpeed(game, car) {
  const ai = car.traffic;
  const p = game.player;
  if (!p.inCar || !p.car) return ai.cruise;
  const dx = p.car.pos.x - car.pos.x;
  const dz = p.car.pos.z - car.pos.z;
  const forward = dx * Math.sin(car.heading) + dz * Math.cos(car.heading);
  const lateral = Math.abs(dx * Math.cos(car.heading) - dz * Math.sin(car.heading));
  if (forward > 0 && forward < 15 && lateral < 3.5) return 0;
  return ai.cruise;
}

// At an intersection, sometimes turn onto the crossing road.
function maybeTurn(car) {
  const ai = car.traffic;
  const run = ai.axis === 'x' ? car.pos.x : car.pos.z;
  const cross = closestCrossing(run);
  if (cross.dist >= 1.2 || Math.abs(ai.speed) <= 0.5) return;
  if (Math.random() >= 0.35) return;
  const newAxis = ai.axis === 'x' ? 'z' : 'x';
  const newDir = Math.random() < 0.5 ? 1 : -1;
  const newLane = Math.random() < 0.5 ? 2.6 : -2.6;
  if (newAxis === 'x') {
    car.pos.z = cross.road + newLane;
  } else {
    car.pos.x = cross.road + newLane;
  }
  car.heading = headingFor(newAxis, newDir);
  ai.axis = newAxis;
  ai.dir = newDir;
  ai.lane = newLane;
}

// Off the edge of the city: drop the car back in on a random road.
function wrapAround(car) {
  const ai = car.traffic;
  if (car.pos.x <= 165 && car.pos.x >= -165 && car.pos.z <= 165 && car.pos.z >= -165) return;
  const axis = Math.random() < 0.5 ? 'x' : 'z';
  const road = ROADS[Math.floor(Math.random() * ROADS.length)];
  const lane = Math.random() < 0.5 ? 2.6 : -2.6;
  const dir = Math.random() < 0.5 ? 1 : -1;
  const edge = dir > 0 ? -158 : 158;
  if (axis === 'x') {
    car.pos.x = edge;
    car.pos.z = road + lane;
  } else {
    car.pos.z = edge;
    car.pos.x = road + lane;
  }
  car.heading = headingFor(axis, dir);
  ai.axis = axis;
  ai.dir = dir;
  ai.lane = lane;
}

// A hurt traffic car smokes, and a burning one vents a plume and keeps
// losing health until it wrecks.
function smokeAndBurn(game, car, dt) {
  if (car.health >= 50 || car.health <= 0) return;
  carExhaust(game, car, dt);
  if (car.health < 25) {
    emitBurningSmoke(game, car.pos.x, car.pos.z, dt);
    damageCar(game, car, 2 * dt);
  }
}

export function updateTraffic(game, dt) {
  for (const car of game.trafficCars) {
    // Wrecked: count down to the tow truck, then rejoin the grid fresh.
    if (car.wrecked) {
      car.wreckTimer -= dt;
      if (car.wreckTimer <= 0) respawnRide(game, car);
      continue;
    }
    const ai = car.traffic;
    const goal = wantedSpeed(game, car);
    ai.speed += (goal - ai.speed) * Math.min(1, dt * 2.5);
    car.pos.x += Math.sin(car.heading) * ai.speed * dt;
    car.pos.z += Math.cos(car.heading) * ai.speed * dt;
    maybeTurn(car);
    wrapAround(car);
    car.group.rotation.y = car.heading;
    const spin = ai.speed * dt * 2.6;
    for (const w of car.wheels) w.rotation.x += spin;
    smokeAndBurn(game, car, dt);
  }
}
