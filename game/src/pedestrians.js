// pedestrians.js — sidewalk walkers for Solara Bay.
// Peds stroll the sidewalks on the road grid, turn at intersections, and
// scatter away from explosions. They are scenery: they never block the
// player and never affect a mission.

import { mulberry32, headingTo, dist2d, clamp } from './util.js';

const PED_COUNT = 16;
const WALK_SPEED = 1.6;
const RUN_SPEED = 5.5;

export function createPedestrians(world) {
  const THREE = window.THREE;
  const rng = mulberry32(424242);
  const peds = [];

  const shirtColors = [0xd8d8d8, 0x3a6fd8, 0xd83a3a, 0x3ad86a, 0xd8b23a, 0x8a3ad8];
  const skinMat = new THREE.MeshLambertMaterial({ color: 0xc9986a });

  function makePed(x, z) {
    const g = new THREE.Group();
    const shirt = new THREE.MeshLambertMaterial({
      color: shirtColors[Math.floor(rng() * shirtColors.length)],
    });
    const pants = new THREE.MeshLambertMaterial({ color: 0x333a44 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.85, 0.3), shirt);
    body.position.y = 1.0;
    g.add(body);
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.7, 0.28), pants);
    legs.position.y = 0.35;
    g.add(legs);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.32), skinMat);
    head.position.y = 1.6;
    g.add(head);
    g.position.set(x, 0, z);
    world.scene.add(g);
    return {
      mesh: g,
      x,
      z,
      heading: rng() * Math.PI * 2,
      speed: WALK_SPEED,
      scatter: 0,
      scatterX: 0,
      scatterZ: 0,
      nextTurn: 2 + rng() * 6,
    };
  }

  // Sidewalk spots: just off a road line, inside the city.
  for (let i = 0; i < PED_COUNT; i++) {
    const road = [-90, -30, 0, 30, 90][i % 5];
    const along = -140 + rng() * 280;
    const side = rng() > 0.5 ? 1 : -1;
    if (i % 2 === 0) peds.push(makePed(road + side * 8, along));
    else peds.push(makePed(along, road + side * 8));
  }

  function scatter(x, z, radius) {
    for (const p of peds) {
      const d = dist2d(p.x, p.z, x, z);
      if (d < radius) {
        p.scatter = 3 + Math.random() * 2;
        p.scatterX = x;
        p.scatterZ = z;
      }
    }
  }

  function update(dt) {
    for (const p of peds) {
      p.nextTurn -= dt;
      if (p.scatter > 0) {
        p.scatter -= dt;
        p.speed = RUN_SPEED;
        p.heading = headingTo(p.scatterX, p.scatterZ, p.x, p.z);
      } else {
        p.speed = WALK_SPEED;
        if (p.nextTurn <= 0) {
          p.nextTurn = 3 + Math.random() * 7;
          // Turn onto the crossing street (90-degree turns only).
          p.heading += (Math.random() > 0.5 ? 1 : -1) * (Math.PI / 2);
        }
      }
      let nx = p.x + Math.sin(p.heading) * p.speed * dt;
      let nz = p.z + Math.cos(p.heading) * p.speed * dt;
      nx = clamp(nx, -148, 148);
      nz = clamp(nz, -148, 148);
      p.x = nx;
      p.z = nz;
      p.mesh.position.set(p.x, 0, p.z);
      p.mesh.rotation.y = p.heading;
    }
  }

  world.peds = peds;
  world.pedestrians = { peds, update, scatter };
  return world.pedestrians;
}
