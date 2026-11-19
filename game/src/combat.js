// combat.js — fists, the pistol, muzzle flashes, tracers and the Crimson Vipers.
// Enemies are simple: they advance, shoot with poor aim, and die after three pistol hits.

import { scatterPeds } from './pedestrians.js';
import { damagePlayer } from './player.js';

const ENEMY_HEALTH = 100;
const PISTOL_DAMAGE = 34;
const PUNCH_DAMAGE = 25;
const PUNCH_RANGE = 2.4;
const PISTOL_RANGE = 70;

export function initCombat(G) {
  const THREE = window.THREE;
  G.enemies = [];
  G.tracers = [];
  // A short-lived line from the muzzle to the hit point.
  G.tracerMat = new THREE.LineBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.9 });
  G.raycaster = new THREE.Raycaster();
}

function makeViperMesh(THREE, x, z) {
  const group = new THREE.Group();
  const crimson = new THREE.MeshLambertMaterial({ color: 0x8e1f2f });
  const skin = new THREE.MeshLambertMaterial({ color: 0x8a6a4a });
  const dark = new THREE.MeshLambertMaterial({ color: 0x1c1c1c });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 1.05, 10), crimson);
  body.position.y = 1.05;
  body.castShadow = true;
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), skin);
  head.position.y = 1.85;
  group.add(head);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.1, 12), dark);
  band.position.y = 1.98;
  group.add(band);
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.14, 0.5), dark);
  gun.position.set(0.3, 1.25, 0.5);
  group.add(gun);
  const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.7, 8), dark);
  legL.position.set(-0.2, 0.35, 0);
  group.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.2;
  group.add(legR);
  group.position.set(x, 0, z);
  return { group, body, legL, legR, gun };
}

export function spawnEnemy(G, x, z, missionTag) {
  const THREE = window.THREE;
  const parts = makeViperMesh(THREE, x, z);
  G.scene.add(parts.group);
  const enemy = {
    ...parts,
    pos: parts.group.position,
    health: ENEMY_HEALTH,
    missionTag: missionTag ?? null,
    shootCooldown: 1 + Math.random(),
    walkPhase: Math.random() * 6,
    dead: false,
    deadTimer: 0,
  };
  G.enemies.push(enemy);
  return enemy;
}

export function livingEnemies(G) {
  return G.enemies.filter((e) => !e.dead);
}

function addTracer(G, from, to) {
  const THREE = window.THREE;
  const geo = new THREE.BufferGeometry().setFromPoints([from.clone(), to.clone()]);
  const line = new THREE.Line(geo, G.tracerMat);
  G.scene.add(line);
  G.tracers.push({ line, life: 0.09 });
}

function muzzlePoint(G) {
  const p = G.player;
  const fwd = new THREE.Vector3(Math.sin(p.yaw), 0, Math.cos(p.yaw));
  return new THREE.Vector3(p.pos.x + fwd.x * 0.8, 1.35, p.pos.z + fwd.z * 0.8);
}

export function playerAttack(G) {
  const p = G.player;
  if (G.state !== 'playing' || p.inCar || p.health <= 0) return;
  const THREE = window.THREE;
  if (p.weapon === 'fists') {
    if (p.punchCooldown > 0) return;
    p.punchCooldown = 0.4;
    if (G.audio) G.audio.punch();
    // Punch the nearest living enemy (or officer) in front, within reach.
    const targets = [...livingEnemies(G), ...G.officers];
    let best = null;
    let bestD = PUNCH_RANGE;
    for (const t of targets) {
      const dx = t.pos.x - p.pos.x;
      const dz = t.pos.z - p.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > bestD) continue;
      const facing = dx * Math.sin(p.yaw) + dz * Math.cos(p.yaw);
      if (facing < 0) continue;
      bestD = d;
      best = t;
    }
    if (best) {
      if (best.health !== undefined) {
        damageEnemy(G, best, PUNCH_DAMAGE);
      } else {
        // An officer: a punch drives them back and drops a star's worth of heat.
        best.pos.x += Math.sin(p.yaw) * 2;
        best.pos.z += Math.cos(p.yaw) * 2;
      }
    }
    return;
  }
  // Pistol.
  if (p.weapon !== 'pistol' || !p.hasPistol) return;
  if (p.shootCooldown > 0) return;
  p.shootCooldown = 0.25;
  if (G.audio) G.audio.shot();
  scatterPeds(G, p.pos.x, p.pos.z, 25);
  // Aim from Marlo's shoulder along his facing: the crosshair sits on what he faces.
  const origin = new THREE.Vector3(p.pos.x, 1.35, p.pos.z);
  const dir = new THREE.Vector3(Math.sin(p.yaw), 0, Math.cos(p.yaw));
  G.raycaster.set(origin, dir);
  G.raycaster.far = PISTOL_RANGE;
  const meshes = [];
  for (const e of livingEnemies(G)) meshes.push(e.body);
  const hits = G.raycaster.intersectObjects(meshes, false);
  let end;
  if (hits.length > 0) {
    const hit = hits[0];
    end = hit.point.clone();
    const enemy = livingEnemies(G).find((e) => e.body === hit.object);
    if (enemy) damageEnemy(G, enemy, PISTOL_DAMAGE);
  } else {
    end = origin.clone().add(dir.multiplyScalar(PISTOL_RANGE));
  }
  addTracer(G, muzzlePoint(G), end);
}

export function damageEnemy(G, enemy, amount) {
  if (enemy.dead) return;
  enemy.health -= amount;
  if (enemy.health <= 0) {
    enemy.dead = true;
    enemy.deadTimer = 1.2;
    enemy.group.rotation.x = -Math.PI / 2;
    if (G.onEnemyKilled) G.onEnemyKilled(enemy);
  }
}

export function updateEnemies(G, dt) {
  const THREE = window.THREE;
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
    const dist = Math.hypot(dx, dz);
    e.shootCooldown -= dt;
    if (dist < 45 && p.health > 0 && G.state === 'playing') {
      // Advance to shooting range, then stand and fire with poor aim.
      if (dist > 15) {
        const step = 5.5 * dt;
        e.pos.x += (dx / dist) * step;
        e.pos.z += (dz / dist) * step;
        e.walkPhase += dt * 9;
        const swing = Math.sin(e.walkPhase) * 0.5;
        e.legL.rotation.x = swing;
        e.legR.rotation.x = -swing;
      }
      e.group.rotation.y = Math.atan2(dx, dz);
      if (dist < 40 && e.shootCooldown <= 0) {
        e.shootCooldown = 1.1 + Math.random() * 0.7;
        if (G.audio) G.audio.enemyShot();
        const from = new THREE.Vector3(e.pos.x, 1.4, e.pos.z);
        const to = new THREE.Vector3(p.pos.x, 1.3, p.pos.z);
        addTracer(G, from, to);
        // Poor aim: roughly one shot in four lands.
        if (Math.random() < 0.25) {
          damagePlayer(G, 6, 'shot by a Viper');
        }
      }
    }
  }
  // Fade tracers out.
  for (const t of G.tracers) {
    t.life -= dt;
    if (t.life <= 0) {
      G.scene.remove(t.line);
      t.line.geometry.dispose();
    }
  }
  G.tracers = G.tracers.filter((t) => t.life > 0);
}
