// combat.js — the pistol: raycast shooting, drive-by, and the Viper
// enemies (M3 ambush, M4 showdown, M6 guards).
import * as THREE from 'three';
import { rayBuildings } from './city.js';
import { playShot } from './audio.js';
import { damageCarObj } from './vehicles.js';
import { clamp, dist2 } from './util.js';

export const PISTOL_DAMAGE = 15;
export const PISTOL_RANGE = 70;
const PISTOL_COOLDOWN = 0.25;

export function makeViperMesh() {
  const g = new THREE.Group();
  const suit = new THREE.MeshLambertMaterial({ color: 0x1a1a22 });
  const skin = new THREE.MeshLambertMaterial({ color: 0xd9a066 });
  const tie = new THREE.MeshLambertMaterial({ color: 0xc0392b });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.34), suit);
  torso.position.y = 1.05;
  torso.name = 'torso';
  g.add(torso);
  const tieMesh = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.5, 0.05), tie);
  tieMesh.position.set(0, 1.08, 0.19);
  g.add(tieMesh);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), skin);
  head.position.y = 1.62;
  head.name = 'head';
  g.add(head);
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.5), suit);
  gun.position.set(0.3, 1.15, 0.3);
  gun.name = 'gun';
  g.add(gun);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.65, 0.22), suit);
  legL.position.set(-0.14, 0.33, 0);
  legL.name = 'legL';
  g.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.65, 0.22), suit);
  legR.position.set(0.14, 0.33, 0);
  legR.name = 'legR';
  g.add(legR);
  return g;
}

export function spawnViper(G, x, z, kind) {
  const mesh = makeViperMesh();
  mesh.position.set(x, 0, z);
  G.scene.add(mesh);
  const enemy = {
    mesh,
    x,
    z,
    heading: 0,
    health: 45,
    kind: kind || 'viper',
    shootTimer: 1 + G.rng() * 1.5,
    strafeDir: G.rng() < 0.5 ? -1 : 1,
    strafeTimer: 0,
    dead: false,
    walkPhase: G.rng() * 6,
  };
  G.enemies.push(enemy);
  return enemy;
}

export function enemiesAlive(G) {
  let n = 0;
  for (const e of G.enemies) if (!e.dead) n++;
  return n;
}

export function nearestEnemy(G, x, z) {
  let best = null;
  let bestD = Infinity;
  for (const e of G.enemies) {
    if (e.dead) continue;
    const d = dist2(x, z, e.x, e.z);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return { enemy: best, dist: bestD };
}

// Ray vs a vertical cylinder (cars, enemies): returns hit distance or Infinity.
function rayCylinder(ox, oy, oz, dx, dy, dz, cx, cz, radius, y0, y1) {
  // Solve in the x/z plane for the cylinder wall.
  const a = dx * dx + dz * dz;
  if (a < 1e-12) return Infinity;
  const oxc = ox - cx;
  const ozc = oz - cz;
  const b = 2 * (oxc * dx + ozc * dz);
  const c = oxc * oxc + ozc * ozc - radius * radius;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return Infinity;
  const sq = Math.sqrt(disc);
  let t = (-b - sq) / (2 * a);
  if (t < 0) t = (-b + sq) / (2 * a);
  if (t < 0) return Infinity;
  const y = oy + dy * t;
  if (y < y0 || y > y1) return Infinity;
  return t;
}

// Cast the pistol ray. Returns {kind, target, dist} or null (blocked / miss).
export function raycastShot(G, ox, oy, oz, dx, dy, dz) {
  let best = Infinity;
  let hit = null;
  const buildingDist = rayBuildings(G, ox, oy, oz, dx, dy, dz, PISTOL_RANGE);
  // Enemies (generous cylinder: the shot is forgiving at range).
  for (const e of G.enemies) {
    if (e.dead) continue;
    const t = rayCylinder(ox, oy, oz, dx, dy, dz, e.x, e.z, 1.5, 0, 1.9);
    if (t < best && t <= PISTOL_RANGE) {
      best = t;
      hit = { kind: 'enemy', target: e, dist: t };
    }
  }
  // Parked cars (skip the player's own car) and any other car.
  for (const car of G.cars) {
    if (car.wrecked || car === G.player.car) continue;
    const t = rayCylinder(ox, oy, oz, dx, dy, dz, car.x, car.z, 1.7, 0, 1.6);
    if (t < best && t <= PISTOL_RANGE) {
      best = t;
      hit = { kind: 'car', target: car, dist: t };
    }
  }
  if (buildingDist < best) return { kind: 'blocked', dist: buildingDist };
  return hit;
}

export function firePistol(G) {
  const p = G.player;
  if (!p.hasPistol || G.state !== 'playing') return false;
  if (G.pistolCooldown > 0) return false;
  G.pistolCooldown = PISTOL_COOLDOWN;
  playShot(G);
  // Muzzle flash: a brief bright sprite at the gun.
  G.muzzleTimer = 0.06;
  // Ray from the camera through its aim point.
  const cam = G.camera;
  const origin = cam.position.clone();
  const dir = new THREE.Vector3();
  cam.getWorldDirection(dir);
  const hit = raycastShot(G, origin.x, origin.y, origin.z, dir.x, dir.y, dir.z);
  if (!hit) return true;
  if (hit.kind === 'enemy') {
    const e = hit.target;
    e.health -= PISTOL_DAMAGE;
    if (e.health <= 0 && !e.dead) {
      e.dead = true;
      e.mesh.rotation.x = -Math.PI / 2;
      e.mesh.position.y = 0.25;
      // Remove the corpse from the scene shortly after.
      e.removeAt = G.elapsed + 4;
    }
  } else if (hit.kind === 'car') {
    damageCarObj(G, hit.target, PISTOL_DAMAGE);
  }
  return true;
}

// Viper behaviour: hold ~15 m, strafe, back off when Marlo closes in,
// and shoot back (slowly — a threat, not a shredder).
export function updateEnemies(G, dt) {
  const p = G.player;
  for (const e of G.enemies) {
    if (e.dead) continue;
    const dx = p.x - e.x;
    const dz = p.z - e.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    // Face the player.
    e.heading = Math.atan2(dx, dz);
    e.mesh.rotation.y = e.heading;
    if (e.kind === 'guard') {
      // M6 guards stand their ground.
      e.mesh.position.set(e.x, 0, e.z);
      continue;
    }
    // Strafe sideways, backing off when Marlo closes in.
    e.strafeTimer -= dt;
    if (e.strafeTimer <= 0) {
      e.strafeTimer = 1.5 + G.rng() * 1.5;
      e.strafeDir = G.rng() < 0.5 ? -1 : 1;
    }
    let mx = 0;
    let mz = 0;
    const px = dx / (d || 1);
    const pz = dz / (d || 1);
    if (d < 11) {
      mx = -px * 2.2;
      mz = -pz * 2.2;
    } else if (d > 20) {
      mx = px * 2.4;
      mz = pz * 2.4;
    }
    // Perpendicular strafe.
    mx += -pz * e.strafeDir * 1.6;
    mz += px * e.strafeDir * 1.6;
    e.x = clamp(e.x + mx * dt, -170, 170);
    e.z = clamp(e.z + mz * dt, -170, 170);
    e.mesh.position.set(e.x, 0, e.z);
    // Walk cycle.
    e.walkPhase += dt * 4;
    const swing = Math.sin(e.walkPhase) * 0.35;
    const legL = e.mesh.getObjectByName('legL');
    const legR = e.mesh.getObjectByName('legR');
    if (legL) legL.rotation.x = swing;
    if (legR) legR.rotation.x = -swing;
    // Shoot back: one round every ~2 s, 4 damage, inside 40 m.
    e.shootTimer -= dt;
    if (e.shootTimer <= 0 && d < 40) {
      e.shootTimer = 1.8 + G.rng() * 0.7;
      p.health = Math.max(0, p.health - 4);
      if (p.health <= 0) G.state = 'busted';
    }
  }
  // Sweep dead enemies out of the scene after a few seconds.
  for (let i = G.enemies.length - 1; i >= 0; i--) {
    const e = G.enemies[i];
    if (e.dead && e.removeAt !== undefined && G.elapsed >= e.removeAt) {
      G.scene.remove(e.mesh);
      G.enemies.splice(i, 1);
    }
  }
}
