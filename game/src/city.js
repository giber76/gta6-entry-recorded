// city.js — Solara Bay itself: a seeded road grid, buildings, beach,
// ocean, plaza and palms. One seeded RNG drives every layout choice, so
// the city is the same on every load and the missions always find their
// landmarks where they expect them.
//
// The RNG call order is part of the layout: buildings first (row-major,
// plaza block skipped), then the two towers, then the beach palm spots,
// then one lean per palm. Reorder nothing that draws from the RNG.

import { makeRng, makeFacadeTexture, makeRoadTexture, clamp } from './util.js';

export const ROADS = [-120, -80, -40, 0, 40, 80, 120];
export const BLOCKS = [-100, -60, -20, 20, 60, 100];
export const CITY_BOUND = 168;

// Places the story uses. All of them sit on roads or open ground, never
// inside a building footprint.
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

// Make a mesh, put it where it belongs, set its shadow flags, add it.
function place(THREE, scene, geo, mat, x, y, z, shadows) {
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  if (shadows === 'cast' || shadows === 'both') mesh.castShadow = true;
  if (shadows === 'receive' || shadows === 'both') mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

function flat(THREE, scene, w, d, color, x, y, z) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshLambertMaterial({ color })
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, y, z);
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

function layGround(THREE, scene) {
  flat(THREE, scene, 460, 460, 0x6f7a58, 0, 0, 0);
}

function layWater(THREE, scene) {
  // Ocean east of the city, sand between the water and the streets, and a
  // boardwalk strip along the sand.
  flat(THREE, scene, 280, 460, 0x1e6f9e, 300, 0.06, 0);
  flat(THREE, scene, 22, 340, 0xd9c08a, 151, 0.08, 0);
  flat(THREE, scene, 8, 300, 0x8a6b4a, 138, 0.1, 0);
}

function layRoads(THREE, scene) {
  // Dark strips with a dashed centre line, one along each grid line.
  const roadTex = makeRoadTexture(THREE);
  roadTex.wrapS = THREE.RepeatWrapping;
  roadTex.wrapT = THREE.RepeatWrapping;
  roadTex.repeat.set(1, 12);
  const roadMat = new THREE.MeshLambertMaterial({ map: roadTex });
  ROADS.forEach((r) => {
    const eastWest = new THREE.Mesh(new THREE.PlaneGeometry(344, 10), roadMat);
    eastWest.rotation.x = -Math.PI / 2;
    eastWest.position.set(0, 0.12, r);
    eastWest.receiveShadow = true;
    scene.add(eastWest);
    const northSouth = new THREE.Mesh(new THREE.PlaneGeometry(10, 344), roadMat.clone());
    northSouth.material.map = roadTex.clone();
    northSouth.material.map.needsUpdate = true;
    northSouth.rotation.x = -Math.PI / 2;
    northSouth.rotation.z = Math.PI / 2;
    northSouth.position.set(r, 0.12, 0);
    northSouth.receiveShadow = true;
    scene.add(northSouth);
  });
}

function layPlaza(THREE, scene) {
  // A paved square in the (20, 20) block, with a fountain ring.
  flat(THREE, scene, 34, 34, 0xcbb98f, 20, 0.14, 20);
  place(
    THREE, scene,
    new THREE.CylinderGeometry(4, 4.6, 1.1, 20),
    new THREE.MeshLambertMaterial({ color: 0x7fb2d9 }),
    14, 0.55, 14, 'cast'
  );
  // The pier: a wooden deck reaching out over the water at z = -40.
  place(
    THREE, scene,
    new THREE.BoxGeometry(30, 0.8, 8),
    new THREE.MeshLambertMaterial({ color: 0x7a5c38 }),
    164, 0.4, -40, 'both'
  );
}

function layLamps(THREE, scene) {
  // Street lamps along the three main east-west roads.
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x2c2f33 });
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  [-80, 0, 80].forEach((r) => {
    for (let t = -120; t <= 120; t += 60) {
      place(THREE, scene, new THREE.CylinderGeometry(0.12, 0.16, 6, 6), poleMat, t, 3, r + 6.4);
      place(THREE, scene, new THREE.SphereGeometry(0.35, 8, 6), bulbMat, t, 6.1, r + 6.4);
    }
  });
}

const PALETTE = ['#c9a37e', '#b7c4cc', '#d8c9a3', '#a8b8a0', '#c4a0a0', '#9fb3c8', '#d0b48a', '#b0a8c0'];
const FACADE_COLS = [4, 5, 6];
const HEIGHTS = [10, 13, 16, 20, 24, 30, 38, 46];

// One building per block. Heights, colours and footprints all come from
// the seeded RNG, in this exact draw order: width, depth, height, jitter
// x, jitter z, facade colour, facade columns, then the facade's windows.
function raiseBuilding(THREE, scene, rng, bx, bz, colliders) {
  const slab = new THREE.Mesh(
    new THREE.BoxGeometry(36, 0.3, 36),
    new THREE.MeshLambertMaterial({ color: 0x9a9a92 })
  );
  slab.position.set(bx, 0.15, bz);
  slab.receiveShadow = true;
  scene.add(slab);
  const w = rng.range(20, 27);
  const d = rng.range(20, 27);
  const h = rng.pick(HEIGHTS);
  const jx = bx + rng.range(-3, 3);
  const jz = bz + rng.range(-3, 3);
  const floors = Math.max(2, Math.round(h / 4));
  const tex = makeFacadeTexture(THREE, rng, rng.pick(PALETTE), floors, rng.pick(FACADE_COLS));
  const faceMat = new THREE.MeshLambertMaterial({ map: tex });
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x3c4148 });
  const building = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    [faceMat, faceMat, roofMat, roofMat, faceMat, faceMat]
  );
  building.position.set(jx, 0.3 + h / 2, jz);
  building.castShadow = true;
  building.receiveShadow = true;
  scene.add(building);
  colliders.push({ minX: jx - w / 2, maxX: jx + w / 2, minZ: jz - d / 2, maxZ: jz + d / 2 });
}

// Two landmark towers so the skyline reads from anywhere in the city.
function raiseTower(THREE, scene, rng, spot, colliders) {
  const tex = makeFacadeTexture(THREE, rng, spot.color, 14, 6);
  const tower = new THREE.Mesh(
    new THREE.BoxGeometry(24, spot.h, 24),
    new THREE.MeshLambertMaterial({ map: tex })
  );
  tower.position.set(spot.x, 0.3 + spot.h / 2, spot.z);
  tower.castShadow = true;
  scene.add(tower);
  colliders.push({ minX: spot.x - 12, maxX: spot.x + 12, minZ: spot.z - 12, maxZ: spot.z + 12 });
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

export function initCity(G) {
  const THREE = window.THREE;
  const rng = makeRng(20261117);
  const scene = G.scene;
  const colliders = [];

  scene.background = new THREE.Color(0x87b5d6);
  scene.fog = new THREE.Fog(0x9fc3dd, 180, 420);

  const sky = new THREE.HemisphereLight(0xcfe8ff, 0x5a5a48, 0.95);
  scene.add(sky);
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

  layGround(THREE, scene);
  layWater(THREE, scene);
  layRoads(THREE, scene);
  layPlaza(THREE, scene);

  for (const bx of BLOCKS) {
    for (const bz of BLOCKS) {
      if (bx === 20 && bz === 20) continue; // plaza block stays open
      raiseBuilding(THREE, scene, rng, bx, bz, colliders);
    }
  }

  const towerSpots = [
    { x: -100, z: -100, h: 58, color: '#8fb0cc' },
    { x: 60, z: -60, h: 50, color: '#c9a37e' },
  ];
  for (const t of towerSpots) raiseTower(THREE, scene, rng, t, colliders);

  // Palms: a ring around the plaza, and a line down the beach.
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

  layLamps(THREE, scene);

  G.city = { colliders, roads: ROADS, bound: CITY_BOUND, locations: LOCATIONS };
  return G.city;
}

// Push a circle out of one building box. Returns the corrected position
// and whether the circle overlapped the box.
function pushFromBox(x, z, radius, c) {
  const cx = clamp(x, c.minX, c.maxX);
  const cz = clamp(z, c.minZ, c.maxZ);
  const dx = x - cx;
  const dz = z - cz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= radius * radius) return { x, z, hit: false };
  if (d2 > 0.0001) {
    const d = Math.sqrt(d2);
    const push = (radius - d) / d;
    return { x: x + dx * push, z: z + dz * push, hit: true };
  }
  // Dead centre inside the box: leave along the shallowest side.
  const exits = [
    [c.minX - radius, z],
    [c.maxX + radius, z],
    [x, c.minZ - radius],
    [x, c.maxZ + radius],
  ];
  const depths = [
    x - (c.minX - radius),
    c.maxX + radius - x,
    z - (c.minZ - radius),
    c.maxZ + radius - z,
  ];
  let best = 0;
  for (let i = 1; i < 4; i++) if (depths[i] < depths[best]) best = i;
  return { x: exits[best][0], z: exits[best][1], hit: true };
}

// Shove a circle (x, z, radius) out of every building and the city edge.
// Returns the corrected position plus whether anything was hit.
export function collideCircle(G, x, z, radius) {
  let hit = false;
  for (const c of G.city.colliders) {
    const fixed = pushFromBox(x, z, radius, c);
    x = fixed.x;
    z = fixed.z;
    hit = hit || fixed.hit;
  }
  const b = G.city.bound;
  if (x < -b) { x = -b; hit = true; }
  if (x > b) { x = b; hit = true; }
  if (z < -b) { z = -b; hit = true; }
  if (z > b) { z = b; hit = true; }
  return { x, z, hit };
}

export function isOnRoad(x, z) {
  return ROADS.some((r) => Math.abs(x - r) < 5.5 || Math.abs(z - r) < 5.5);
}

// Closest road coordinate to one value on one axis.
function nearestRoadCoord(v) {
  let best = ROADS[0];
  let bestD = Infinity;
  for (const r of ROADS) {
    const d = Math.abs(v - r);
    if (d < bestD) {
      bestD = d;
      best = r;
    }
  }
  return best;
}

// Closest point on the road grid to (x, z): police and traffic spawn on roads.
export function nearestRoadPoint(x, z) {
  return { x: nearestRoadCoord(x), z: nearestRoadCoord(z) };
}
