// pedestrians.js — people walking the sidewalks. They stroll the road
// grid, keep to the pavements, and scatter when something explodes near
// them. One shared box per person keeps the draw calls tiny.
import * as THREE from 'three';
import { ROADS, collideCircle } from './city.js';
import { makeRng, clamp } from './util.js';

const bodyGeo = new THREE.BoxGeometry(0.5, 1.05, 0.32);
const headGeo = new THREE.BoxGeometry(0.34, 0.36, 0.32);
const legGeo = new THREE.BoxGeometry(0.18, 0.6, 0.2);

export class Pedestrians {
  constructor(scene, colliders, count = 22) {
    this.scene = scene;
    this.colliders = colliders;
    this.rng = makeRng(31337);
    this.peds = [];
    const shirts = [0xc25a4a, 0x4a7a9a, 0x9a8a3a, 0x6a4a8a, 0xd8d8d8, 0x3a9a5a];
    const pants = [0x2a2f38, 0x4a3a2a, 0x3a4a5a];
    for (let i = 0; i < count; i++) {
      const g = new THREE.Group();
      const shirt = new THREE.MeshLambertMaterial({ color: shirts[i % shirts.length] });
      const body = new THREE.Mesh(bodyGeo, shirt);
      body.position.y = 1.0;
      g.add(body);
      const head = new THREE.Mesh(headGeo, new THREE.MeshLambertMaterial({ color: 0xc98a5a }));
      head.position.y = 1.72;
      g.add(head);
      const legMat = new THREE.MeshLambertMaterial({ color: pants[i % pants.length] });
      const legL = new THREE.Mesh(legGeo, legMat);
      legL.position.set(-0.13, 0.3, 0);
      g.add(legL);
      const legR = legL.clone();
      legR.position.x = 0.13;
      g.add(legR);
      // Sidewalk spot: just off a road.
      const road = ROADS[this.rng.int(0, ROADS.length - 1)];
      const along = this.rng.range(-150, 150);
      const vertical = this.rng.chance(0.5);
      const x = vertical ? road + (this.rng.chance(0.5) ? 6.5 : -6.5) : along;
      const z = vertical ? along : road + (this.rng.chance(0.5) ? 6.5 : -6.5);
      g.position.set(x, 0, z);
      scene.add(g);
      this.peds.push({
        mesh: g,
        x,
        z,
        heading: this.rng.range(0, Math.PI * 2),
        speed: this.rng.range(1.1, 2.1),
        target: null,
        scatter: 0,
        phase: this.rng.range(0, Math.PI * 2),
        legL,
        legR,
      });
    }
  }

  scatterAt(x, z, radius = 18) {
    for (const p of this.peds) {
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < radius) {
        p.scatter = 3;
        // Run directly away.
        p.heading = Math.atan2(p.x - x, p.z - z);
      }
    }
  }

  update(dt, playerX, playerZ) {
    for (const p of this.peds) {
      // Pick a new sidewalk waypoint when idle.
      if (!p.target) {
        const road = ROADS[this.rng.int(0, ROADS.length - 1)];
        const along = this.rng.range(-150, 150);
        const vertical = this.rng.chance(0.5);
        p.target = {
          x: vertical ? road + (this.rng.chance(0.5) ? 6.5 : -6.5) : along,
          z: vertical ? along : road + (this.rng.chance(0.5) ? 6.5 : -6.5),
        };
      }
      const speed = p.scatter > 0 ? 5.5 : p.speed;
      if (p.scatter > 0) p.scatter -= dt;
      else {
        const dx = p.target.x - p.x;
        const dz = p.target.z - p.z;
        const d = Math.hypot(dx, dz);
        if (d < 1.5) {
          p.target = null;
          continue;
        }
        p.heading = Math.atan2(dx, dz);
      }
      const nx = p.x + Math.sin(p.heading) * speed * dt;
      const nz = p.z + Math.cos(p.heading) * speed * dt;
      const fixed = collideCircle(nx, nz, 0.5, this.colliders);
      p.x = fixed ? fixed.x : clamp(nx, -175, 180);
      p.z = fixed ? fixed.z : clamp(nz, -175, 180);
      // Gentle avoidance of the player on foot.
      const pd = Math.hypot(p.x - playerX, p.z - playerZ);
      if (pd < 1.6 && pd > 0.01) {
        p.x += ((p.x - playerX) / pd) * 1.6 * dt;
        p.z += ((p.z - playerZ) / pd) * 1.6 * dt;
      }
      p.phase += dt * (p.scatter > 0 ? 14 : 7);
      const swing = Math.sin(p.phase) * 0.5;
      p.legL.rotation.x = swing;
      p.legR.rotation.x = -swing;
      p.mesh.position.set(p.x, 0, p.z);
      p.mesh.rotation.y = p.heading;
    }
  }
}
