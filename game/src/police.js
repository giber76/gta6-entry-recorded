// police.js — the wanted system for Solara Bay.
//
// Stars run 0–5. Police cars chase and ram; foot officers chase and punch,
// and a ram that wrecks your car throws you clear. Heat dies down when
// Marlo stays out of sight — but only while he is on foot. Stars fall one
// per 10 s, and only while no pursuer can see him. A ram damages the
// player's car as well as Marlo, and the ramming police car takes a dent
// too. A wrecked police car holds its roster slot for 8 s before it is
// towed away, so the heat genuinely drops when Marlo wrecks his pursuers.
//
// Why "Lose the Heat" is winnable at all: a fleeing car is faster than any
// police car (38 vs 30 at best), a ram costs health but never touches the
// player's speed, and new pursuers spawn beyond sight range. Drive away
// clean and the stars fall; keep driving into them, or stay on foot, and
// the heat never lets go.

import { nearestRoadPoint, collideCircle } from './city.js';
import { createCar, damageCar } from './vehicles.js';
import { damagePlayer } from './player.js';
import { clamp } from './util.js';

// Pursuit tuning. [name, value] rows so the whole table reads at a glance.
const TUNE_ROWS = [
  ['decaySeconds', 10],
  ['sightRange', 70],
  ['giveUpRange', 120],
  ['spawnDistance', 95],
  ['spawnMinDistance', 80],
  ['ramDamage', 4],
  ['ramCarDamage', 8],
  ['ramSelfDamage', 4],
  ['ramCooldown', 3.0],
  ['ramRange', 3.4],
  ['officerPunchDamage', 6],
  ['officerPunchCooldown', 0.8],
  ['officerSpeed', 7],
  ['officerSpawnDistance', 18],
  ['maxCars', 3],
  ['maxOfficers', 2],
  ['turnRate', 2.4],
];
const T = Object.fromEntries(TUNE_ROWS);

export function initPolice(game) {
  game.wanted = 0;
  game.wantedTimer = 0;
  game.policeCars = [];
  game.officers = [];
}

export function setWanted(game, level) {
  game.wanted = clamp(level, 0, 5);
  game.wantedTimer = 0;
  if (game.hud) game.hud.setStars(game.wanted);
}

export function raiseWanted(game, amount, reason) {
  if (game.wanted >= 5) return;
  setWanted(game, game.wanted + amount);
  if (game.audio) game.audio.wantedUp();
  if (game.hud) game.hud.toast(`Wanted level ${game.wanted} — ${reason}`);
}

// Pick a spawn point on a road, 95 u out from Marlo in a random
// direction, and push it back out if the road snap pulled it too close —
// a pursuer must never spawn already watching.
function pickSpawnPoint(game) {
  const p = game.player;
  const angle = Math.random() * Math.PI * 2;
  let x = p.pos.x + Math.cos(angle) * T.spawnDistance;
  let z = p.pos.z + Math.sin(angle) * T.spawnDistance;
  const road = nearestRoadPoint(x, z);
  x = road.x;
  z = road.z;
  const gap = Math.hypot(x - p.pos.x, z - p.pos.z);
  if (gap < T.spawnMinDistance) {
    const ux = (x - p.pos.x) / (gap || 1);
    const uz = (z - p.pos.z) / (gap || 1);
    x = p.pos.x + ux * T.spawnMinDistance;
    z = p.pos.z + uz * T.spawnMinDistance;
  }
  return { x, z };
}

function spawnPoliceCar(game) {
  const p = game.player;
  const spot = pickSpawnPoint(game);
  const car = createCar(game, {
    x: spot.x,
    z: spot.z,
    heading: Math.atan2(p.pos.x - spot.x, p.pos.z - spot.z),
    color: 0x1c2733,
    police: true,
  });
  car.policeAI = { ramCooldown: 0 };
  game.policeCars.push(car);
  return car;
}

function spawnOfficer(game) {
  const THREE = window.THREE;
  const p = game.player;
  const angle = Math.random() * Math.PI * 2;
  const x = p.pos.x + Math.cos(angle) * T.officerSpawnDistance;
  const z = p.pos.z + Math.sin(angle) * T.officerSpawnDistance;
  const group = new THREE.Group();
  const navy = new THREE.MeshLambertMaterial({ color: 0x1c2733 });
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98d64 });
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.48, 1.05, 10), navy);
  torso.position.y = 1.05;
  torso.castShadow = true;
  group.add(torso);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), skin);
  skull.position.y = 1.85;
  group.add(skull);
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.32, 0.1, 12),
    new THREE.MeshLambertMaterial({ color: 0x0d1420 })
  );
  cap.position.y = 2.05;
  group.add(cap);
  group.position.set(x, 0, z);
  game.scene.add(group);
  const officer = { group, pos: group.position, punchCooldown: 0, speed: T.officerSpeed };
  game.officers.push(officer);
  return officer;
}

function removePoliceCar(game, car) {
  game.scene.remove(car.group);
  game.policeCars = game.policeCars.filter((c) => c !== car);
}

function removeOfficer(game, officer) {
  game.scene.remove(officer.group);
  game.officers = game.officers.filter((o) => o !== officer);
}

// Can any pursuer see Marlo right now? A sighting restarts the decay clock.
function spotted(game) {
  const p = game.player;
  for (const car of game.policeCars) {
    if (Math.hypot(car.pos.x - p.pos.x, car.pos.z - p.pos.z) < T.sightRange) return true;
  }
  for (const o of game.officers) {
    if (Math.hypot(o.pos.x - p.pos.x, o.pos.z - p.pos.z) < T.sightRange) return true;
  }
  return false;
}

// Keep one roster at the wanted level: up to 3 cars, up to 2 officers.
// Extra units leave when the heat drops. A wrecked car holds its slot
// until it is towed, so wrecking a pursuer genuinely thins the chase.
// (The list is re-read from game every pass: dropping reassigns the array.)
function matchRoster(game, key, want, spawn, drop) {
  while (game[key].length < want) spawn(game);
  while (game[key].length > want) drop(game, game[key][game[key].length - 1]);
}

function syncRoster(game) {
  const wantCars = game.wanted > 0 ? Math.min(T.maxCars, game.wanted) : 0;
  matchRoster(game, 'policeCars', wantCars, spawnPoliceCar, removePoliceCar);
  const wantOfficers = game.wanted > 0 ? Math.min(T.maxOfficers, game.wanted) : 0;
  matchRoster(game, 'officers', wantOfficers, spawnOfficer, removeOfficer);
}

// Decay: one star per decay interval while nobody can see Marlo. A single
// sighting restarts the countdown, so the player must genuinely break away.
function decayWanted(game, dt) {
  if (game.wanted <= 0) return;
  if (spotted(game)) {
    game.wantedTimer = 0;
    return;
  }
  game.wantedTimer += dt;
  if (game.wantedTimer < T.decaySeconds) return;
  game.wantedTimer = 0;
  setWanted(game, game.wanted - 1);
  if (game.wanted === 0 && game.hud) game.hud.toast('You lost the heat.');
}

// How fast a police car chases at this distance: quick from far off, but
// never as fast as a fleeing car at close range.
function chaseSpeed(gap) {
  if (gap > 90) return 12;
  if (gap > 60) return 30;
  if (gap > 12) return 26;
  return 20;
}

// Ram: contact hurts, but it never slows the player's car — that was the
// pin that made losing the heat impossible. A rammed driver keeps their
// speed and can still break away. The ram dents both cars.
function ramPlayer(game, car, gap, dt) {
  car.policeAI.ramCooldown -= dt;
  if (gap >= T.ramRange || car.policeAI.ramCooldown > 0) return;
  car.policeAI.ramCooldown = T.ramCooldown;
  const p = game.player;
  if (p.inCar && p.car) {
    damageCar(game, p.car, T.ramCarDamage);
    damagePlayer(game, T.ramDamage, 'rammed by police');
  } else {
    damagePlayer(game, T.officerPunchDamage, 'rammed by police');
    const shove = 6;
    p.pos.x += ((p.pos.x - car.pos.x) / (gap || 1)) * shove;
    p.pos.z += ((p.pos.z - car.pos.z) / (gap || 1)) * shove;
  }
  damageCar(game, car, T.ramSelfDamage);
  if (game.audio) game.audio.crash();
}

function drivePoliceCar(game, car, dt) {
  // A wrecked pursuer sits out for 8 s, then the tow truck takes it.
  if (car.wrecked) {
    car.wreckTimer -= dt;
    if (car.wreckTimer <= 0) removePoliceCar(game, car);
    return;
  }
  const p = game.player;
  const dx = p.pos.x - car.pos.x;
  const dz = p.pos.z - car.pos.z;
  const gap = Math.hypot(dx, dz);
  // Past the give-up range a car stands down: coast to a stop and lose you.
  if (gap > T.giveUpRange) {
    car.speed += (0 - car.speed) * Math.min(1, dt * 1.5);
    car.pos.x += Math.sin(car.heading) * car.speed * dt;
    car.pos.z += Math.cos(car.heading) * car.speed * dt;
    car.group.rotation.y = car.heading;
    return;
  }
  const targetHeading = Math.atan2(dx, dz);
  let dh = targetHeading - car.heading;
  while (dh > Math.PI) dh -= Math.PI * 2;
  while (dh < -Math.PI) dh += Math.PI * 2;
  car.heading += clamp(dh, -T.turnRate * dt, T.turnRate * dt);
  const targetSpeed = chaseSpeed(gap);
  car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 1.5);
  car.pos.x += Math.sin(car.heading) * car.speed * dt;
  car.pos.z += Math.cos(car.heading) * car.speed * dt;
  const fixed = collideCircle(game, car.pos.x, car.pos.z, 2.2);
  car.pos.x = fixed.x;
  car.pos.z = fixed.z;
  car.group.rotation.y = car.heading;
  const spin = car.speed * dt * 2.6;
  for (const w of car.wheels) w.rotation.x += spin;
  ramPlayer(game, car, gap, dt);
}

// Foot officers chase on foot and punch — only when Marlo is on foot.
// Past the give-up range they stand down and stop where they are.
function walkOfficer(game, o, dt) {
  const p = game.player;
  const dx = p.pos.x - o.pos.x;
  const dz = p.pos.z - o.pos.z;
  const gap = Math.hypot(dx, dz);
  o.punchCooldown -= dt;
  if (gap > T.giveUpRange) return;
  if (gap > 1.6) {
    const step = Math.min(gap, o.speed * dt);
    const nx = o.pos.x + (dx / (gap || 1)) * step;
    const nz = o.pos.z + (dz / (gap || 1)) * step;
    const fixed = collideCircle(game, nx, nz, 0.5);
    o.pos.x = fixed.x;
    o.pos.z = fixed.z;
    o.group.rotation.y = Math.atan2(dx, dz);
  } else if (!p.inCar && o.punchCooldown <= 0) {
    o.punchCooldown = T.officerPunchCooldown;
    damagePlayer(game, T.officerPunchDamage, 'beaten by an officer');
    if (game.audio) game.audio.punch();
  }
}

export function updatePolice(game, dt) {
  if (game.state !== 'playing') return;
  syncRoster(game);
  decayWanted(game, dt);
  for (const car of game.policeCars) drivePoliceCar(game, car, dt);
  for (const o of game.officers) walkOfficer(game, o, dt);
}

// Was a car theft witnessed? Police within 90 u, or a pedestrian within 22 u.
export function theftWitnessed(game) {
  const p = game.player;
  for (const car of game.policeCars) {
    if (Math.hypot(car.pos.x - p.pos.x, car.pos.z - p.pos.z) < 90) return true;
  }
  for (const ped of game.peds || []) {
    if (Math.hypot(ped.pos.x - p.pos.x, ped.pos.z - p.pos.z) < 22) return true;
  }
  return false;
}
