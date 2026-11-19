// combat.js — fists, the pistol, and the Crimson Vipers.
//
// Marlo fights on foot only. Fists reach 2.4 u and hit for 25; the pistol
// reaches 70 u and hits for 34, so a Viper (100 health) falls to three
// shots. Enemies close to 15 u, then stand and shoot with poor aim —
// about one shot in four lands, for 6 damage. Dead enemies fall and fade
// after 1.2 s. Tracers are thin yellow lines that live 0.09 s.

import { scatterPeds } from './pedestrians.js';
import { damagePlayer } from './player.js';

const WEAPONS = {
  fists: { damage: 25, reach: 2.4, cooldown: 0.4 },
  pistol: { damage: 34, reach: 70, cooldown: 0.25 },
};
const VIPER_HEALTH = 100;
const VIPER_ADVANCE = 5.5;
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

function gunMuzzle(G) {
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

function firePistol(G) {
  const THREE = window.THREE;
  const p = G.player;
  if (p.shootCooldown > 0) return;
  p.shootCooldown = WEAPONS.pistol.cooldown;
  if (G.audio) G.audio.shot();
  scatterPeds(G, p.pos.x, p.pos.z, 25);
  // Aim from Marlo's shoulder along his facing: the crosshair sits on
  // whatever he is facing.
  const origin = new THREE.Vector3(p.pos.x, 1.35, p.pos.z);
  const dir = new THREE.Vector3(Math.sin(p.yaw), 0, Math.cos(p.yaw));
  G.raycaster.set(origin, dir);
  G.raycaster.far = WEAPONS.pistol.reach;
  const bodies = [];
  for (const e of livingEnemies(G)) bodies.push(e.body);
  const hits = G.raycaster.intersectObjects(bodies, false);
  let end;
  if (hits.length > 0) {
    const hit = hits[0];
    end = hit.point.clone();
    const viper = livingEnemies(G).find((e) => e.body === hit.object);
    if (viper) damageEnemy(G, viper, WEAPONS.pistol.damage);
  } else {
    end = origin.clone().add(dir.multiplyScalar(WEAPONS.pistol.reach));
  }
  drawTracer(G, gunMuzzle(G), end);
}

// Marlo attacks on foot only: fists or the pistol, by his current weapon.
export function playerAttack(G) {
  const p = G.player;
  if (G.state !== 'playing' || p.inCar || p.health <= 0) return;
  if (p.weapon === 'fists') {
    throwPunch(G);
    return;
  }
  if (p.weapon === 'pistol' && p.hasPistol) firePistol(G);
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

// Walk a Viper toward Marlo until it is inside its standoff range.
function advanceViper(e, dx, dz, gap, dt) {
  if (gap <= VIPER_STANDOFF) return;
  const step = VIPER_ADVANCE * dt;
  e.pos.x += (dx / gap) * step;
  e.pos.z += (dz / gap) * step;
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
