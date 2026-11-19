// combat.js — fists, the pistol, and the Crimson Vipers.
//
// Marlo fights on foot with fists or the pistol, and from the driver's
// seat with drive-by shots aimed along the camera. Fists reach 2.4 u
// and hit for 25; the pistol reaches 70 u and hits for 34, so a Viper
// (100 health) falls to three shots — and a car body takes the same 34.
// Vipers close to 15 u, then sidestep in a standoff and shoot with poor
// aim — about one shot in four lands, for 6 damage. A Viper backs off
// when Marlo gets right up in its face. Dead Vipers fall and fade
// after 1.2 s. Tracers are thin yellow lines that live 0.09 s.

import { scatterPeds } from './pedestrians.js';
import { damagePlayer } from './player.js';
import { damageCar } from './vehicles.js';
import { spawnMuzzleFlash } from './effects.js';

// [weapon, damage, reach, cooldown]
const WEAPON_ROWS = [
  ['fists', 25, 2.4, 0.4],
  ['pistol', 34, 70, 0.25],
];
const WEAPONS = Object.fromEntries(
  WEAPON_ROWS.map(([name, damage, reach, cooldown]) => [name, { damage, reach, cooldown }])
);

// Viper tuning, in one place.
const VIPER = {
  health: 100,
  advance: 5.5,
  shootRange: 40,
  noticeRange: 45,
  standoff: 15,
  backoffRange: 6,
  strafeSpeed: 3,
  retreatSpeed: 3.5,
  hitChance: 0.25,
  hitDamage: 6,
};
const TRACER_LIFE = 0.09;

export function initCombat(G) {
  const THREE = window.THREE;
  G.enemies = [];
  G.tracers = [];
  // One material shared by every tracer line.
  G.tracerMat = new THREE.LineBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.9 });
  G.raycaster = new THREE.Raycaster();
}

// A Viper: crimson shirt, dark headband, a pistol in hand.
function makeViperMesh(THREE, x, z) {
  const group = new THREE.Group();
  const crimson = new THREE.MeshLambertMaterial({ color: 0x8e1f2f });
  const skin = new THREE.MeshLambertMaterial({ color: 0x8a6a4a });
  const dark = new THREE.MeshLambertMaterial({ color: 0x1c1c1c });
  // Body pieces as {shape, skin, at:[x,y,z]}.
  const bodyPlan = [
    { shape: new THREE.CylinderGeometry(0.42, 0.5, 1.05, 10), skin: crimson, at: [0, 1.05, 0] },
    { shape: new THREE.SphereGeometry(0.3, 12, 10), skin, at: [0, 1.85, 0] },
    { shape: new THREE.CylinderGeometry(0.31, 0.31, 0.1, 12), skin: dark, at: [0, 1.98, 0] },
    { shape: new THREE.BoxGeometry(0.09, 0.14, 0.5), skin: dark, at: [0.3, 1.25, 0.5] },
  ];
  const built = [];
  for (const piece of bodyPlan) {
    const mesh = new THREE.Mesh(piece.shape, piece.skin);
    mesh.position.set(piece.at[0], piece.at[1], piece.at[2]);
    group.add(mesh);
    built.push(mesh);
  }
  built[0].castShadow = true;
  const shinL = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.7, 8), dark);
  shinL.position.set(-0.2, 0.35, 0);
  group.add(shinL);
  const shinR = shinL.clone();
  shinR.position.x = 0.2;
  group.add(shinR);
  group.position.set(x, 0, z);
  return { group, body: built[0], legL: shinL, legR: shinR, gun: built[3] };
}

export function spawnEnemy(G, x, z, missionTag) {
  const THREE = window.THREE;
  const parts = makeViperMesh(THREE, x, z);
  G.scene.add(parts.group);
  const viper = {
    ...parts,
    pos: parts.group.position,
    health: VIPER.health,
    missionTag: missionTag ?? null,
    shootCooldown: 1 + Math.random(),
    walkPhase: Math.random() * 6,
    strafeTimer: 0,
    strafeDir: 1,
    dead: false,
    deadTimer: 0,
  };
  G.enemies.push(viper);
  return viper;
}

export function livingEnemies(G) {
  return G.enemies.filter((e) => !e.dead);
}

function drawTracer(G, from, to) {
  const THREE = window.THREE;
  const geo = new THREE.BufferGeometry().setFromPoints([from.clone(), to.clone()]);
  const line = new THREE.Line(geo, G.tracerMat);
  G.scene.add(line);
  G.tracers.push({ line, life: TRACER_LIFE });
}

function muzzlePoint(G) {
  const p = G.player;
  const fwd = new THREE.Vector3(Math.sin(p.yaw), 0, Math.cos(p.yaw));
  return new THREE.Vector3(p.pos.x + fwd.x * 0.8, 1.35, p.pos.z + fwd.z * 0.8);
}

// Nearest living enemy or officer in front of Marlo, inside fist reach.
function punchTarget(G) {
  const p = G.player;
  const reach = WEAPONS.fists.reach;
  const marks = [...livingEnemies(G), ...G.officers];
  let mark = null;
  let markD = reach;
  for (const t of marks) {
    const dx = t.pos.x - p.pos.x;
    const dz = t.pos.z - p.pos.z;
    const gap = Math.hypot(dx, dz);
    if (gap > markD) continue;
    const facing = dx * Math.sin(p.yaw) + dz * Math.cos(p.yaw);
    if (facing < 0) continue;
    markD = gap;
    mark = t;
  }
  return mark;
}

function throwPunch(G) {
  const p = G.player;
  if (p.punchCooldown > 0) return;
  p.punchCooldown = WEAPONS.fists.cooldown;
  if (G.audio) G.audio.punch();
  const mark = punchTarget(G);
  if (!mark) return;
  if (mark.health !== undefined) {
    damageEnemy(G, mark, WEAPONS.fists.damage);
    return;
  }
  // An officer: a punch shoves them back two units.
  mark.pos.x += Math.sin(p.yaw) * 2;
  mark.pos.z += Math.cos(p.yaw) * 2;
}

// Every car the pistol can hit: parked, traffic and police cars, except
// Marlo's own ride and any wreck.
function driveByCarTargets(G, ownCar) {
  const groups = [];
  const all = [
    ...(G.parkedCars || []),
    ...(G.trafficCars || []),
    ...(G.policeCars || []),
  ];
  for (const car of all) {
    if (car === ownCar || car.wrecked || car.dead) continue;
    groups.push(car.group);
  }
  return groups;
}

// Walk up from a raycast hit to the car it belongs to (the group carries
// the car in userData), or null when the hit was not a car.
function carFromObject(obj) {
  let cur = obj;
  while (cur) {
    if (cur.userData && cur.userData.car) return cur.userData.car;
    cur = cur.parent;
  }
  return null;
}

function firePistol(G) {
  const THREE = window.THREE;
  const p = G.player;
  if (p.shootCooldown > 0) return;
  p.shootCooldown = WEAPONS.pistol.cooldown;
  if (G.audio) G.audio.shot();
  scatterPeds(G, p.pos.x, p.pos.z, 25);
  // Aim from Marlo's shoulder along his facing — or, from the driver's
  // seat, along the camera. The crosshair sits on whatever he faces.
  const driving = p.inCar && p.car;
  const origin = driving
    ? new THREE.Vector3(p.car.pos.x, 1.35, p.car.pos.z)
    : new THREE.Vector3(p.pos.x, 1.35, p.pos.z);
  const aimYaw = driving ? G.camYaw : p.yaw;
  const dir = new THREE.Vector3(Math.sin(aimYaw), 0, Math.cos(aimYaw));
  G.raycaster.set(origin, dir);
  G.raycaster.far = WEAPONS.pistol.reach;
  const bodies = [];
  for (const e of livingEnemies(G)) bodies.push(e.body);
  const targets = [...bodies, ...driveByCarTargets(G, driving ? p.car : null)];
  const hits = G.raycaster.intersectObjects(targets, true);
  let end;
  if (hits.length > 0) {
    const hit = hits[0];
    end = hit.point.clone();
    const viper = livingEnemies(G).find((e) => e.body === hit.object);
    if (viper) {
      damageEnemy(G, viper, WEAPONS.pistol.damage);
    } else {
      // A car body: the shot dents it, and enough dents wreck it.
      const car = carFromObject(hit.object);
      if (car && car !== p.car) damageCar(G, car, WEAPONS.pistol.damage);
    }
  } else {
    end = origin.clone().add(dir.multiplyScalar(WEAPONS.pistol.reach));
  }
  const muzzle = driving
    ? new THREE.Vector3(p.car.pos.x + dir.x * 1.2, 1.35, p.car.pos.z + dir.z * 1.2)
    : muzzlePoint(G);
  spawnMuzzleFlash(G, muzzle.x, muzzle.y, muzzle.z, dir.x, dir.z);
  drawTracer(G, muzzle, end);
}

// Marlo attacks with fists or the pistol. From the driver's seat only
// the pistol fires — a drive-by, aimed along the camera.
export function playerAttack(G) {
  const p = G.player;
  if (G.state !== 'playing' || p.health <= 0) return;
  if (p.inCar) {
    if (p.weapon === 'pistol' && p.hasPistol) firePistol(G);
    return;
  }
  if (p.weapon === 'fists') {
    throwPunch(G);
    return;
  }
  if (p.weapon === 'pistol' && p.hasPistol) firePistol(G);
}

export function damageEnemy(G, enemy, amount) {
  if (enemy.dead) return;
  enemy.health -= amount;
  if (enemy.health > 0) {
    // A surviving Viper flinches: it staggers for a moment and its
    // aim is thrown off, so landing a hit buys Marlo a little time.
    enemy.flinchTimer = 0.35;
    enemy.aimError = 0.5;
    return;
  }
  enemy.dead = true;
  enemy.deadTimer = 1.2;
  enemy.group.rotation.x = -Math.PI / 2;
  if (G.onEnemyKilled) G.onEnemyKilled(enemy);
}

// One leg swing step for a walking Viper.
function swingLegs(e, dt) {
  e.walkPhase += dt * 9;
  const swing = Math.sin(e.walkPhase) * 0.5;
  e.legL.rotation.x = swing;
  e.legR.rotation.x = -swing;
}

// Walk a Viper toward Marlo until it is inside its standoff range.
function advanceViper(e, dx, dz, gap, dt) {
  if (gap <= VIPER.standoff) return;
  const step = VIPER.advance * dt;
  e.pos.x += (dx / gap) * step;
  e.pos.z += (dz / gap) * step;
  swingLegs(e, dt);
}

// Inside the standoff a Viper sidesteps instead of closing in, and it
// backs off when Marlo gets right up in its face.
function strafeViper(e, dx, dz, gap, dt) {
  if (gap < VIPER.backoffRange) {
    const away = VIPER.retreatSpeed * dt;
    e.pos.x -= (dx / (gap || 1)) * away;
    e.pos.z -= (dz / (gap || 1)) * away;
    swingLegs(e, dt);
    return;
  }
  e.strafeTimer -= dt;
  if (e.strafeTimer <= 0) {
    e.strafeTimer = 1 + Math.random() * 1.5;
    e.strafeDir = Math.random() < 0.5 ? 1 : -1;
  }
  const px = -dz / (gap || 1);
  const pz = dx / (gap || 1);
  const step = VIPER.strafeSpeed * dt * e.strafeDir;
  e.pos.x += px * step;
  e.pos.z += pz * step;
  swingLegs(e, dt);
}

function viperShoot(G, e) {
  const THREE = window.THREE;
  const p = G.player;
  e.shootCooldown = 1.1 + Math.random() * 0.7;
  if (G.audio) G.audio.enemyShot();
  const from = new THREE.Vector3(e.pos.x, 1.4, e.pos.z);
  const to = new THREE.Vector3(p.pos.x, 1.3, p.pos.z);
  drawTracer(G, from, to);
  if (Math.random() < VIPER.hitChance) {
    damagePlayer(G, VIPER.hitDamage, 'shot by a Viper');
  }
}

// Fade out and remove tracers whose life ran out.
function fadeTracers(G, dt) {
  for (const t of G.tracers) {
    t.life -= dt;
    if (t.life <= 0) {
      G.scene.remove(t.line);
      t.line.geometry.dispose();
    }
  }
  G.tracers = G.tracers.filter((t) => t.life > 0);
}

export function updateEnemies(G, dt) {
  const p = G.player;
  for (const e of G.enemies) {
    if (e.dead) {
      e.deadTimer -= dt;
      if (e.deadTimer <= 0) {
        G.scene.remove(e.group);
        G.enemies = G.enemies.filter((x) => x !== e);
      }
      continue;
    }
    const dx = p.pos.x - e.pos.x;
    const dz = p.pos.z - e.pos.z;
    const gap = Math.hypot(dx, dz);
    e.shootCooldown -= dt;
    // A flinching Viper staggers and cannot shoot; its aim error
    // decays back to normal over the next second.
    if (e.flinchTimer > 0) {
      e.flinchTimer -= dt;
      e.aimError = Math.max(0.12, e.aimError - dt * 0.4);
      continue;
    }
    if (gap >= VIPER.noticeRange || p.health <= 0 || G.state !== 'playing') continue;
    if (gap > VIPER.standoff) advanceViper(e, dx, dz, gap, dt);
    else strafeViper(e, dx, dz, gap, dt);
    e.group.rotation.y = Math.atan2(dx, dz);
    if (gap < VIPER.shootRange && e.shootCooldown <= 0) viperShoot(G, e);
  }
  fadeTracers(G, dt);
}
