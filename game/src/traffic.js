// traffic.js — traffic cars driving the road grid + the parked cars.
// Traffic follows rectangular loops around blocks; a wrecked traffic car
// respawns after 8 s (vehicles.js). Parked cars are the mission cars and
// the drive-by targets.
import { createCar, stepCarDrive, collideCarPair } from './vehicles.js';
import { headingVec, randRange } from './util.js';

// The 6 parked cars: M1 coupe, two drive-by targets, getaway car, boss
// coupe, and one filler. Positions are exact — the play-test asserts them.
const PARKED_DEFS = [
  { x: 24, z: 26, heading: 0.6, color: 0xd7263d, kind: 'coupe', name: 'm1-coupe' },
  { x: 44, z: 124, heading: 0, color: 0x2e86ab, kind: 'sedan', name: 'parked-44-124' },
  { x: 86, z: -46, heading: Math.PI / 2, color: 0xe8b10c, kind: 'sedan', name: 'parked-86--46' },
  { x: -46, z: 8, heading: -0.4, color: 0x3d9970, kind: 'sedan', name: 'getaway' },
  { x: 126, z: 48, heading: Math.PI, color: 0x111114, kind: 'boss', name: 'boss-coupe' },
  { x: -80, z: 40, heading: 1.2, color: 0x7d3c98, kind: 'sedan', name: 'parked--80-40' },
];

export function initTraffic(G) {
  G.parked = [];
  for (const def of PARKED_DEFS) {
    const car = createCar(G, { ...def, parked: true });
    G.parked.push(car);
  }
  // Traffic: 8 cars looping rectangular routes around blocks.
  G.traffic = [];
  const loops = [
    { cx: -100, cz: -100, s: 40 },
    { cx: -20, cz: -100, s: 40 },
    { cx: 60, cz: -100, s: 40 },
    { cx: -100, cz: -20, s: 40 },
    { cx: 60, cz: -20, s: 40 },
    { cx: -100, cz: 60, s: 40 },
    { cx: 20, cz: 60, s: 40 },
    { cx: 100, cz: 100, s: 40 },
  ];
  for (let i = 0; i < loops.length; i++) {
    const L = loops[i];
    const car = createCar(G, {
      x: L.cx - L.s / 2,
      z: L.cz - L.s / 2,
      heading: Math.PI / 2,
      kind: 'traffic',
      traffic: true,
    });
    car.loop = L;
    car.loopEdge = 0; // 0: east along south edge, 1: north, 2: west, 3: south
    car.cruise = randRange(G.rng, 8, 12);
    G.traffic.push(car);
  }
}

export function parkedCount(G) {
  let n = 0;
  for (const c of G.parked) {
    if (!c.wrecked && G.player.car !== c) n++;
  }
  return n;
}

export function nearestParkedCar(G, x, z) {
  let best = null;
  let bestD = Infinity;
  for (const c of G.parked) {
    if (c.wrecked || G.player.car === c) continue;
    const dx = c.x - x;
    const dz = c.z - z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return { car: best, dist: bestD };
}

// Drive a traffic car around its block loop. Corners are the loop's edges;
// the car steers toward the next corner and turns there.
export function updateTraffic(G, dt) {
  for (const car of G.traffic) {
    if (car.wrecked) continue;
    const L = car.loop;
    const h = L.s / 2;
    // Corner targets, in order: SE -> SW -> NW -> NE -> SE...
    const corners = [
      { x: L.cx + h, z: L.cz + h },
      { x: L.cx - h, z: L.cz + h },
      { x: L.cx - h, z: L.cz - h },
      { x: L.cx + h, z: L.cz - h },
    ];
    const target = corners[(car.loopEdge + 1) % 4];
    const dx = target.x - car.x;
    const dz = target.z - car.z;
    const wantHeading = Math.atan2(dx, dz);
    let dh = wantHeading - car.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    const steer = Math.max(-1, Math.min(1, dh * 1.6));
    // Ease off near a corner so the turn is clean.
    const dist = Math.sqrt(dx * dx + dz * dz);
    const throttle = dist < 6 ? 0.4 : 1;
    // Cruise control: hold the target speed.
    const want = car.cruise * throttle;
    if (car.speed < want) stepCarDrive(G, car, 0.5, steer, dt);
    else stepCarDrive(G, car, 0, steer, dt);
    if (dist < 4) car.loopEdge = (car.loopEdge + 1) % 4;
    // Keep traffic out of the player's way: slow if the player is ahead.
    const p = G.player;
    const pdx = p.x - car.x;
    const pdz = p.z - car.z;
    const pd = Math.sqrt(pdx * pdx + pdz * pdz);
    if (pd < 7) car.speed *= 0.94;
  }
  // Car-car collisions (traffic vs player car + police).
  const all = G.cars;
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      collideCarPair(G, all[i], all[j]);
    }
  }
}
