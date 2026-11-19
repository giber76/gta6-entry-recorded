// city.js — the Solara Bay map: seeded street grid, towers, beach and
// ocean, plus the collision boxes everything else bounces off.
//
// One seeded dice bag (seed 20261117) decides the whole layout, so the
// map is identical on every load and the story spots are always where
// the missions expect them. The dice are rolled in a fixed order —
// district blocks first (row by row, plaza block left open), then the
// two skyline towers, then the beach palm positions, then one lean per
// palm. That order is load-bearing: shuffle it and the skyline moves.
//
// The ground stops at the beach line (x = 150). East of it the sand
// and the sea are separate planes, so the city floor can never cover
// the water.

import { makeRng, makeFacadeTexture, makeRoadTexture, clamp } from './util.js';

// Grid lines the roads run on, block centres the buildings sit in, and
// the square the city may not grow past.
export const ROADS = Array.from({ length: 7 }, (_, i) => -120 + i * 40);
export const BLOCKS = Array.from({ length: 6 }, (_, i) => -100 + i * 40);
export const CITY_BOUND = 7 * 24;

// Story places. Every one of them is on a road or open ground, never
// inside a building's footprint.
const SPOT_ROWS = [
  ['plaza', 20, 20, 0, 'Solara Plaza'],
  ['coupe', 27, 26, -Math.PI / 2, 'Orange coupe'],
  ['garage', -120, 116, 0, "Rico's Garage"],
  ['pier', 162, -40, 0, 'Boardwalk Pier'],
  ['coral', 80, 120, 0, 'Coral Junction'],
  ['marina', 120, 40, 0, 'Marina East'],
  ['bank', -40, -80, 0, 'Meridian Bank'],
  ['safehouse', 140, 80, 0, 'Boardwalk Safehouse'],
  ['start', 12, 30, 0, 'Plaza steps'],
  ['bossCoupe', 128, 48, 0, 'Boss coupe'],
  // Open ground past Marina East, just before the water.
  ['beach', 158, 60, 0, 'Solara Beach'],
];
export const LOCATIONS = Object.fromEntries(
  SPOT_ROWS.map(([key, x, z, heading, name]) => [key, { x, z, heading, name }])
);

const WALL_TINTS = '#c9a37e #b7c4cc #d8c9a3 #a8b8a0 #c4a0a0 #9fb3c8 #d0b48a #b0a8c0'.split(' ');
const WINDOW_COLS = [4, 5, 6];
const STOREY_HEIGHTS = '10 13 16 20 24 30 38 46'.split(' ').map(Number);

// Drop a mesh into the scene with its shadow flags set.
function dropMesh(THREE, scene, shape, skin, x, y, z, shadowMode) {
  const piece = new THREE.Mesh(shape, skin);
  piece.position.set(x, y, z);
  if (shadowMode === 'cast' || shadowMode === 'both') piece.castShadow = true;
  if (shadowMode === 'receive' || shadowMode === 'both') piece.receiveShadow = true;
  scene.add(piece);
  return piece;
}

// A flat plane lying on the ground, catching shadows.
function paintPlane(THREE, scene, w, d, tint, x, y, z) {
  const sheet = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshLambertMaterial({ color: tint })
  );
  sheet.rotation.x = -Math.PI / 2;
  sheet.position.set(x, y, z);
  sheet.receiveShadow = true;
  scene.add(sheet);
  return sheet;
}

// The city floor: it runs from the west edge to the beach at x = 150.
// East of that line the sand and the ocean are their own planes.
function buildGround(THREE, scene) {
  paintPlane(THREE, scene, 380, 460, 0x6f7a58, -40, 0, 0);
}

function buildSea(THREE, scene) {
  // Open water east of town, a strip of sand, and the boardwalk.
  paintPlane(THREE, scene, 280, 460, 0x1e6f9e, 300, 0.06, 0);
  paintPlane(THREE, scene, 22, 340, 0xd9c08a, 151, 0.08, 0);
  paintPlane(THREE, scene, 8, 300, 0x8a6b4a, 138, 0.1, 0);
}

function buildRoadGrid(THREE, scene) {
  const asphalt = makeRoadTexture(THREE);
  asphalt.wrapS = THREE.RepeatWrapping;
  asphalt.wrapT = THREE.RepeatWrapping;
  asphalt.repeat.set(1, 12);
  const strip = new THREE.MeshLambertMaterial({ map: asphalt });
  for (const line of ROADS) {
    const across = new THREE.Mesh(new THREE.PlaneGeometry(344, 10), strip);
    across.rotation.x = -Math.PI / 2;
    across.position.set(0, 0.12, line);
    across.receiveShadow = true;
    scene.add(across);
    const along = new THREE.Mesh(new THREE.PlaneGeometry(10, 344), strip.clone());
    along.material.map = asphalt.clone();
    along.material.map.needsUpdate = true;
    along.rotation.x = -Math.PI / 2;
    along.rotation.z = Math.PI / 2;
    along.position.set(line, 0.12, 0);
    along.receiveShadow = true;
    scene.add(along);
  }
}

function buildPlaza(THREE, scene) {
  paintPlane(THREE, scene, 34, 34, 0xcbb98f, 20, 0.14, 20);
  dropMesh(
    THREE, scene,
    new THREE.CylinderGeometry(4, 4.6, 1.1, 20),
    new THREE.MeshLambertMaterial({ color: 0x7fb2d9 }),
    14, 0.55, 14, 'cast'
  );
  // The pier: a wooden deck reaching out over the water at z = -40.
  dropMesh(
    THREE, scene,
    new THREE.BoxGeometry(30, 0.8, 8),
    new THREE.MeshLambertMaterial({ color: 0x7a5c38 }),
    164, 0.4, -40, 'both'
  );
}

function buildLamps(THREE, scene) {
  const poleSkin = new THREE.MeshLambertMaterial({ color: 0x2c2f33 });
  const bulbSkin = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (const line of [-80, 0, 80]) {
    for (let t = -120; t <= 120; t += 60) {
      dropMesh(THREE, scene, new THREE.CylinderGeometry(0.12, 0.16, 6, 6), poleSkin, t, 3, line + 6.4);
      dropMesh(THREE, scene, new THREE.SphereGeometry(0.35, 8, 6), bulbSkin, t, 6.1, line + 6.4);
    }
  }
}

// One block's building. The dice decide footprint, height, jitter and
// facade in that order — the draw sequence is what keeps the skyline
// identical between loads.
function raiseOneBuilding(THREE, scene, dice, cx, cz, walls) {
  const pad = new THREE.Mesh(
    new THREE.BoxGeometry(36, 0.3, 36),
    new THREE.MeshLambertMaterial({ color: 0x9a9a92 })
  );
  pad.position.set(cx, 0.15, cz);
  pad.receiveShadow = true;
  scene.add(pad);
  const wide = dice.range(20, 27);
  const deep = dice.range(20, 27);
  const tall = dice.pick(STOREY_HEIGHTS);
  const ox = cx + dice.range(-3, 3);
  const oz = cz + dice.range(-3, 3);
  const floors = Math.max(2, Math.round(tall / 4));
  const skin = makeFacadeTexture(THREE, dice, dice.pick(WALL_TINTS), floors, dice.pick(WINDOW_COLS));
  const face = new THREE.MeshLambertMaterial({ map: skin });
  const roof = new THREE.MeshLambertMaterial({ color: 0x3c4148 });
  const tower = new THREE.Mesh(
    new THREE.BoxGeometry(wide, tall, deep),
    [face, face, roof, roof, face, face]
  );
  tower.position.set(ox, 0.3 + tall / 2, oz);
  tower.castShadow = true;
  tower.receiveShadow = true;
  scene.add(tower);
  walls.push({ minX: ox - wide / 2, maxX: ox + wide / 2, minZ: oz - deep / 2, maxZ: oz + deep / 2 });
}

// Two tall towers so the skyline reads from anywhere in town.
function raiseOneTower(THREE, scene, dice, spot, walls) {
  const skin = makeFacadeTexture(THREE, dice, spot.color, 14, 6);
  const tower = new THREE.Mesh(
    new THREE.BoxGeometry(24, spot.h, 24),
    new THREE.MeshLambertMaterial({ map: skin })
  );
  tower.position.set(spot.x, 0.3 + spot.h / 2, spot.z);
  tower.castShadow = true;
  scene.add(tower);
  walls.push({ minX: spot.x - 12, maxX: spot.x + 12, minZ: spot.z - 12, maxZ: spot.z + 12 });
}

// A striped lighthouse at the far end of the beach, lamp room glowing.
function raiseLighthouse(THREE, scene, x, z, walls) {
  const group = new THREE.Group();
  const bands = [0xf2f2f2, 0xc0392b, 0xf2f2f2, 0xc0392b];
  let top = 0;
  for (const tint of bands) {
    const ring = new THREE.Mesh(
      new THREE.CylinderGeometry(1.6, 1.9, 4, 10),
      new THREE.MeshLambertMaterial({ color: tint })
    );
    ring.position.y = top + 2;
    group.add(ring);
    top += 4;
  }
  const lamp = new THREE.Mesh(
    new THREE.CylinderGeometry(1.2, 1.2, 2, 10),
    new THREE.MeshLambertMaterial({ color: 0xffe08a, emissive: 0xffd23c, emissiveIntensity: 0.8 })
  );
  lamp.position.y = top + 1;
  group.add(lamp);
  const cap = new THREE.Mesh(
    new THREE.ConeGeometry(1.8, 1.6, 10),
    new THREE.MeshLambertMaterial({ color: 0x2c3e50 })
  );
  cap.position.y = top + 2.8;
  group.add(cap);
  group.position.set(x, 0, z);
  group.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  scene.add(group);
  walls.push({ minX: x - 2, maxX: x + 2, minZ: z - 2, maxZ: z + 2 });
}

// A billboard over the plaza advertising the city itself.
function raiseBillboard(THREE, scene, x, z, walls) {
  const post = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 8, 0.8),
    new THREE.MeshLambertMaterial({ color: 0x4a4a4a })
  );
  post.position.set(x, 4, z);
  post.castShadow = true;
  scene.add(post);
  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(12, 4, 0.4),
    new THREE.MeshLambertMaterial({ color: 0x1e6fa8 })
  );
  panel.position.set(x, 10, z);
  panel.castShadow = true;
  scene.add(panel);
  walls.push({ minX: x - 0.4, maxX: x + 0.4, minZ: z - 0.4, maxZ: z + 0.4 });
}

function buildPalm(THREE, dice, x, z) {
  const group = new THREE.Group();
  const lean = dice.range(-0.12, 0.12);
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.38, 7, 7),
    new THREE.MeshLambertMaterial({ color: 0x7a5c38 })
  );
  trunk.position.y = 3.5;
  trunk.rotation.z = lean;
  trunk.castShadow = true;
  group.add(trunk);
  const leafSkin = new THREE.MeshLambertMaterial({ color: 0x3f8f4f });
  for (let i = 0; i < 6; i++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.9, 4.4, 4), leafSkin);
    const a = (i / 6) * Math.PI * 2;
    leaf.position.set(Math.cos(a) * 1.6, 7.2, Math.sin(a) * 1.6);
    leaf.rotation.z = Math.cos(a) * 1.15;
    leaf.rotation.x = -Math.sin(a) * 1.15;
    leaf.castShadow = true;
    group.add(leaf);
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

export function initCity(game) {
  const THREE = window.THREE;
  const dice = makeRng(20261117);
  const scene = game.scene;
  const walls = [];

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
  game.sun = sun;

  buildGround(THREE, scene);
  buildSea(THREE, scene);
  buildRoadGrid(THREE, scene);
  buildPlaza(THREE, scene);

  for (const bx of BLOCKS) {
    for (const bz of BLOCKS) {
      if (bx === 20 && bz === 20) continue; // the plaza block stays open
      raiseOneBuilding(THREE, scene, dice, bx, bz, walls);
    }
  }

  const skyline = [
    { x: -100, z: -100, h: 58, color: '#8fb0cc' },
    { x: 60, z: -60, h: 50, color: '#c9a37e' },
  ];
  for (const spot of skyline) raiseOneTower(THREE, scene, dice, spot, walls);

  // A lighthouse at the end of the beach and a billboard over the
  // plaza — two landmarks that read from anywhere in the city.
  raiseLighthouse(THREE, scene, 168, 78, walls);
  raiseBillboard(THREE, scene, 20, 4, walls);

  // Palms: a ring around the plaza, and a line down the beach.
  const palmSpots = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    palmSpots.push([20 + Math.cos(a) * 15, 20 + Math.sin(a) * 15]);
  }
  for (let i = 0; i < 16; i++) {
    palmSpots.push([dice.range(128, 146), -150 + i * 20 + dice.range(-4, 4)]);
  }
  for (const [px, pz] of palmSpots) {
    scene.add(buildPalm(THREE, dice, px, pz));
  }

  buildLamps(THREE, scene);

  game.city = { colliders: walls, roads: ROADS, bound: CITY_BOUND, locations: LOCATIONS };
  return game.city;
}

// Shove a circle out of one wall box. Returns the fixed position and
// whether the circle was touching the box at all.
function pushOutOfBox(x, z, radius, box) {
  const nearX = clamp(x, box.minX, box.maxX);
  const nearZ = clamp(z, box.minZ, box.maxZ);
  const offX = x - nearX;
  const offZ = z - nearZ;
  const dist2 = offX * offX + offZ * offZ;
  if (dist2 >= radius * radius) return { x, z, hit: false };
  if (dist2 > 0.0001) {
    const dist = Math.sqrt(dist2);
    const shove = (radius - dist) / dist;
    return { x: x + offX * shove, z: z + offZ * shove, hit: true };
  }
  // Dead centre inside the box: slip out through the shallowest wall.
  const waysOut = [
    [box.minX - radius, z],
    [box.maxX + radius, z],
    [x, box.minZ - radius],
    [x, box.maxZ + radius],
  ];
  const depths = [
    x - (box.minX - radius),
    box.maxX + radius - x,
    z - (box.minZ - radius),
    box.maxZ + radius - z,
  ];
  let shallowest = 0;
  for (let i = 1; i < 4; i++) if (depths[i] < depths[shallowest]) shallowest = i;
  return { x: waysOut[shallowest][0], z: waysOut[shallowest][1], hit: true };
}

// Shove a circle (x, z, radius) out of every building and the city edge.
// Returns the corrected position plus whether anything was hit.
export function collideCircle(game, x, z, radius) {
  let hit = false;
  for (const wall of game.city.colliders) {
    const fixed = pushOutOfBox(x, z, radius, wall);
    x = fixed.x;
    z = fixed.z;
    hit = hit || fixed.hit;
  }
  const edge = game.city.bound;
  if (x < -edge) { x = -edge; hit = true; }
  if (x > edge) { x = edge; hit = true; }
  if (z < -edge) { z = -edge; hit = true; }
  if (z > edge) { z = edge; hit = true; }
  return { x, z, hit };
}

export function isOnRoad(x, z) {
  return ROADS.some((line) => Math.abs(x - line) < 5.5 || Math.abs(z - line) < 5.5);
}

// Closest grid line to one coordinate value.
function nearestLine(v) {
  let closest = ROADS[0];
  let closestD = Infinity;
  for (const line of ROADS) {
    const d = Math.abs(v - line);
    if (d < closestD) {
      closestD = d;
      closest = line;
    }
  }
  return closest;
}

// Closest point on the road grid to (x, z): police and traffic spawn
// on roads.
export function nearestRoadPoint(x, z) {
  return { x: nearestLine(x), z: nearestLine(z) };
}
