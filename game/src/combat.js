// combat.js — fists, the pistol, and the Crimson Vipers.
//
// Marlo fights on foot, and with the pistol he fights from the car too:
// a drive-by aims along the camera, so dragging the mouse sideways lets
// him shoot out of the window. Fists reach 2.4 u and hit for 25; the
// pistol reaches 70 u and hits for 34, so a Viper (100 health) falls to
// three shots. A pistol round does 15 damage to a car body. Enemies close
// to 15 u, then strafe sideways and shoot with poor aim — about one shot
// in four lands, for 6 damage. Dead enemies fall and fade after 1.2 s.
// Tracers are thin yellow lines that live 0.09 s.

import { scatterPeds } from './pedestrians.js';
import { damagePlayer } from './player.js';
import { damageCar } from './vehicles.js';
import { spawnSparks, muzzleFlash } from './effects.js';

const WEAPONS = {
  fists: { damage: 25, reach: 2.4, cooldown: 0.4 },
  pistol: { damage: 34, reach: 70, cooldown: 0.25 },
};
const CAR_SHOT_DAMAGE = 15;
const VIPER_HEALTH = 100;
const VIPER_ADVANCE = 5.5;
const VIPER_STRAFE = 3.5;
const VIPER_TOO_CLOSE = 6;
const VIPER_SHOOT_RANGE = 40;
const VIPER_NOTICE_RANGE = 45;
const VIPER_STANDOFF = 15;
const VIPER_HIT_CHANCE = 0.25;
const VIPER_HIT_DAMAGE = 6;
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
function buildViper(THREE, x, z) {
  const group = new THREE.Group();
  const crimson = new THREE.MeshLambertMaterial({ color: 0x8e1f2f });
  const skin = new THREE.MeshLambertMaterial({ color: 0x8a6a4a });
  const dark = new THREE.MeshLambertMaterial({ color: 0x1c1c1c });
  // [geometry, material, x, y, z] for the fixed body parts.
  const parts = [
    [new THREE.CylinderGeometry(0.42, 0.5, 1.05, 10), crimson, 0, 1.05, 0],
    [new THREE.SphereGeometry(0.3, 12, 10), skin, 0, 1.85, 0],
    [new THREE.CylinderGeometry(0.31, 0.31, 0.1, 12), dark, 0, 1.98, 0],
    [new THREE.BoxGeometry(0.09, 0.14, 0.5), dark, 0.3, 1.25, 0.5],
  ];
  const meshes = [];
  for (const [geo, mat, px, py, pz] of parts) {
    const piece = new THREE.Mesh(geo, mat);
    piece.position.set(px, py, pz);
    group.add(piece);
    meshes.push(piece);
  }
  meshes[0].castShadow = true;
  const shinL = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.7, 8), dark);
  shinL.position.set(-0.2, 0.35, 0);
  group.add(shinL);
  const shinR = shinL.clone();
  shinR.position.x = 0.2;
  group.add(shinR);
  group.position.set(x, 0, z);
  return { group, body: meshes[0], legL: shinL, legR: shinR, gun: meshes[3] };
}

export function spawnEnemy(G, x, z, missionTag) {
  const THREE = window.THREE;
  const parts = buildViper(THREE, x, z);
  G.scene.add(parts.group);
  const viper = {
    ...parts,
    pos: parts.group.position,
    health: VIPER_HEALTH,
    missionTag: missionTag ?? null,
    shootCooldown: 1 + Math.random(),
    walkPhase: Math.random() * 6,
    strafeDir: Math.random() < 0.5 ? 1 : -1,
    strafeTimer: 0.5 + Math.random(),
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

// Where a shot starts: Marlo's shoulder on foot, the car window while
// driving. Aims along his facing on foot, along the camera while driving.
function gunMuzzle(G) {
  const THREE = window.THREE;
  const p = G.player;
  const yaw = p.inCar ? G.camYaw : p.yaw;
  const fwd = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
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

// The nearest car body the ray hits, or null. The car Marlo is driving
// is never a target — a drive-by must not shoot his own car.
function raycastCars(G, origin, dir) {
  const cars = [...(G.policeCars || []), ...(G.trafficCars || []), ...(G.parkedCars || [])];
  let best = null;
  for (const car of cars) {
    if (car.wrecked || car.dead || car.isPlayer) continue;
    G.raycaster.set(origin, dir);
    G.raycaster.far = WEAPONS.pistol.reach;
    const hits = G.raycaster.intersectObject(car.group, true);
    if (hits.length > 0 && (!best || hits[0].distance < best.distance)) {
      best = { car, hit: hits[0] };
    }
  }
  return best;
}

function firePistol(G) {
  const THREE = window.THREE;
  const p = G.player;
  if (p.shootCooldown > 0) return { fired: false, reason: 'cooldown', cooldown: p.shootCooldown };
  p.shootCooldown = WEAPONS.pistol.cooldown;
  if (G.audio) G.audio.shot();
  scatterPeds(G, p.pos.x, p.pos.z, 25);
  // Aim from the muzzle along the facing (on foot) or the camera (driving):
  // the crosshair sits on whatever is being aimed at.
  const yaw = p.inCar ? G.camYaw : p.yaw;
  const origin = new THREE.Vector3(p.pos.x, 1.35, p.pos.z);
  const dir = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
  muzzleFlash(G, origin.x + dir.x * 0.8, 1.35, origin.z + dir.z * 0.8);
  G.raycaster.set(origin, dir);
  G.raycaster.far = WEAPONS.pistol.reach;
  const bodies = [];
  for (const e of livingEnemies(G)) bodies.push(e.body);
  const enemyHits = G.raycaster.intersectObjects(bodies, false);
  const carHit = raycastCars(G, origin, dir);
  let end;
  const enemyDist = enemyHits.length > 0 ? enemyHits[0].distance : Infinity;
  const carDist = carHit ? carHit.hit.distance : Infinity;
  let result = { fired: true, hit: 'none', yaw, origin: [origin.x, origin.z] };
  if (enemyDist < carDist) {
    const hit = enemyHits[0];
    end = hit.point.clone();
    const viper = livingEnemies(G).find((e) => e.body === hit.object);
    if (viper) damageEnemy(G, viper, WEAPONS.pistol.damage);
    result.hit = 'enemy';
    result.dist = enemyDist;
  } else if (carHit) {
    end = carHit.hit.point.clone();
    spawnSparks(G, end.x, end.y, end.z);
    damageCar(G, carHit.car, CAR_SHOT_DAMAGE);
    result.hit = 'car';
    result.dist = carDist;
    result.carHealth = carHit.car.health;
    result.carWrecked = carHit.car.wrecked;
  } else {
    end = origin.clone().add(dir.multiplyScalar(WEAPONS.pistol.reach));
  }
  drawTracer(G, gunMuzzle(G), end);
  return result;
}

// Marlo attacks: fists on foot only; the pistol works on foot and from
// the driver's seat (a drive-by, aimed along the camera). Returns what
// the attack did, for the debug hooks.
export function playerAttack(G) {
  const p = G.player;
  if (G.state !== 'playing' || p.health <= 0) return { fired: false, reason: 'not-playing' };
  if (p.weapon === 'fists') {
    if (p.inCar) return { fired: false, reason: 'fists-in-car' };
    throwPunch(G);
    return { fired: true, hit: 'punch' };
  }
  if (p.weapon === 'pistol' && p.hasPistol) return firePistol(G);
  return { fired: false, reason: 'no-pistol' };
}

export function damageEnemy(G, enemy, amount) {
  if (enemy.dead) return;
  enemy.health -= amount;
  if (enemy.health > 0) return;
  enemy.dead = true;
  enemy.deadTimer = 1.2;
  enemy.group.rotation.x = -Math.PI / 2;
  if (G.onEnemyKilled) G.onEnemyKilled(enemy);
}

// Walk a Viper toward Marlo until it is inside its standoff range; once
// there it strafes sideways and backs off if Marlo closes in, instead of
// standing still to be shot.
function advanceViper(e, dx, dz, gap, dt) {
  if (gap > VIPER_STANDOFF) {
    const step = VIPER_ADVANCE * dt;
    e.pos.x += (dx / gap) * step;
    e.pos.z += (dz / gap) * step;
    e.walkPhase += dt * 9;
    const swing = Math.sin(e.walkPhase) * 0.5;
    e.legL.rotation.x = swing;
    e.legR.rotation.x = -swing;
    return;
  }
  e.strafeTimer -= dt;
  if (e.strafeTimer <= 0) {
    e.strafeTimer = 0.8 + Math.random() * 1.2;
    e.strafeDir = Math.random() < 0.5 ? 1 : -1;
  }
  // Sidestep perpendicular to the line to Marlo; back away when too close.
  let mx = (-dz / gap) * e.strafeDir;
  let mz = (dx / gap) * e.strafeDir;
  if (gap < VIPER_TOO_CLOSE) {
    mx -= (dx / gap) * 0.8;
    mz -= (dz / gap) * 0.8;
  }
  const step = VIPER_STRAFE * dt;
  e.pos.x += mx * step;
  e.pos.z += mz * step;
  e.walkPhase += dt * 9;
  const swing = Math.sin(e.walkPhase) * 0.5;
  e.legL.rotation.x = swing;
  e.legR.rotation.x = -swing;
}

function viperShoot(G, e) {
  const THREE = window.THREE;
  const p = G.player;
  e.shootCooldown = 1.1 + Math.random() * 0.7;
  if (G.audio) G.audio.enemyShot();
  const from = new THREE.Vector3(e.pos.x, 1.4, e.pos.z);
  const to = new THREE.Vector3(p.pos.x, 1.3, p.pos.z);
  drawTracer(G, from, to);
  if (Math.random() < VIPER_HIT_CHANCE) {
    damagePlayer(G, VIPER_HIT_DAMAGE, 'shot by a Viper');
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
    if (gap >= VIPER_NOTICE_RANGE || p.health <= 0 || G.state !== 'playing') continue;
    advanceViper(e, dx, dz, gap, dt);
    e.group.rotation.y = Math.atan2(dx, dz);
    if (gap < VIPER_SHOOT_RANGE && e.shootCooldown <= 0) viperShoot(G, e);
  }
  fadeTracers(G, dt);
}
