// traffic.js — AI cars cruising the road grid. They turn at intersections,
// brake for the player's car ahead of them, and wrap around the city edge
// so the streets never empty out. A wrecked traffic car is dealt back onto
// the grid a few seconds later. Spawns are seeded; turns and wrap-arounds
// roll plain Math.random.

import { ROADS } from './city.js';
import { makeRng } from './util.js';
import { createCar } from './vehicles.js';

const CARS_ON_ROAD = 10;
const PAINT_JOBS = [0xc0392b, 0x2e86c1, 0x27ae60, 0xf1c40f, 0x8e44ad, 0x95a5a6, 0xe67e22, 0xd5dbdb];

// Pick a starting spot on the grid: a road, a lane offset, a direction.
function dealStart(dice) {
  const along = dice.chance(0.5) ? 'x' : 'z';
  const street = dice.pick(ROADS);
  const run = dice.range(-150, 150);
  const offset = dice.chance(0.5) ? 2.6 : -2.6;
  const sense = dice.chance(0.5) ? 1 : -1;
  const x = along === 'x' ? run : street + offset;
  const z = along === 'x' ? street + offset : run;
  const bearing = along === 'x' ? (sense > 0 ? Math.PI / 2 : -Math.PI / 2) : (sense > 0 ? 0 : Math.PI);
  return { along, street, offset, sense, x, z, bearing };
}

// Build one traffic car from a dealt spot and a speed draw.
function buildTrafficCar(G, spot, dice) {
  const ride = createCar(G, {
    x: spot.x,
    z: spot.z,
    heading: spot.bearing,
    color: PAINT_JOBS[G.trafficCars.length % PAINT_JOBS.length],
  });
  ride.traffic = {
    axis: spot.along,
    dir: spot.sense,
    lane: spot.offset,
    speed: dice.range(8, 12),
    cruise: dice.range(8, 12),
  };
  return ride;
}

export function spawnTraffic(G) {
  const dice = makeRng(777);
  G.trafficCars = [];
  G.trafficRespawn = [];
  G.trafficRng = makeRng(2002);
  // A wrecked traffic car leaves the street at once; a fresh one is dealt
  // onto the grid a few seconds later, so the city never empties out.
  G.onTrafficCarWrecked = () => {
    G.trafficRespawn.push(8);
  };
  for (let i = 0; i < CARS_ON_ROAD; i++) {
    const spot = dealStart(dice);
    const ride = buildTrafficCar(G, spot, dice);
    G.trafficCars.push(ride);
  }
  return G.trafficCars;
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
function wantedSpeed(G, ride) {
  const brain = ride.traffic;
  const p = G.player;
  if (!p.inCar || !p.car) return brain.cruise;
  const dx = p.car.pos.x - ride.pos.x;
  const dz = p.car.pos.z - ride.pos.z;
  const forward = dx * Math.sin(ride.heading) + dz * Math.cos(ride.heading);
  const lateral = Math.abs(dx * Math.cos(ride.heading) - dz * Math.sin(ride.heading));
  if (forward > 0 && forward < 15 && lateral < 3.5) return 0;
  return brain.cruise;
}

// At an intersection, sometimes turn onto the crossing road.
function maybeTurn(ride) {
  const brain = ride.traffic;
  const run = brain.axis === 'x' ? ride.pos.x : ride.pos.z;
  const cross = closestCrossing(run);
  if (cross.dist >= 1.2 || Math.abs(brain.speed) <= 0.5) return;
  if (Math.random() >= 0.35) return;
  const newAxis = brain.axis === 'x' ? 'z' : 'x';
  const newDir = Math.random() < 0.5 ? 1 : -1;
  const newLane = Math.random() < 0.5 ? 2.6 : -2.6;
  if (newAxis === 'x') {
    ride.pos.z = cross.road + newLane;
    ride.heading = newDir > 0 ? Math.PI / 2 : -Math.PI / 2;
  } else {
    ride.pos.x = cross.road + newLane;
    ride.heading = newDir > 0 ? 0 : Math.PI;
  }
  brain.axis = newAxis;
  brain.dir = newDir;
  brain.lane = newLane;
}

// Off the edge of the city: drop the car back in on a random road.
function wrapAround(ride) {
  const brain = ride.traffic;
  if (ride.pos.x <= 165 && ride.pos.x >= -165 && ride.pos.z <= 165 && ride.pos.z >= -165) return;
  const axis = Math.random() < 0.5 ? 'x' : 'z';
  const road = ROADS[Math.floor(Math.random() * ROADS.length)];
  const lane = Math.random() < 0.5 ? 2.6 : -2.6;
  const dir = Math.random() < 0.5 ? 1 : -1;
  const edge = dir > 0 ? -158 : 158;
  if (axis === 'x') {
    ride.pos.x = edge;
    ride.pos.z = road + lane;
    ride.heading = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  } else {
    ride.pos.z = edge;
    ride.pos.x = road + lane;
    ride.heading = dir > 0 ? 0 : Math.PI;
  }
  brain.axis = axis;
  brain.dir = dir;
  brain.lane = lane;
}

// Deal a replacement car onto the grid for each expired respawn timer.
function processRespawns(G, dt) {
  for (let i = G.trafficRespawn.length - 1; i >= 0; i--) {
    G.trafficRespawn[i] -= dt;
    if (G.trafficRespawn[i] > 0) continue;
    G.trafficRespawn.splice(i, 1);
    const spot = dealStart(G.trafficRng);
    const ride = buildTrafficCar(G, spot, G.trafficRng);
    G.trafficCars.push(ride);
  }
}

export function updateTraffic(G, dt) {
  for (const ride of G.trafficCars) {
    const brain = ride.traffic;
    const goal = wantedSpeed(G, ride);
    brain.speed += (goal - brain.speed) * Math.min(1, dt * 2.5);
    ride.pos.x += Math.sin(ride.heading) * brain.speed * dt;
    ride.pos.z += Math.cos(ride.heading) * brain.speed * dt;
    maybeTurn(ride);
    wrapAround(ride);
    ride.group.rotation.y = ride.heading;
    const spin = brain.speed * dt * 2.6;
    for (const w of ride.wheels) w.rotation.x += spin;
  }
  // Respawn timers tick down in seconds.
  if (G.trafficRespawn.length > 0) processRespawns(G, dt);
}
