// pedestrians.js — the people of Solara Bay.
// Peds stroll the sidewalks on fixed loops and scatter when something
// explodes nearby.
import * as THREE from 'three';
import { ROADS } from './city.js';
import { dist2, headingTo, range } from './util.js';

const SHIRTS = [0xd86a6a, 0x6a8ad8, 0x6ad88a, 0xd8c86a, 0xb06ad8, 0x6ad8c8];

export class Peds {
  constructor(scene, rng) {
    this.scene = scene;
    this.list = [];
    for (let i = 0; i < 14; i++) {
      const road = ROADS[Math.floor(rng() * ROADS.length)];
      const along = range(rng, -160, 160);
      const side = rng() < 0.5 ? -6.5 : 6.5;
      const horizontal = rng() < 0.5;
      const x = horizontal ? along : road + side;
      const z = horizontal ? road + side : along;
      const mesh = this.makePed(SHIRTS[i % SHIRTS.length]);
      mesh.position.set(x, 0, z);
      scene.add(mesh);
      this.list.push({
        mesh,
        x,
        z,
        heading: rng() * Math.PI * 2,
        speed: range(rng, 1.2, 2.0),
        horizontal,
        road,
        side,
        scatterTimer: 0,
        scatterX: 0,
        scatterZ: 0,
        phase: rng() * 6,
      });
    }
  }

  makePed(shirt) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.26, 0.32, 0.95, 8),
      new THREE.MeshLambertMaterial({ color: shirt })
    );
    body.position.y = 0.95;
    g.add(body);
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 8, 6),
      new THREE.MeshLambertMaterial({ color: 0xc89878 })
    );
    head.position.y = 1.62;
    g.add(head);
    const legMat = new THREE.MeshLambertMaterial({ color: 0x2a2a33 });
    for (const x of [-0.12, 0.12]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.8, 6), legMat);
      leg.position.set(x, 0.4, 0);
      g.add(leg);
    }
    return g;
  }

  scatter(x, z, radius) {
    for (const p of this.list) {
      if (dist2(p.x, p.z, x, z) < radius) {
        p.scatterTimer = 2.5;
        const away = headingTo(x, z, p.x, p.z);
        p.scatterX = Math.sin(away);
        p.scatterZ = Math.cos(away);
      }
    }
  }

  update(dt, game) {
    for (const p of this.list) {
      let vx;
      let vz;
      if (p.scatterTimer > 0) {
        p.scatterTimer -= dt;
        vx = p.scatterX * 4.5;
        vz = p.scatterZ * 4.5;
      } else {
        // Stroll along the sidewalk, turning around at the city edge.
        if (p.horizontal) {
          vx = Math.sin(p.heading) * p.speed;
          vz = 0;
          if (p.x > 175) p.heading = -Math.PI / 2;
          if (p.x < -175) p.heading = Math.PI / 2;
        } else {
          vx = 0;
          vz = Math.cos(p.heading) * p.speed;
          if (p.z > 175) p.heading = Math.PI;
          if (p.z < -175) p.heading = 0;
        }
      }
      p.x += vx * dt;
      p.z += vz * dt;
      p.x = Math.max(-178, Math.min(178, p.x));
      p.z = Math.max(-178, Math.min(178, p.z));
      const moving = Math.abs(vx) + Math.abs(vz) > 0.1;
      if (moving) {
        p.heading = Math.atan2(vx, vz);
        p.phase += dt * 8;
      }
      p.mesh.position.set(p.x, moving ? Math.abs(Math.sin(p.phase)) * 0.05 : 0, p.z);
      p.mesh.rotation.y = p.heading;
    }
  }
}
