// city.js — Solara Bay world: land, ocean, roads, buildings, palms,
// streetlights, pier, marina, and the landmark buildings. All geometry is
// generated from a fixed seed, so the city is identical every run.
import * as THREE from 'three';
import { makeRng, clamp } from './util.js';

export const ROADS = [-160, -120, -80, -40, 0, 40, 80, 120, 160];
export const LAND = { minX: -220, maxX: 185, minZ: -220, maxZ: 185 };
export const DISTRICTS = {
  garage: { x: -118, z: 116, name: "Rico's Garage" },
  coral: { x: 78, z: 116, name: 'Coral Junction' },
  marina: { x: 112, z: 40, name: 'Marina East' },
  pier: { x: 158, z: -40, name: 'The Pier' },
  bank: { x: -40, z: -80, name: 'Solara Bank' },
  safehouse: { x: 138, z: 76, name: 'Safehouse' },
  coupe: { x: 24, z: 26, name: 'The First Coupe' },
  getaway: { x: -46, z: 8, name: 'Getaway Car' },
  bossCoupe: { x: 126, z: 48, name: "Boss Coupe" },
};

// Rectangles where no generic building may stand (mission plazas, marina,
// pier boardwalk, beach). Landmark buildings are placed by hand outside
// the exact mission points.
const OPEN_ZONES = [
  { x0: 88, x1: 140, z0: 24, z1: 56 }, // Marina East
  { x0: 148, x1: 185, z0: -56, z1: -24 }, // pier boardwalk
  { x0: -130, x1: -106, z0: 104, z1: 128 }, // garage forecourt
  { x0: 66, x1: 90, z0: 104, z1: 128 }, // Coral Junction plaza
  { x0: -52, x1: -28, z0: -92, z1: -68 }, // bank forecourt
  { x0: 126, x1: 150, z0: 64, z1: 88 }, // safehouse drive
  { x0: 12, x1: 36, z0: 14, z1: 38 }, // M1 coupe lot
  { x0: -58, x1: -34, z0: -4, z1: 20 }, // getaway spot
  { x0: 168, x1: 185, z0: -220, z1: 185 }, // east beach
  { x0: -220, x1: 185, z0: 168, z1: 185 }, // south beach
];

function rectsOverlap(a, b) {
  return a.x0 < b.x1 && a.x1 > b.x0 && a.z0 < b.z1 && a.z1 > b.z0;
}
function inOpenZone(x, z, pad = 0) {
  for (const zn of OPEN_ZONES) {
    if (x > zn.x0 - pad && x < zn.x1 + pad && z > zn.z0 - pad && z < zn.z1 + pad) return true;
  }
  return false;
}

// Canvas helpers ---------------------------------------------------------
function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

// Ground texture: 1024px covers world x,z in [-220, 185] (405 m).
// Mapping: px = (x + 220) / 405 * 1024, py = (z + 220) / 405 * 1024.
const WORLD_MIN = -220;
const WORLD_SIZE = 405;
const TEX = 1024;
function w2p(v) {
  return ((v - WORLD_MIN) / WORLD_SIZE) * TEX;
}

function groundTexture() {
  const [c, g] = makeCanvas(TEX, TEX);
  // Land base: warm dusk asphalt-grey.
  g.fillStyle = '#3d3a36';
  g.fillRect(0, 0, TEX, TEX);
  // City blocks: subtle checker of warm greys.
  const rng = makeRng(1234);
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      const bx = ROADS[i] + 5;
      const bz = ROADS[j] + 5;
      const shade = 52 + Math.floor(rng.next() * 14);
      g.fillStyle = `rgb(${shade + 8},${shade + 2},${shade - 4})`;
      g.fillRect(w2p(bx), w2p(bz), w2p(ROADS[i + 1] - 5) - w2p(bx), w2p(ROADS[j + 1] - 5) - w2p(bz));
    }
  }
  // Beach sand along east + south coasts.
  g.fillStyle = '#c9a86a';
  g.fillRect(w2p(168), 0, w2p(185) - w2p(168), TEX);
  g.fillRect(0, w2p(168), TEX, w2p(185) - w2p(168));
  // Wet sand line at the water edge.
  g.fillStyle = '#b3935c';
  g.fillRect(w2p(181), 0, w2p(185) - w2p(181), TEX);
  g.fillRect(0, w2p(181), TEX, w2p(185) - w2p(181));
  // Sidewalks: pale strips flanking every road.
  g.fillStyle = '#6f6a63';
  for (const r of ROADS) {
    g.fillRect(w2p(r - 7), 0, w2p(r - 5) - w2p(r - 7), TEX);
    g.fillRect(w2p(r + 5), 0, w2p(r + 7) - w2p(r + 5), TEX);
    g.fillRect(0, w2p(r - 7), TEX, w2p(r - 5) - w2p(r - 7));
    g.fillRect(0, w2p(r + 5), TEX, w2p(r + 7) - w2p(r + 5));
  }
  // Roads: dark asphalt.
  g.fillStyle = '#26242a';
  for (const r of ROADS) {
    g.fillRect(w2p(r - 5), 0, w2p(r + 5) - w2p(r - 5), TEX);
    g.fillRect(0, w2p(r - 5), TEX, w2p(r + 5) - w2p(r - 5));
  }
  // Centre dashes.
  g.fillStyle = '#c8b96a';
  for (const r of ROADS) {
    for (let d = -200; d < 200; d += 12) {
      g.fillRect(w2p(r) - 1, w2p(d), 2, w2p(d + 6) - w2p(d));
      g.fillRect(w2p(d), w2p(r) - 1, w2p(d + 6) - w2p(d), 2);
    }
  }
  // Crosswalks at every intersection.
  g.fillStyle = '#d8d4c8';
  for (const rx of ROADS) {
    for (const rz of ROADS) {
      for (let k = -4; k <= 4; k += 2) {
        g.fillRect(w2p(rx + k) - 2, w2p(rz - 7), 3, 3);
        g.fillRect(w2p(rx + k) - 2, w2p(rz + 5), 3, 3);
        g.fillRect(w2p(rx - 7), w2p(rz + k) - 2, 3, 3);
        g.fillRect(w2p(rx + 5), w2p(rz + k) - 2, 3, 3);
      }
    }
  }
  // Plazas: pale paving in the open zones.
  g.fillStyle = '#7d7668';
  for (const zn of OPEN_ZONES) {
    if (zn.x0 >= 168 || zn.z0 >= 168) continue; // beach already sand
    g.fillRect(w2p(zn.x0), w2p(zn.z0), w2p(zn.x1) - w2p(zn.x0), w2p(zn.z1) - w2p(zn.z0));
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function oceanTexture() {
  const [c, g] = makeCanvas(256, 256);
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#1d5f8a');
  grad.addColorStop(1, '#0e3a5e');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  const rng = makeRng(77);
  g.strokeStyle = 'rgba(255,255,255,0.20)';
  g.lineWidth = 2;
  for (let i = 0; i < 40; i++) {
    const x = rng.range(0, 256);
    const y = rng.range(0, 256);
    const len = rng.range(12, 42);
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + len / 2, y + rng.range(-4, 4), x + len, y);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(10, 10);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildingTexture(floors, litRatio) {
  const [c, g] = makeCanvas(128, 256);
  g.fillStyle = '#33302e';
  g.fillRect(0, 0, 128, 256);
  // Subtle vertical shading.
  const grad = g.createLinearGradient(0, 0, 128, 0);
  grad.addColorStop(0, 'rgba(0,0,0,0.35)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.06)');
  grad.addColorStop(1, 'rgba(0,0,0,0.35)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 256);
  const rng = makeRng(900 + floors);
  const cols = 6;
  const rows = floors;
  const cw = 128 / cols;
  const ch = 256 / rows;
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const lit = rng.next() < litRatio;
      g.fillStyle = lit ? '#ffd98a' : '#14181f';
      g.fillRect(i * cw + 3, j * ch + 4, cw - 6, ch - 8);
      if (lit) {
        g.fillStyle = 'rgba(255,255,255,0.35)';
        g.fillRect(i * cw + 3, j * ch + 4, cw - 6, 3);
      }
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function textSignTexture(text, sub, bg, fg) {
  const [c, g] = makeCanvas(512, 128);
  g.fillStyle = bg;
  g.fillRect(0, 0, 512, 128);
  g.strokeStyle = fg;
  g.lineWidth = 6;
  g.strokeRect(6, 6, 500, 116);
  g.fillStyle = fg;
  g.font = 'bold 52px Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 256, 52);
  g.font = 'bold 28px Arial, sans-serif';
  g.fillText(sub, 256, 98);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// City build ---------------------------------------------------------------
export function buildCity(scene) {
  const rng = makeRng(20261121);
  const colliders = [];
  const group = new THREE.Group();
  scene.add(group);

  // Land: a 405x405 box, top at y=0, so the coast is a low cliff.
  const land = new THREE.Mesh(
    new THREE.BoxGeometry(WORLD_SIZE, 1, WORLD_SIZE),
    new THREE.MeshLambertMaterial({ map: groundTexture() }),
  );
  land.position.set(-17.5, -0.5, -17.5);
  land.receiveShadow = false;
  group.add(land);

  // Ocean: big plane under/around the land, slightly below it.
  const oceanTex = oceanTexture();
  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(1400, 1400),
    new THREE.MeshLambertMaterial({ map: oceanTex, color: 0x9fc8e8 }),
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(200, -0.55, 200);
  group.add(ocean);

  // Buildings: three height classes, one InstancedMesh each.
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const classes = [
    { min: 8, max: 14, floors: 4, count: 0, tex: buildingTexture(4, 0.42) },
    { min: 15, max: 25, floors: 8, count: 0, tex: buildingTexture(8, 0.38) },
    { min: 26, max: 42, floors: 14, count: 0, tex: buildingTexture(14, 0.34) },
  ];
  const placements = [];
  const blockCenters = [];
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      blockCenters.push({ x: ROADS[i] + 20, z: ROADS[j] + 20 });
    }
  }
  const dummy = new THREE.Object3D();
  const palette = [0x8a7f74, 0x7a6f66, 0x9a8a76, 0x6f7a86, 0x86755c, 0x74655a];
  for (const bc of blockCenters) {
    const w = rng.range(13, 21);
    const d = rng.range(13, 21);
    const bx = bc.x + rng.range(-3, 3);
    const bz = bc.z + rng.range(-3, 3);
    const foot = { x0: bx - w / 2, x1: bx + w / 2, z0: bz - d / 2, z1: bz + d / 2 };
    let blocked = false;
    for (const zn of OPEN_ZONES) {
      if (rectsOverlap(foot, { x0: zn.x0 - 1, x1: zn.x1 + 1, z0: zn.z0 - 1, z1: zn.z1 + 1 })) {
        blocked = true;
        break;
      }
    }
    if (blocked) continue;
    const h = rng.chance(0.4) ? rng.range(8, 14) : rng.chance(0.66) ? rng.range(15, 25) : rng.range(26, 42);
    const cls = h <= 14 ? 0 : h <= 25 ? 1 : 2;
    classes[cls].count++;
    placements.push({ x: bx, z: bz, w, d, h, cls });
    colliders.push({ minX: foot.x0, maxX: foot.x1, minZ: foot.z0, maxZ: foot.z1 });
  }
  for (let ci = 0; ci < 3; ci++) {
    const list = placements.filter((p) => p.cls === ci);
    if (list.length === 0) continue;
    const mat = new THREE.MeshLambertMaterial({
      map: classes[ci].tex,
      emissive: 0xffffff,
      emissiveMap: classes[ci].tex,
      emissiveIntensity: 0.28,
    });
    const mesh = new THREE.InstancedMesh(boxGeo, mat, list.length);
    list.forEach((p, idx) => {
      dummy.position.set(p.x, p.h / 2, p.z);
      dummy.scale.set(p.w, p.h, p.d);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(idx, dummy.matrix);
      mesh.setColorAt(idx, new THREE.Color(palette[Math.floor(rng.next() * palette.length)]));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    group.add(mesh);
  }

  // Landmark buildings (hand-placed, clear of their mission points).
  function landmark(x, z, w, h, d, color, signText, signSub, signBg) {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshLambertMaterial({ color }),
    );
    m.position.set(x, h / 2, z);
    group.add(m);
    colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
    if (signText) {
      const sign = new THREE.Mesh(
        new THREE.PlaneGeometry(Math.min(w * 0.9, 14), 3.2),
        new THREE.MeshBasicMaterial({ map: textSignTexture(signText, signSub, signBg, '#ffe9b0') }),
      );
      // Face the mission point (east for garage/bank, west for safehouse).
      sign.position.set(x + (x < 0 ? w / 2 + 0.1 : -(w / 2 + 0.1)), h * 0.72, z);
      sign.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2;
      group.add(sign);
    }
    return m;
  }
  // Rico's Garage — west of its forecourt, target point stays clear.
  landmark(-130, 116, 12, 9, 18, 0x7a5a3a, "RICO'S", 'GARAGE • REPAIRS', '#4a2f1d');
  // Solara Bank — west of the vault forecourt.
  landmark(-58, -80, 12, 22, 20, 0x8a7f5a, 'SOLARA', 'BANK', '#3a3423');
  // Safehouse — east of its drive.
  landmark(148, 80, 12, 10, 14, 0x5a6f7a, 'SAFE', 'HOUSE', '#22303a');
  // Marina office, on the marina's west edge.
  landmark(84, 40, 10, 8, 12, 0x4a6a7a, 'MARINA', 'EAST', '#1d2f3a');

  // Palms: trunks + crowns, instanced, along the beach and marina.
  const palmSpots = [];
  for (let i = 0; i < 46; i++) {
    if (rng.chance(0.5)) {
      palmSpots.push({ x: rng.range(170, 182), z: rng.range(-180, 180) });
    } else {
      palmSpots.push({ x: rng.range(92, 180), z: rng.range(28, 52) });
    }
  }
  // A few palms on the coral plaza and garage forecourt.
  palmSpots.push({ x: 70, z: 108 }, { x: 86, z: 124 }, { x: -126, z: 108 });
  const trunkGeo = new THREE.CylinderGeometry(0.18, 0.3, 5, 6);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6a4a });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, palmSpots.length);
  const crownGeo = new THREE.ConeGeometry(2.2, 2.6, 7);
  const crownMat = new THREE.MeshLambertMaterial({ color: 0x3f7a34 });
  const crowns = new THREE.InstancedMesh(crownGeo, crownMat, palmSpots.length);
  palmSpots.forEach((p, idx) => {
    const lean = rng.range(-0.12, 0.12);
    dummy.position.set(p.x, 2.5, p.z);
    dummy.scale.set(1, 1, 1);
    dummy.rotation.set(lean, rng.range(0, Math.PI * 2), 0);
    dummy.updateMatrix();
    trunks.setMatrixAt(idx, dummy.matrix);
    dummy.position.set(p.x, 5.6, p.z);
    dummy.rotation.set(lean, rng.range(0, Math.PI * 2), 0);
    dummy.updateMatrix();
    crowns.setMatrixAt(idx, dummy.matrix);
  });
  trunks.instanceMatrix.needsUpdate = true;
  crowns.instanceMatrix.needsUpdate = true;
  group.add(trunks);
  group.add(crowns);

  // Streetlights along the roads.
  const lightSpots = [];
  for (const r of ROADS) {
    for (let d = -140; d <= 140; d += 70) {
      lightSpots.push({ x: r + 6.5, z: d });
      lightSpots.push({ x: d, z: r + 6.5 });
    }
  }
  const poleGeo = new THREE.CylinderGeometry(0.09, 0.12, 6, 5);
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x3a3f45 });
  const poles = new THREE.InstancedMesh(poleGeo, poleMat, lightSpots.length);
  const lampGeo = new THREE.SphereGeometry(0.32, 8, 6);
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffd98a });
  const lamps = new THREE.InstancedMesh(lampGeo, lampMat, lightSpots.length);
  lightSpots.forEach((p, idx) => {
    dummy.position.set(p.x, 3, p.z);
    dummy.scale.set(1, 1, 1);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    poles.setMatrixAt(idx, dummy.matrix);
    dummy.position.set(p.x, 6.1, p.z);
    dummy.updateMatrix();
    lamps.setMatrixAt(idx, dummy.matrix);
  });
  poles.instanceMatrix.needsUpdate = true;
  lamps.instanceMatrix.needsUpdate = true;
  group.add(poles);
  group.add(lamps);

  // The pier: wooden walkway out over the ocean at z=-40, from x=170 to 214.
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x7a5c38 });
  const pierDeck = new THREE.Mesh(new THREE.BoxGeometry(46, 0.5, 7), pierMat);
  pierDeck.position.set(192, 0.4, -40);
  group.add(pierDeck);
  const postGeo = new THREE.CylinderGeometry(0.25, 0.25, 3, 6);
  const posts = new THREE.InstancedMesh(postGeo, pierMat, 12);
  let pi = 0;
  for (let x = 174; x <= 212; x += 7) {
    for (const dz of [-3, 3]) {
      dummy.position.set(x, -0.8, -40 + dz);
      dummy.scale.set(1, 1, 1);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      posts.setMatrixAt(pi++, dummy.matrix);
    }
  }
  posts.instanceMatrix.needsUpdate = true;
  group.add(posts);
  // Pier end hut.
  const hut = new THREE.Mesh(new THREE.BoxGeometry(6, 4, 5), new THREE.MeshLambertMaterial({ color: 0x9a7a4a }));
  hut.position.set(210, 2.6, -40);
  group.add(hut);

  // Marina docks + boats just offshore.
  const dockMat = new THREE.MeshLambertMaterial({ color: 0x6a4a2a });
  for (const dz of [28, 40, 52]) {
    const dock = new THREE.Mesh(new THREE.BoxGeometry(18, 0.4, 3), dockMat);
    dock.position.set(178, 0.2, dz);
    group.add(dock);
  }
  const boatColors = [0xd8d8d8, 0x3a6a9a, 0xc85a3a, 0x4a9a6a];
  for (let i = 0; i < 4; i++) {
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(
      new THREE.BoxGeometry(7, 1.2, 2.6),
      new THREE.MeshLambertMaterial({ color: boatColors[i] }),
    );
    hull.position.y = 0.1;
    boat.add(hull);
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(3, 1.4, 2),
      new THREE.MeshLambertMaterial({ color: 0xeeeeee }),
    );
    cabin.position.set(-0.5, 1.3, 0);
    boat.add(cabin);
    boat.position.set(196 + i * 3, -0.2, 26 + i * 8);
    boat.rotation.y = rng.range(-0.2, 0.2);
    group.add(boat);
  }

  // Coral Junction fountain.
  const fountain = new THREE.Mesh(
    new THREE.CylinderGeometry(3, 3.4, 0.8, 12),
    new THREE.MeshLambertMaterial({ color: 0x9a948a }),
  );
  fountain.position.set(78, 0.4, 116);
  group.add(fountain);
  const water = new THREE.Mesh(
    new THREE.CylinderGeometry(2.6, 2.6, 0.3, 12),
    new THREE.MeshLambertMaterial({ color: 0x3a8ab0 }),
  );
  water.position.set(78, 0.85, 116);
  group.add(water);

  return {
    colliders,
    update(dt) {
      oceanTex.offset.x += dt * 0.008;
      oceanTex.offset.y += dt * 0.005;
    },
  };
}

// Circle (x,z,r) vs building AABBs: push-out. Returns corrected {x,z} or null.
export function collideCircle(x, z, r, colliders) {
  let cx = x;
  let cz = z;
  let hit = false;
  for (const b of colliders) {
    const nx = clamp(cx, b.minX, b.maxX);
    const nz = clamp(cz, b.minZ, b.maxZ);
    const dx = cx - nx;
    const dz = cz - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      hit = true;
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        cx = nx + (dx / d) * r;
        cz = nz + (dz / d) * r;
      } else {
        // Inside the box: push out along the smallest penetration axis.
        const pl = cx - b.minX;
        const pr = b.maxX - cx;
        const pt = cz - b.minZ;
        const pb = b.maxZ - cz;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) cx = b.minX - r;
        else if (m === pr) cx = b.maxX + r;
        else if (m === pt) cz = b.minZ - r;
        else cz = b.maxZ + r;
      }
    }
  }
  return hit ? { x: cx, z: cz } : null;
}

export function clampToLand(x, z) {
  return {
    x: clamp(x, LAND.minX + 2, LAND.maxX - 2),
    z: clamp(z, LAND.minZ + 2, LAND.maxZ - 2),
  };
}
