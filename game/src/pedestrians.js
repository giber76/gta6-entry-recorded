// pedestrians.js — people walking the sidewalks. They keep to the
// sidewalks (|coord| <= 150), sidestep the player, and scatter when
// something explodes nearby.
import * as THREE from 'three';
import { randRange, clamp } from './util.js';

const SHIRT_COLORS = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf39c12, 0x9b59b6, 0x1abc9c, 0xe67e22, 0xecf0f1];

export function initPeds(G) {
  G.peds = [];
  const group = new THREE.Group();
  G.scene.add(group);
  for (let i = 0; i < 14; i++) {
    const color = SHIRT_COLORS[i % SHIRT_COLORS.length];
    const ped = makePedMesh(color);
    const x = randRange(G.rng, -140, 140);
    const z = randRange(G.rng, -140, 140);
    ped.position.set(x, 0, z);
    group.add(ped);
    G.peds.push({
      mesh: ped,
      x,
      z,
      heading: randRange(G.rng, 0, Math.PI * 2),
      speed: randRange(G.rng, 1.2, 2.2),
      scatterTimer: 0,
      walkPhase: randRange(G.rng, 0, Math.PI * 2),
    });
  }
}

function makePedMesh(color) {
  const g = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color });
  const skin = new THREE.MeshLambertMaterial({ color: 0xd9a066 });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2c3e50 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.75, 0.32), shirt);
  torso.position.y = 1.05;
  torso.name = 'torso';
  g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), skin);
  head.position.y = 1.62;
  head.name = 'head';
  g.add(head);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.65, 0.22), pants);
  legL.position.set(-0.14, 0.33, 0);
  legL.name = 'legL';
  g.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.65, 0.22), pants);
  legR.position.set(0.14, 0.33, 0);
  legR.name = 'legR';
  g.add(legR);
  return g;
}

export function scatterPeds(G, x, z, r) {
  for (const p of G.peds) {
    const dx = p.x - x;
    const dz = p.z - z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < r) {
      p.scatterTimer = 2.5;
      p.heading = Math.atan2(dx, dz);
      p.speed = 4.5;
    }
  }
}

export function updatePeds(G, dt) {
  for (const p of G.peds) {
    if (p.scatterTimer > 0) {
      p.scatterTimer -= dt;
      if (p.scatterTimer <= 0) p.speed = randRange(G.rng, 1.2, 2.2);
    }
    // Walk forward; turn at the sidewalk edge (|coord| 150) or at random.
    const nx = p.x + Math.sin(p.heading) * p.speed * dt;
    const nz = p.z + Math.cos(p.heading) * p.speed * dt;
    if (Math.abs(nx) > 148 || Math.abs(nz) > 148) {
      p.heading += Math.PI / 2 + G.rng() * 0.6;
    } else {
      p.x = nx;
      p.z = nz;
      if (G.rng() < dt * 0.08) p.heading += (G.rng() - 0.5) * 1.2;
    }
    // Sidestep the player: don't walk into Marlo.
    const pdx = p.x - G.player.x;
    const pdz = p.z - G.player.z;
    const pd = Math.sqrt(pdx * pdx + pdz * pdz);
    if (pd < 2.2 && pd > 0.01) {
      p.x += (pdx / pd) * 2.4 * dt;
      p.z += (pdz / pd) * 2.4 * dt;
    }
    p.x = clamp(p.x, -149, 149);
    p.z = clamp(p.z, -149, 149);
    p.mesh.position.set(p.x, 0, p.z);
    p.mesh.rotation.y = p.heading;
    // Walk cycle: swing the legs.
    p.walkPhase += dt * p.speed * 3.2;
    const swing = Math.sin(p.walkPhase) * 0.45;
    const legL = p.mesh.getObjectByName('legL');
    const legR = p.mesh.getObjectByName('legR');
    if (legL) legL.rotation.x = swing;
    if (legR) legR.rotation.x = -swing;
  }
}
