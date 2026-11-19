// city.js — Solara Bay: a seeded road grid, buildings, beach, ocean, plaza and palms.
// Every layout decision comes from one seeded RNG, so the city is identical on every load.

import { makeRng, makeFacadeTexture, makeRoadTexture, clamp } from './util.js';

export const ROADS = [-120, -80, -40, 0, 40, 80, 120];
export const BLOCKS = [-100, -60, -20, 20, 60, 100];
export const CITY_BOUND = 168;

// Named places the missions use. All sit on roads or open ground, never inside a building.
export const LOCATIONS = {
  plaza: { x: 20, z: 20, name: 'Solara Plaza' },
  coupe: { x: 27, z: 26, heading: -Math.PI / 2, name: 'Orange coupe' },
  garage: { x: -120, z: 116, name: "Rico's Garage" },
  pier: { x: 162, z: -40, name: 'Boardwalk Pier' },
  coral: { x: 80, z: 120, name: 'Coral Junction' },
  marina: { x: 120, z: 40, name: 'Marina East' },
  bank: { x: -40, z: -80, name: 'Meridian Bank' },
  safehouse: { x: 140, z: 80, name: 'Boardwalk Safehouse' },
  start: { x: 12, z: 30, name: 'Plaza steps' },
};

export function initCity(G) {
  const THREE = window.THREE;
  const rng = makeRng(20261117);
  const scene = G.scene;
  const colliders = [];

  scene.background = new THREE.Color(0x87b5d6);
  scene.fog = new THREE.Fog(0x9fc3dd, 180, 420);

  const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x5a5a48, 0.95);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2d0, 1.6);
  sun.position.set(120, 180, 60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -190;
  sun.shadow.camera.right = 190;
  sun.shadow.camera.top = 190;
  sun.shadow.camera.bottom = -190;
  sun.shadow.camera.far = 520;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.6;
  scene.add(sun);
  G.sun = sun;

  // Ground base: dry grass / dirt the whole city sits on.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(460, 460),
    new THREE.MeshLambertMaterial({ color: 0x6f7a58 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Ocean to the east, sand between the city and the water.
  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(280, 460),
    new THREE.MeshLambertMaterial({ color: 0x1e6f9e })
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(300, 0.06, 0);
  ocean.receiveShadow = true;
  scene.add(ocean);
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(22, 340),
    new THREE.MeshLambertMaterial({ color: 0xd9c08a })
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(151, 0.08, 0);
  sand.receiveShadow = true;
  scene.add(sand);
  // Boardwalk strip along the sand.
  const boardwalk = new THREE.Mesh(
    new THREE.PlaneGeometry(8, 300),
    new THREE.MeshLambertMaterial({ color: 0x8a6b4a })
  );
  boardwalk.rotation.x = -Math.PI / 2;
  boardwalk.position.set(138, 0.1, 0);
  boardwalk.receiveShadow = true;
  scene.add(boardwalk);

  // Roads: dark strips with dashed centre lines, one along each grid line.
  const roadTex = makeRoadTexture(THREE);
  roadTex.wrapS = THREE.RepeatWrapping;
  roadTex.wrapT = THREE.RepeatWrapping;
  roadTex.repeat.set(1, 12);
  const roadMat = new THREE.MeshLambertMaterial({ map: roadTex });
  for (const r of ROADS) {
    const alongX = new THREE.Mesh(new THREE.PlaneGeometry(344, 10), roadMat);
    alongX.rotation.x = -Math.PI / 2;
    alongX.position.set(0, 0.12, r);
    alongX.receiveShadow = true;
    scene.add(alongX);
    const alongZ = new THREE.Mesh(new THREE.PlaneGeometry(10, 344), roadMat.clone());
    alongZ.material.map = roadTex.clone();
    alongZ.material.map.needsUpdate = true;
    alongZ.rotation.x = -Math.PI / 2;
    alongZ.rotation.z = Math.PI / 2;
    alongZ.position.set(r, 0.12, 0);
    alongZ.receiveShadow = true;
    scene.add(alongZ);
  }

  // Plaza: a paved square in the block at (20, 20), with a fountain ring.
  const plaza = new THREE.Mesh(
    new THREE.PlaneGeometry(34, 34),
    new THREE.MeshLambertMaterial({ color: 0xcbb98f })
  );
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.set(20, 0.14, 20);
  plaza.receiveShadow = true;
  scene.add(plaza);
  const fountain = new THREE.Mesh(
    new THREE.CylinderGeometry(4, 4.6, 1.1, 20),
    new THREE.MeshLambertMaterial({ color: 0x7fb2d9 })
  );
  fountain.position.set(14, 0.55, 14);
  fountain.castShadow = true;
  scene.add(fountain);

  // Pier: wooden deck reaching into the ocean at z = -40.
  const pier = new THREE.Mesh(
    new THREE.BoxGeometry(30, 0.8, 8),
    new THREE.MeshLambertMaterial({ color: 0x7a5c38 })
  );
  pier.position.set(164, 0.4, -40);
  pier.castShadow = true;
  pier.receiveShadow = true;
  scene.add(pier);

  // Buildings: one per block (the plaza block stays open), seeded heights and colours.
  const palette = ['#c9a37e', '#b7c4cc', '#d8c9a3', '#a8b8a0', '#c4a0a0', '#9fb3c8', '#d0b48a', '#b0a8c0'];
  const facadeCols = [4, 5, 6];
  for (const bx of BLOCKS) {
    for (const bz of BLOCKS) {
      if (bx === 20 && bz === 20) continue; // plaza
      // Block slabs: raised sidewalk squares the buildings sit on.
      const slab = new THREE.Mesh(
        new THREE.BoxGeometry(36, 0.3, 36),
        new THREE.MeshLambertMaterial({ color: 0x9a9a92 })
      );
      slab.position.set(bx, 0.15, bz);
      slab.receiveShadow = true;
      scene.add(slab);
      const w = rng.range(20, 27);
      const d = rng.range(20, 27);
      const h = rng.pick([10, 13, 16, 20, 24, 30, 38, 46]);
      const jx = bx + rng.range(-3, 3);
      const jz = bz + rng.range(-3, 3);
      const floors = Math.max(2, Math.round(h / 4));
      const tex = makeFacadeTexture(THREE, rng, rng.pick(palette), floors, rng.pick(facadeCols));
      const mat = new THREE.MeshLambertMaterial({ map: tex });
      const topMat = new THREE.MeshLambertMaterial({ color: 0x3c4148 });
      const building = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [mat, mat, topMat, topMat, mat, mat]);
      building.position.set(jx, 0.3 + h / 2, jz);
      building.castShadow = true;
      building.receiveShadow = true;
      scene.add(building);
      colliders.push({ minX: jx - w / 2, maxX: jx + w / 2, minZ: jz - d / 2, maxZ: jz + d / 2 });
    }
  }

  // Two landmark towers so the skyline reads from anywhere.
  const towerSpots = [
    { x: -100, z: -100, h: 58, color: '#8fb0cc' },
    { x: 60, z: -60, h: 50, color: '#c9a37e' },
  ];
  for (const t of towerSpots) {
    const tex = makeFacadeTexture(THREE, rng, t.color, 14, 6);
    const tower = new THREE.Mesh(
      new THREE.BoxGeometry(24, t.h, 24),
      new THREE.MeshLambertMaterial({ map: tex })
    );
    tower.position.set(t.x, 0.3 + t.h / 2, t.z);
    tower.castShadow = true;
    scene.add(tower);
    colliders.push({ minX: t.x - 12, maxX: t.x + 12, minZ: t.z - 12, maxZ: t.z + 12 });
  }

  // Palm trees: a ring around the plaza and a line along the beach.
  const palmSpots = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    palmSpots.push([20 + Math.cos(a) * 15, 20 + Math.sin(a) * 15]);
  }
  for (let i = 0; i < 16; i++) {
    palmSpots.push([rng.range(128, 146), -150 + i * 20 + rng.range(-4, 4)]);
  }
  for (const [px, pz] of palmSpots) {
    scene.add(makePalm(THREE, rng, px, pz));
  }

  // Street lamps along the main roads.
  const lampMat = new THREE.MeshLambertMaterial({ color: 0x2c2f33 });
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (const r of [-80, 0, 80]) {
    for (let t = -120; t <= 120; t += 60) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 6, 6), lampMat);
      pole.position.set(t, 3, r + 6.4);
      scene.add(pole);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), bulbMat);
      bulb.position.set(t, 6.1, r + 6.4);
      scene.add(bulb);
    }
  }

  G.city = { colliders, roads: ROADS, bound: CITY_BOUND, locations: LOCATIONS };
  return G.city;
}

function makePalm(THREE, rng, x, z) {
  const group = new THREE.Group();
  const lean = rng.range(-0.12, 0.12);
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.38, 7, 7),
    new THREE.MeshLambertMaterial({ color: 0x7a5c38 })
  );
  trunk.position.y = 3.5;
  trunk.rotation.z = lean;
  trunk.castShadow = true;
  group.add(trunk);
  const frondMat = new THREE.MeshLambertMaterial({ color: 0x3f8f4f });
  for (let i = 0; i < 6; i++) {
    const frond = new THREE.Mesh(new THREE.ConeGeometry(0.9, 4.4, 4), frondMat);
    const a = (i / 6) * Math.PI * 2;
    frond.position.set(Math.cos(a) * 1.6, 7.2, Math.sin(a) * 1.6);
    frond.rotation.z = Math.cos(a) * 1.15;
    frond.rotation.x = -Math.sin(a) * 1.15;
    frond.castShadow = true;
    group.add(frond);
  }
  const nuts = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 8, 6),
    new THREE.MeshLambertMaterial({ color: 0x6b4a2a })
  );
  nuts.position.y = 6.9;
  group.add(nuts);
  group.position.set(x, 0, z);
  return group;
}

// Push a circle (x, z, radius) out of every building collider and the city bounds.
// Returns the corrected position and whether a collision happened.
export function collideCircle(G, x, z, radius) {
  let hit = false;
  for (const c of G.city.colliders) {
    const cx = clamp(x, c.minX, c.maxX);
    const cz = clamp(z, c.minZ, c.maxZ);
    const dx = x - cx;
    const dz = z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      hit = true;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        const push = (radius - d) / d;
        x += dx * push;
        z += dz * push;
      } else {
        // Dead centre inside a building: shove out along the smallest penetration.
        const pl = x - (c.minX - radius);
        const pr = c.maxX + radius - x;
        const pt = z - (c.minZ - radius);
        const pb = c.maxZ + radius - z;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) x = c.minX - radius;
        else if (m === pr) x = c.maxX + radius;
        else if (m === pt) z = c.minZ - radius;
        else z = c.maxZ + radius;
      }
    }
  }
  const b = G.city.bound;
  if (x < -b) { x = -b; hit = true; }
  if (x > b) { x = b; hit = true; }
  if (z < -b) { z = -b; hit = true; }
  if (z > b) { z = b; hit = true; }
  return { x, z, hit };
}

export function isOnRoad(x, z) {
  for (const r of ROADS) {
    if (Math.abs(x - r) < 5.5 || Math.abs(z - r) < 5.5) return true;
  }
  return false;
}

// Nearest point on the road grid to (x, z): used to spawn police and traffic on roads.
export function nearestRoadPoint(x, z) {
  let bestX = ROADS[0];
  let bestZ = ROADS[0];
  let best = Infinity;
  for (const rx of ROADS) {
    const d = Math.abs(x - rx);
    if (d < best) { best = d; bestX = rx; bestZ = z; }
  }
  best = Infinity;
  for (const rz of ROADS) {
    const d = Math.abs(z - rz);
    if (d < best) { best = d; bestZ = rz; bestX = x; }
  }
  return { x: bestX, z: bestZ };
}
