// city.js — Solara Bay world geometry for gta6-01.
// A coastal grid city: roads on a 60 m grid, buildings in the blocks,
// ocean along the east and south edges. The ground is a single canvas
// texture (one draw call); buildings are boxes with seeded heights.
// All key mission points are kept clear of buildings.

import { mulberry32, dist2d } from './util.js';

export const WORLD_MIN = -180;
export const WORLD_MAX = 180;
export const ROAD_LINES = [-150, -90, -30, 0, 30, 90, 150];
export const ROAD_HALF = 6;

// Mission-critical points. Nothing may be built within CLEAR of them.
export const KEY_POINTS = {
  garage: { x: -118, z: 116 },
  coralJunction: { x: 78, z: 116 },
  pier: { x: 158, z: -40 },
  bank: { x: -40, z: -80 },
  vault: { x: -40, z: -80 },
  safehouse: { x: 138, z: 76 },
  marina: { x: 100, z: 36 },
  bossCoupe: { x: 126, z: 48 },
  m1Coupe: { x: 24, z: 26 },
  getawayCar: { x: -46, z: 8 },
};
export const PARKED_SPOTS = [
  { x: 44, z: 124 },
  { x: 86, z: -46 },
  { x: -20, z: -100 },
  { x: 120, z: -100 },
  { x: -140, z: 40 },
  { x: 60, z: 140 },
];
export const CLEAR_RADIUS = 16;

function allClearPoints() {
  const pts = Object.values(KEY_POINTS);
  return pts.concat(PARKED_SPOTS);
}

// Is the rectangle (minX..maxX, minZ..maxZ) clear of every key point?
function rectClear(minX, maxX, minZ, maxZ) {
  for (const p of allClearPoints()) {
    const cx = Math.max(minX, Math.min(p.x, maxX));
    const cz = Math.max(minZ, Math.min(p.z, maxZ));
    if (dist2d(cx, cz, p.x, p.z) < CLEAR_RADIUS) return false;
  }
  return true;
}

function makeGroundTexture(rng) {
  const S = 1024;
  const cv = document.createElement('canvas');
  cv.width = S;
  cv.height = S;
  const g = cv.getContext('2d');
  const toPx = (v) => ((v - WORLD_MIN) / (WORLD_MAX - WORLD_MIN)) * S;

  // Base: dark asphalt for the whole city slab.
  g.fillStyle = '#43434a';
  g.fillRect(0, 0, S, S);

  // Perimeter band (150..180): open concrete ring road.
  g.fillStyle = '#76767c';
  g.fillRect(0, 0, S, toPx(-150));
  g.fillRect(0, toPx(150), S, S - toPx(150));
  g.fillRect(0, 0, toPx(-150), S);
  g.fillRect(toPx(150), 0, S - toPx(150), S);

  // Beach sand at the very east / south edge.
  g.fillStyle = '#c9ab7c';
  g.fillRect(toPx(174), 0, S - toPx(174), S);
  g.fillRect(0, toPx(174), S, S - toPx(174));

  // City blocks: slightly varied fill so the city reads from above.
  const lines = [-180].concat(ROAD_LINES, [180]);
  const blockTones = ['#4d4d55', '#51524a', '#484852', '#54524a', '#4a4e55'];
  for (let i = 0; i < lines.length - 1; i++) {
    for (let j = 0; j < lines.length - 1; j++) {
      const x0 = lines[i];
      const x1 = lines[i + 1];
      const z0 = lines[j];
      const z1 = lines[j + 1];
      if (Math.abs(x0) >= 150 || Math.abs(z0) >= 150) continue;
      if (x1 - x0 < 20 || z1 - z0 < 20) continue;
      g.fillStyle = blockTones[Math.floor(rng() * blockTones.length)];
      g.fillRect(toPx(x0), toPx(z0), toPx(x1) - toPx(x0), toPx(z1) - toPx(z0));
    }
  }

  // Roads: sidewalk strip, then asphalt, then centre dashes.
  for (const c of ROAD_LINES) {
    // vertical road (constant x)
    g.fillStyle = '#8f8f96';
    g.fillRect(toPx(c - ROAD_HALF - 4), 0, toPx(ROAD_HALF + 4) * 2 - toPx(0), S);
    g.fillStyle = '#2f2f36';
    g.fillRect(toPx(c - ROAD_HALF), 0, toPx(ROAD_HALF) * 2 - toPx(0), S);
    // horizontal road (constant z)
    g.fillStyle = '#8f8f96';
    g.fillRect(0, toPx(c - ROAD_HALF - 4), S, toPx(ROAD_HALF + 4) * 2 - toPx(0));
    g.fillStyle = '#2f2f36';
    g.fillRect(0, toPx(c - ROAD_HALF), S, toPx(ROAD_HALF) * 2 - toPx(0));
  }
  // Centre dashes.
  g.fillStyle = '#d8c95a';
  for (const c of ROAD_LINES) {
    for (let d = -170; d < 180; d += 16) {
      g.fillRect(toPx(c) - 1.5, toPx(d), 3, 8);
      g.fillRect(toPx(d), toPx(c) - 1.5, 8, 3);
    }
  }

  // Pier deck (wood) east of the city edge at z ~ -40.
  g.fillStyle = '#8a6b42';
  g.fillRect(toPx(150), toPx(-45), toPx(180) - toPx(150), toPx(-35) - toPx(-45));
  g.fillStyle = '#6e5433';
  for (let x = 152; x < 180; x += 6) {
    g.fillRect(toPx(x), toPx(-45), 2, toPx(-35) - toPx(-45));
  }

  // Garage forecourt, bank plaza, safehouse drive (pale concrete).
  g.fillStyle = '#9a9a9e';
  g.fillRect(toPx(-132), toPx(104), toPx(-104) - toPx(-132), toPx(128) - toPx(104));
  g.fillRect(toPx(-52), toPx(-92), toPx(-28) - toPx(-52), toPx(-68) - toPx(-92));
  g.fillRect(toPx(128), toPx(66), toPx(148) - toPx(128), toPx(86) - toPx(66));

  const tex = new THREE.CanvasTexture(cv);
  tex.anisotropy = 4;
  return tex;
}

export function buildCity(world) {
  const THREE = window.THREE;
  const rng = mulberry32(20261120);
  const scene = world.scene;

  // Ground slab with the painted city texture.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(360, 360),
    new THREE.MeshLambertMaterial({ map: makeGroundTexture(rng) }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, 0);
  ground.receiveShadow = false;
  scene.add(ground);

  // Ocean: east strip + south strip, slightly below ground level.
  const seaMat = new THREE.MeshLambertMaterial({ color: 0x1d6fb8 });
  const seaEast = new THREE.Mesh(new THREE.PlaneGeometry(320, 420), seaMat);
  seaEast.rotation.x = -Math.PI / 2;
  seaEast.position.set(180 + 160, -0.4, 0);
  scene.add(seaEast);
  const seaSouth = new THREE.Mesh(new THREE.PlaneGeometry(400, 320), seaMat);
  seaSouth.rotation.x = -Math.PI / 2;
  seaSouth.position.set(0, -0.4, 180 + 160);
  scene.add(seaSouth);

  world.colliders = [];

  const buildingMats = [
    new THREE.MeshLambertMaterial({ color: 0x8d7d6b }),
    new THREE.MeshLambertMaterial({ color: 0x6b7d8d }),
    new THREE.MeshLambertMaterial({ color: 0x9c8d7a }),
    new THREE.MeshLambertMaterial({ color: 0x7a6b7d }),
    new THREE.MeshLambertMaterial({ color: 0x5d6b5a }),
    new THREE.MeshLambertMaterial({ color: 0xb0a08a }),
  ];
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x3c3c44 });

  function addBuilding(cx, cz, w, d, h, mat) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(cx, h / 2, cz);
    scene.add(mesh);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w * 0.92, 0.6, d * 0.92), roofMat);
    roof.position.set(cx, h + 0.3, cz);
    scene.add(roof);
    world.colliders.push({
      minX: cx - w / 2,
      maxX: cx + w / 2,
      minZ: cz - d / 2,
      maxZ: cz + d / 2,
    });
    return mesh;
  }

  // One building per city block (skipped when a key point is too close).
  const lines = [-180].concat(ROAD_LINES, [180]);
  for (let i = 0; i < lines.length - 1; i++) {
    for (let j = 0; j < lines.length - 1; j++) {
      const x0 = lines[i] + ROAD_HALF + 3;
      const x1 = lines[i + 1] - ROAD_HALF - 3;
      const z0 = lines[j] + ROAD_HALF + 3;
      const z1 = lines[j + 1] - ROAD_HALF - 3;
      if (x1 - x0 < 12 || z1 - z0 < 12) continue;
      if (x0 < -150 || x1 > 150 || z0 < -150 || z1 > 150) continue;
      if (!rectClear(x0, x1, z0, z1)) continue;
      const w = Math.min(x1 - x0, 14 + rng() * 14);
      const d = Math.min(z1 - z0, 14 + rng() * 14);
      const cx = (x0 + x1) / 2 + (rng() - 0.5) * Math.max(0, x1 - x0 - w);
      const cz = (z0 + z1) / 2 + (rng() - 0.5) * Math.max(0, z1 - z0 - d);
      const h = 7 + rng() * 22;
      addBuilding(cx, cz, w, d, h, buildingMats[Math.floor(rng() * buildingMats.length)]);
    }
  }

  // Landmarks (kept clear of their own arrival points).
  // Rico's Garage: low wide hall, front faces the forecourt at z ~ 116.
  addBuilding(-118, 132, 26, 10, 7, new THREE.MeshLambertMaterial({ color: 0xb3542e }));
  // Bank: pillared hall north of the vault point.
  addBuilding(-40, -94, 22, 12, 12, new THREE.MeshLambertMaterial({ color: 0xcfc4a0 }));
  // Safehouse: small house east of the arrival point.
  addBuilding(150, 76, 10, 12, 6, new THREE.MeshLambertMaterial({ color: 0x7d8a6b }));
  // Marina office.
  addBuilding(112, 62, 14, 10, 8, new THREE.MeshLambertMaterial({ color: 0x5a7d8d }));

  // Boats in the water off Marina East.
  const boatMat = new THREE.MeshLambertMaterial({ color: 0xf2f2f2 });
  const boatMat2 = new THREE.MeshLambertMaterial({ color: 0xd8b25a });
  const boats = [
    { x: 205, z: 20, mat: boatMat },
    { x: 215, z: 55, mat: boatMat2 },
    { x: 200, z: -60, mat: boatMat },
  ];
  for (const b of boats) {
    const hull = new THREE.Mesh(new THREE.BoxGeometry(10, 2, 3.5), b.mat);
    hull.position.set(b.x, -0.1, b.z);
    hull.rotation.y = (rng() - 0.5) * 0.6;
    scene.add(hull);
  }

  // Lamp posts along the central avenues.
  const lampMat = new THREE.MeshLambertMaterial({ color: 0x2a2a2e });
  const lampTopMat = new THREE.MeshLambertMaterial({ color: 0xffe9a8 });
  for (let d = -120; d <= 120; d += 60) {
    for (const [lx, lz] of [[8, d], [-8, d], [d, 8], [d, -8]]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 6, 6), lampMat);
      pole.position.set(lx, 3, lz);
      scene.add(pole);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), lampTopMat);
      bulb.position.set(lx, 6.2, lz);
      scene.add(bulb);
    }
  }

  // Mission beacon: a glowing vertical beam that marks the objective.
  const beacon = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.2, 1.2, 60, 10, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xffd23e,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  beam.position.y = 30;
  beacon.add(beam);
  const beaconBase = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 2.2, 0.4, 16),
    new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.7 }),
  );
  beaconBase.position.y = 0.2;
  beacon.add(beaconBase);
  beacon.position.set(KEY_POINTS.m1Coupe.x, 0, KEY_POINTS.m1Coupe.z);
  scene.add(beacon);
  world.beacon = beacon;

  world.keyPoints = KEY_POINTS;
  return { keyPoints: KEY_POINTS };
}

// Push a circle (x, z, radius) out of every building AABB.
// Returns a corrected {x, z}. Cheap: only checks nearby colliders.
export function pushOutOfBuildings(world, x, z, radius) {
  for (const c of world.colliders) {
    const cx = Math.max(c.minX, Math.min(x, c.maxX));
    const cz = Math.max(c.minZ, Math.min(z, c.maxZ));
    const dx = x - cx;
    const dz = z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= radius * radius) continue;
    if (d2 > 1e-6) {
      const d = Math.sqrt(d2);
      const push = radius - d;
      x += (dx / d) * push;
      z += (dz / d) * push;
    } else {
      // Centre inside the box: shove out along the smallest axis.
      const left = x - c.minX;
      const right = c.maxX - x;
      const top = z - c.minZ;
      const bottom = c.maxZ - z;
      const m = Math.min(left, right, top, bottom);
      if (m === left) x = c.minX - radius;
      else if (m === right) x = c.maxX + radius;
      else if (m === top) z = c.minZ - radius;
      else z = c.maxZ + radius;
    }
  }
  return { x, z };
}

export function clampToWorld(x, z) {
  const m = 178;
  return {
    x: Math.max(-m, Math.min(m, x)),
    z: Math.max(-m, Math.min(m, z)),
  };
}
