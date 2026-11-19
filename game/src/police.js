// police.js — the wanted system for Solara Bay.
//
// Wanted runs 0-5. Police cars chase and ram; foot officers chase and punch
// (on-foot players only). Wanted falls one star per 10 s while no officer or
// police car can see the player.
//
// The stand-down rule that makes "Lose the Heat" winnable: a fleeing player
// in a car is FASTER than the police (38 vs 32), rams hurt but never pin the
// car down, and police spawn outside sight range — so a good driver can
// actually break away, the heat decays, and the chase stands down. A player
// who keeps driving into the police, or on foot, stays caught.

import { nearestRoadPoint } from './city.js';
import { createCar } from './vehicles.js';
import { collideCircle } from './city.js';
import { damagePlayer } from './player.js';

const DECAY_SECONDS = 10;
const SIGHT_RANGE = 70;
// Past this distance a pursuer gives up the chase and pulls over.
const GIVE_UP_RANGE = 120;
// New pursuers appear outside sight range, so the heat timer is not reset
// the instant they spawn.
const SPAWN_DISTANCE = 95;
const SPAWN_MIN_DISTANCE = 80;
// A ram hurts (4 damage) but never slows the player's car: rams used to
// chain together and pin the car below police speed, so the heat could
// never be lost at all.
const RAM_DAMAGE = 4;
const RAM_COOLDOWN = 3;

export function initPolice(G) {
  G.wanted = 0;
  G.wantedTimer = 0;
  G.policeCars = [];
  G.officers = [];
}

export function setWanted(G, level) {
  G.wanted = Math.max(0, Math.min(5, level));
  G.wantedTimer = 0;
  if (G.hud) G.hud.setStars(G.wanted);
}

export function raiseWanted(G, amount, reason) {
  if (G.wanted >= 5) return;
  setWanted(G, G.wanted + amount);
  if (G.hud) G.hud.toast(`Wanted level ${G.wanted} — ${reason}`);
}

function spawnPoliceCar(G) {
  const p = G.player;
  const angle = Math.random() * Math.PI * 2;
  let sx = p.pos.x + Math.cos(angle) * SPAWN_DISTANCE;
  let sz = p.pos.z + Math.sin(angle) * SPAWN_DISTANCE;
  // Snap to the nearest road, then push back out if the snap pulled the car
  // inside sight range — a pursuer must never spawn already watching you.
  const road = nearestRoadPoint(sx, sz);
  sx = road.x;
  sz = road.z;
  const d = Math.hypot(sx - p.pos.x, sz - p.pos.z);
  if (d < SPAWN_MIN_DISTANCE) {
    const ux = (sx - p.pos.x) / (d || 1);
    const uz = (sz - p.pos.z) / (d || 1);
    sx = p.pos.x + ux * SPAWN_MIN_DISTANCE;
    sz = p.pos.z + uz * SPAWN_MIN_DISTANCE;
  }
  const car = createCar(G, {
    x: sx,
    z: sz,
    heading: Math.atan2(p.pos.x - sx, p.pos.z - sz),
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
  const x = p.pos.x + Math.cos(angle) * 18;
  const z = p.pos.z + Math.sin(angle) * 18;
  const group = new THREE.Group();
  const navy = new THREE.MeshLambertMaterial({ color: 0x1c2733 });
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98d64 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.48, 1.05, 10), navy);
  body.position.y = 1.05;
  body.castShadow = true;
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), skin);
  head.position.y = 1.85;
  group.add(head);
  const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.1, 12), new THREE.MeshLambertMaterial({ color: 0x0d1420 }));
  hat.position.y = 2.05;
  group.add(hat);
  group.position.set(x, 0, z);
  G.scene.add(group);
  const officer = { group, pos: group.position, punchCooldown: 0, speed: 7 };
  G.officers.push(officer);
  return officer;
}

function removePoliceCar(G, car) {
  G.scene.remove(car.group);
  G.policeCars = G.policeCars.filter((c) => c !== car);
}

function removeOfficer(G, officer) {
  G.scene.remove(officer.group);
  G.officers = G.officers.filter((o) => o !== officer);
}

function anyoneCanSee(G) {
  const p = G.player;
  for (const car of G.policeCars) {
    if (Math.hypot(car.pos.x - p.pos.x, car.pos.z - p.pos.z) < SIGHT_RANGE) return true;
  }
  for (const o of G.officers) {
    if (Math.hypot(o.pos.x - p.pos.x, o.pos.z - p.pos.z) < SIGHT_RANGE) return true;
  }
  return false;
}

export function updatePolice(G, dt) {
  const p = G.player;
  if (G.state !== 'playing') return;

  // Roster matches the wanted level: up to 3 cars, foot officers up to the star count.
  const wantCars = G.wanted > 0 ? Math.min(3, G.wanted) : 0;
  while (G.policeCars.length < wantCars) spawnPoliceCar(G);
  while (G.policeCars.length > wantCars) removePoliceCar(G, G.policeCars[G.policeCars.length - 1]);
  const wantOfficers = G.wanted > 0 ? Math.min(2, G.wanted) : 0;
  while (G.officers.length < wantOfficers) spawnOfficer(G);
  while (G.officers.length > wantOfficers) removeOfficer(G, G.officers[G.officers.length - 1]);

  // Decay: one star per DECAY_SECONDS while nobody can see the player.
  // A single sighting restarts the countdown, so the player must genuinely
  // break away — but once out of sight the stars do fall.
  if (G.wanted > 0) {
    if (anyoneCanSee(G)) {
      G.wantedTimer = 0;
    } else {
      G.wantedTimer += dt;
      if (G.wantedTimer >= DECAY_SECONDS) {
        G.wantedTimer = 0;
        setWanted(G, G.wanted - 1);
        if (G.wanted === 0 && G.hud) G.hud.toast('You lost the heat.');
      }
    }
  }

  // Police cars chase and ram. They are a touch slower than a fleeing car
  // at full speed, so a good driver breaks away — and past GIVE_UP_RANGE
  // they stand down, coast to a stop and lose you (GTA-style: outrun them
  // and the heat can actually die).
  for (const car of G.policeCars) {
    const dx = p.pos.x - car.pos.x;
    const dz = p.pos.z - car.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist > GIVE_UP_RANGE) {
      // Stood down: coast to a stop, no longer closing in.
      car.speed += (0 - car.speed) * Math.min(1, dt * 1.5);
      car.pos.x += Math.sin(car.heading) * car.speed * dt;
      car.pos.z += Math.cos(car.heading) * car.speed * dt;
      car.group.rotation.y = car.heading;
      continue;
    }
    const targetHeading = Math.atan2(dx, dz);
    let dh = targetHeading - car.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    car.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, dh));
    // Fast enough to be a threat up close, never as fast as a fleeing car.
    const targetSpeed = dist > 90 ? 12 : dist > 60 ? 30 : dist > 12 ? 26 : 20;
    car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 1.5);
    car.pos.x += Math.sin(car.heading) * car.speed * dt;
    car.pos.z += Math.cos(car.heading) * car.speed * dt;
    const fixed = collideCircle(G, car.pos.x, car.pos.z, 2.2);
    car.pos.x = fixed.x;
    car.pos.z = fixed.z;
    car.group.rotation.y = car.heading;
    const spin = car.speed * dt * 2.6;
    for (const w of car.wheels) w.rotation.x += spin;

    // Ram: contact hurts, but it never slows the player's car — that was
    // the pin that made losing the heat impossible. A rammed driver keeps
    // their speed and can still break away.
    car.policeAI.ramCooldown -= dt;
    if (dist < 3.4 && car.policeAI.ramCooldown <= 0) {
      car.policeAI.ramCooldown = RAM_COOLDOWN;
      if (p.inCar && p.car) {
        damagePlayer(G, RAM_DAMAGE, 'rammed by police');
        if (G.audio) G.audio.crash();
      } else {
        damagePlayer(G, 6, 'rammed by police');
        const push = 6;
        p.pos.x += (p.pos.x - car.pos.x) / (dist || 1) * push;
        p.pos.z += (p.pos.z - car.pos.z) / (dist || 1) * push;
        if (G.audio) G.audio.crash();
      }
    }
  }

  // Foot officers chase on foot and punch — only when the player is on foot.
  // Past GIVE_UP_RANGE they stand down too and stop where they are.
  for (const o of G.officers) {
    const dx = p.pos.x - o.pos.x;
    const dz = p.pos.z - o.pos.z;
    const dist = Math.hypot(dx, dz);
    o.punchCooldown -= dt;
    if (dist > GIVE_UP_RANGE) continue;
    if (dist > 1.6) {
      const step = Math.min(dist, o.speed * dt);
      const nx = o.pos.x + (dx / (dist || 1)) * step;
      const nz = o.pos.z + (dz / (dist || 1)) * step;
      const fixed = collideCircle(G, nx, nz, 0.5);
      o.pos.x = fixed.x;
      o.pos.z = fixed.z;
      o.group.rotation.y = Math.atan2(dx, dz);
    } else if (!p.inCar && o.punchCooldown <= 0) {
      o.punchCooldown = 0.8;
      damagePlayer(G, 6, 'beaten by an officer');
      if (G.audio) G.audio.punch();
    }
  }
}

// Was a car theft witnessed? Police within 90 u or a pedestrian within 22 u.
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
