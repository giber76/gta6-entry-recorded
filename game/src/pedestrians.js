// pedestrians.js — sidewalk walkers for Solara Bay.
// Peds stroll the sidewalks on a loop, bob as they walk, and scatter away
// from explosions. Vipers are armed peds with their own (combat) behaviour.
import * as THREE from 'three';
import { mulberry32, range, pick, dist2 } from './util.js';

const SHIRTS = [0xe76f51, 0x2a9d8f, 0xe9c46a, 0x9b5de5, 0xf15bb5, 0x00b4d8, 0x90be6d, 0xf9844a];
const PANTS = [0x2b2d42, 0x3a3a3a, 0x5a4a3a, 0x1f3a5f];

function makePedMesh(shirt, pants, scale = 1) {
  const g = new THREE.Group();
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.55, 3, 8), new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.8 }));
  torso.position.y = 1.05 * scale;
  torso.scale.setScalar(scale);
  g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21 * scale, 10, 8), new THREE.MeshStandardMaterial({ color: 0xd9a066, roughness: 0.7 }));
  head.position.y = 1.62 * scale;
  g.add(head);
  const sh = new THREE.Mesh(new THREE.CircleGeometry(0.42 * scale, 12), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false }));
  sh.rotation.x = -Math.PI / 2;
  sh.position.y = 0.02;
  g.add(sh);
  return g;
}

export class Pedestrians {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.rng = mulberry32(777);
    this.peds = [];
    for (let i = 0; i < 12; i++) this._spawn();
  }

  _spawn() {
    const rng = this.rng;
    // pick a road and walk along its sidewalk
    const road = pick(rng, [-120, -80, -40, 0, 40, 80, 120]);
    const along = range(rng, -150, 150);
    const side = rng() < 0.5 ? 1 : -1;
    const vertical = rng() < 0.5;
    const x = vertical ? road + side * 8.2 : along;
    const z = vertical ? along : road + side * 8.2;
    const mesh = makePedMesh(pick(rng, SHIRTS), pick(rng, PANTS), range(rng, 0.9, 1.08));
    mesh.position.set(x, 0, z);
    this.scene.add(mesh);
    this.peds.push({
      mesh, x, z,
      heading: vertical ? (side > 0 ? Math.PI : 0) : (side > 0 ? -Math.PI / 2 : Math.PI / 2),
      speed: range(rng, 1.1, 1.9),
      vertical, road, side,
      phase: rng() * 10,
      scatter: 0,
    });
  }

  scatterFrom(x, z, radius) {
    for (const p of this.peds) {
      if (dist2(p.x, p.z, x, z) < radius) {
        p.scatter = 2.5;
        const dx = p.x - x;
        const dz = p.z - z;
        const d = Math.hypot(dx, dz) || 1;
        p.heading = Math.atan2(dx / d, dz / d);
      }
    }
  }

  update(dt) {
    for (const p of this.peds) {
      const sp = p.scatter > 0 ? 4.5 : p.speed;
      if (p.scatter > 0) p.scatter -= dt;
      const fx = Math.sin(p.heading);
      const fz = Math.cos(p.heading);
      p.x += fx * sp * dt;
      p.z += fz * sp * dt;
      // stay inside the city; bounce at the edge
      if (Math.abs(p.x) > 165 || Math.abs(p.z) > 165) {
        p.heading += Math.PI;
        p.x = Math.max(-165, Math.min(165, p.x));
        p.z = Math.max(-165, Math.min(165, p.z));
      }
      // keep on sidewalks: if they drift onto a road centre, nudge back
      p.phase += dt * 6;
      p.mesh.position.set(p.x, Math.abs(Math.sin(p.phase)) * 0.05, p.z);
      p.mesh.rotation.y = p.heading;
    }
  }
}
