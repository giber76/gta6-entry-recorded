// police.js — the wanted system for Solara Bay.
//
// Stars run 0–5. Police cars chase and ram; foot officers chase and punch,
// but only while Marlo is on foot. Stars fall one per 10 s, and only while
// no pursuer can see him. A ram damages the player's car as well as
// Marlo, and the ramming police car takes a dent too. A wrecked police
// car holds its roster slot for 8 s before it is towed away, so the
// heat genuinely drops when Marlo wrecks his pursuers.
//
// Why "Lose the Heat" is winnable at all: a fleeing car is faster than any
// police car (38 vs 30 at best), a ram costs health but never touches the
// player's speed, and new pursuers spawn beyond sight range. Drive away
// clean and the stars fall; keep driving into them, or stay on foot, and
// the heat never lets go.

import { nearestRoadPoint, collideCircle } from './city.js';
import { createCar, damageCar } from './vehicles.js';
import { damagePlayer } from './player.js';

const TUNING = {
  decaySeconds: 10,
  sightRange: 70,
  giveUpRange: 120,
  spawnDistance: 95,
  spawnMinDistance: 80,
  ramDamage: 4,
  ramCarDamage: 8,
  ramSelfDamage: 4,
  ramCooldown: 3.0,
  ramRange: 3.4,
  officerPunchDamage: 6,
  officerPunchCooldown: 0.8,
  officerSpeed: 7,
  officerSpawnDistance: 18,
  maxCars: 3,
  maxOfficers: 2,
  turnRate: 2.4,
};

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function initPolice(G) {
  G.wanted = 0;
  G.wantedTimer = 0;
  G.policeCars = [];
  G.officers = [];
}

export function setWanted(G, level) {
  G.wanted = clamp(level, 0, 5);
  G.wantedTimer = 0;
  if (G.hud) G.hud.setStars(G.wanted);
}

export function raiseWanted(G, amount, reason) {
  if (G.wanted >= 5) return;
  setWanted(G, G.wanted + amount);
  if (G.audio) G.audio.wantedUp();
  if (G.hud) G.hud.toast(`Wanted level ${G.wanted} — ${reason}`);
}

function spawnPoliceCar(G) {
  const p = G.player;
  const angle = Math.random() * Math.PI * 2;
  let x = p.pos.x + Math.cos(angle) * TUNING.spawnDistance;
  let z = p.pos.z + Math.sin(angle) * TUNING.spawnDistance;
  // Snap onto the nearest road, then push back out if the snap pulled the
  // car inside sight range — a pursuer must never spawn already watching.
  const road = nearestRoadPoint(x, z);
  x = road.x;
  z = road.z;
  const gap = Math.hypot(x - p.pos.x, z - p.pos.z);
  if (gap < TUNING.spawnMinDistance) {
    const ux = (x - p.pos.x) / (gap || 1);
    const uz = (z - p.pos.z) / (gap || 1);
    x = p.pos.x + ux * TUNING.spawnMinDistance;
    z = p.pos.z + uz * TUNING.spawnMinDistance;
  }
  const car = createCar(G, {
    x,
    z,
    heading: Math.atan2(p.pos.x - x, p.pos.z - z),
    color: 0x1c2733,
    police: true,
  });
  car.policeAI = { ramCooldown: 0 };
  G.policeCars.push(car);
  return car;
}

function spawnOfficer(G) {
  const THREE = window.THREE;
  const p = G.player;
  const angle = Math.random() * Math.PI * 2;
  const x = p.pos.x + Math.cos(angle) * TUNING.officerSpawnDistance;
  const z = p.pos.z + Math.sin(angle) * TUNING.officerSpawnDistance;
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
  G.scene.add(group);
  const officer = { group, pos: group.position, punchCooldown: 0, speed: TUNING.officerSpeed };
  G.officers.push(officer);
  return officer;
}

function dropPoliceCar(G, car) {
  G.scene.remove(car.group);
  G.policeCars = G.policeCars.filter((c) => c !== car);
}

function dropOfficer(G, officer) {
  G.scene.remove(officer.group);
  G.officers = G.officers.filter((o) => o !== officer);
}

// Can any pursuer see Marlo right now? A sighting restarts the decay clock.
function anyoneSees(G) {
  const p = G.player;
  for (const car of G.policeCars) {
    if (Math.hypot(car.pos.x - p.pos.x, car.pos.z - p.pos.z) < TUNING.sightRange) return true;
  }
  for (const o of G.officers) {
    if (Math.hypot(o.pos.x - p.pos.x, o.pos.z - p.pos.z) < TUNING.sightRange) return true;
  }
  return false;
}

// Keep the roster at the wanted level: up to 3 cars, up to 2 officers.
// Extra units leave when the heat drops. A wrecked car holds its slot
// until it is towed, so wrecking a pursuer genuinely thins the chase.
function syncRoster(G) {
  const wantCars = G.wanted > 0 ? Math.min(TUNING.maxCars, G.wanted) : 0;
  while (G.policeCars.length < wantCars) spawnPoliceCar(G);
  while (G.policeCars.length > wantCars) dropPoliceCar(G, G.policeCars[G.policeCars.length - 1]);
  const wantOfficers = G.wanted > 0 ? Math.min(TUNING.maxOfficers, G.wanted) : 0;
  while (G.officers.length < wantOfficers) spawnOfficer(G);
  while (G.officers.length > wantOfficers) dropOfficer(G, G.officers[G.officers.length - 1]);
}

// Decay: one star per decay interval while nobody can see Marlo. A single
// sighting restarts the countdown, so the player must genuinely break away.
function decayWanted(G, dt) {
  if (G.wanted <= 0) return;
  if (anyoneSees(G)) {
    G.wantedTimer = 0;
    return;
  }
  G.wantedTimer += dt;
  if (G.wantedTimer < TUNING.decaySeconds) return;
  G.wantedTimer = 0;
  setWanted(G, G.wanted - 1);
  if (G.wanted === 0 && G.hud) G.hud.toast('You lost the heat.');
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
function ramPlayer(G, car, gap, dt) {
  car.policeAI.ramCooldown -= dt;
  if (gap >= TUNING.ramRange || car.policeAI.ramCooldown > 0) return;
  car.policeAI.ramCooldown = TUNING.ramCooldown;
  const p = G.player;
  if (p.inCar && p.car) {
    damageCar(G, p.car, TUNING.ramCarDamage);
    damagePlayer(G, TUNING.ramDamage, 'rammed by police');
  } else {
    damagePlayer(G, TUNING.officerPunchDamage, 'rammed by police');
    const shove = 6;
    p.pos.x += ((p.pos.x - car.pos.x) / (gap || 1)) * shove;
    p.pos.z += ((p.pos.z - car.pos.z) / (gap || 1)) * shove;
  }
  damageCar(G, car, TUNING.ramSelfDamage);
  if (G.audio) G.audio.crash();
}

function drivePoliceCar(G, car, dt) {
  // A wrecked pursuer sits out for 8 s, then the tow truck takes it.
  if (car.wrecked) {
    car.wreckTimer -= dt;
    if (car.wreckTimer <= 0) dropPoliceCar(G, car);
    return;
  }
  const p = G.player;
  const dx = p.pos.x - car.pos.x;
  const dz = p.pos.z - car.pos.z;
  const gap = Math.hypot(dx, dz);
  // Past the give-up range a car stands down: coast to a stop and lose you.
  if (gap > TUNING.giveUpRange) {
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
  car.heading += clamp(dh, -TUNING.turnRate * dt, TUNING.turnRate * dt);
  const targetSpeed = chaseSpeed(gap);
  car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 1.5);
  car.pos.x += Math.sin(car.heading) * car.speed * dt;
  car.pos.z += Math.cos(car.heading) * car.speed * dt;
  const fixed = collideCircle(G, car.pos.x, car.pos.z, 2.2);
  car.pos.x = fixed.x;
  car.pos.z = fixed.z;
  car.group.rotation.y = car.heading;
  const spin = car.speed * dt * 2.6;
  for (const w of car.wheels) w.rotation.x += spin;
  ramPlayer(G, car, gap, dt);
}

// Foot officers chase on foot and punch — only when Marlo is on foot.
// Past the give-up range they stand down and stop where they are.
function walkOfficer(G, o, dt) {
  const p = G.player;
  const dx = p.pos.x - o.pos.x;
  const dz = p.pos.z - o.pos.z;
  const gap = Math.hypot(dx, dz);
  o.punchCooldown -= dt;
  if (gap > TUNING.giveUpRange) return;
  if (gap > 1.6) {
    const step = Math.min(gap, o.speed * dt);
    const nx = o.pos.x + (dx / (gap || 1)) * step;
    const nz = o.pos.z + (dz / (gap || 1)) * step;
    const fixed = collideCircle(G, nx, nz, 0.5);
    o.pos.x = fixed.x;
    o.pos.z = fixed.z;
    o.group.rotation.y = Math.atan2(dx, dz);
  } else if (!p.inCar && o.punchCooldown <= 0) {
    o.punchCooldown = TUNING.officerPunchCooldown;
    damagePlayer(G, TUNING.officerPunchDamage, 'beaten by an officer');
    if (G.audio) G.audio.punch();
  }
}

export function updatePolice(G, dt) {
  if (G.state !== 'playing') return;
  syncRoster(G);
  decayWanted(G, dt);
  for (const car of G.policeCars) drivePoliceCar(G, car, dt);
  for (const o of G.officers) walkOfficer(G, o, dt);
}

// Was a car theft witnessed? Police within 90 u, or a pedestrian within 22 u.
export function theftWitnessed(G) {
  const p = G.player;
  for (const car of G.policeCars) {
    if (Math.hypot(car.pos.x - p.pos.x, car.pos.z - p.pos.z) < 90) return true;
  }
  for (const ped of G.peds || []) {
    if (Math.hypot(ped.pos.x - p.pos.x, ped.pos.z - p.pos.z) < 22) return true;
  }
  return false;
}
