// city.js — Solara Bay's coastal city: ground, ocean, roads, buildings,
// palms, streetlights and the district landmarks. Deterministic from a seed.
// Roads run on a 40 m grid (x,z = -160..160). Buildings fill the blocks;
// the blocks that hold mission points are left as open plazas.
import * as THREE from 'three';
import { mulberry32, range, intRange, pick } from './util.js';

export const CITY_HALF = 168;
export const ROADS = [-160, -120, -80, -40, 0, 40, 80, 120, 160];
export const ROAD_HALF = 6;

// Blocks (x0,z0,x1,z1) kept clear of buildings so mission points stay open.
const CLEAR_BLOCKS = [
  [0, 0, 40, 40],       // M1 coupe (24,26)
  [80, -80, 120, -40],  // parked car (86,-46)
  [-120, 80, -80, 120], // Rico's Garage (-118,116)
  [40, 80, 80, 120],    // Coral Junction (78,116)
  [80, 0, 120, 40],     // Marina East (100,36)
  [120, 40, 160, 80],   // boss coupe (126,48) + safehouse (138,76)
  [-80, 0, -40, 40],    // getaway car (-46,8)
  [-80, -120, -40, -80], // Solara Bank building (-56,-96)
];

export const DISTRICTS = {
  garage: { x: -118, z: 116, name: "Rico's Garage" },
  coral: { x: 78, z: 116, name: 'Coral Junction' },
  marina: { x: 100, z: 36, name: 'Marina East' },
  pier: { x: 158, z: -40, name: 'The Pier' },
  bank: { x: -40, z: -80, name: 'Solara Bank' },
  safehouse: { x: 138, z: 76, name: 'Safehouse' },
};

const PALETTE = [0xd8c9a3, 0xc9a06a, 0xe8dcc8, 0xa8c4c4, 0xd98a6a, 0xb8b0a0, 0x9ab8a0, 0xe0b090];

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function windowTexture() {
  const c = makeCanvas(128, 256);
  const g = c.getContext('2d');
  g.fillStyle = '#2a2f38';
  g.fillRect(0, 0, 128, 256);
  for (let y = 8; y < 248; y += 20) {
    for (let x = 8; x < 120; x += 18) {
      const lit = Math.random() < 0.45;
      g.fillStyle = lit ? (Math.random() < 0.5 ? '#ffd98a' : '#9fd8ff') : '#1a2028';
      g.fillRect(x, y, 11, 13);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function groundTexture() {
  const S = 2048;
  const c = makeCanvas(S, S);
  const g = c.getContext('2d');
  const W = (x) => ((x + CITY_HALF) / (CITY_HALF * 2)) * S;
  const M = (m) => (m / (CITY_HALF * 2)) * S;
  // base concrete
  g.fillStyle = '#8a8378';
  g.fillRect(0, 0, S, S);
  // block interiors (warm pavement)
  for (let i = 0; i < ROADS.length - 1; i++) {
    for (let j = 0; j < ROADS.length - 1; j++) {
      const x0 = ROADS[i] + ROAD_HALF + 3;
      const z0 = ROADS[j] + ROAD_HALF + 3;
      const x1 = ROADS[i + 1] - ROAD_HALF - 3;
      const z1 = ROADS[j + 1] - ROAD_HALF - 3;
      const warm = (i * 7 + j * 13) % 3;
      g.fillStyle = warm === 0 ? '#a89a80' : warm === 1 ? '#9c8f78' : '#b0a48c';
      g.fillRect(W(x0), W(z0), M(x1 - x0), M(z1 - z0));
    }
  }
  // sidewalks (pale) then asphalt roads
  for (const r of ROADS) {
    g.fillStyle = '#c9c2b2';
    g.fillRect(W(r - ROAD_HALF - 3), 0, M(2 * (ROAD_HALF + 3)), S);
    g.fillRect(0, W(r - ROAD_HALF - 3), S, M(2 * (ROAD_HALF + 3)));
  }
  for (const r of ROADS) {
    g.fillStyle = '#3c3a38';
    g.fillRect(W(r - ROAD_HALF), 0, M(2 * ROAD_HALF), S);
    g.fillRect(0, W(r - ROAD_HALF), S, M(2 * ROAD_HALF));
  }
  // lane dashes
  g.fillStyle = '#d8d2c0';
  for (const r of ROADS) {
    for (let d = -CITY_HALF; d < CITY_HALF; d += 16) {
      g.fillRect(W(r - 0.4), W(d), M(0.8), M(7));
      g.fillRect(W(d), W(r - 0.4), M(7), M(0.8));
    }
  }
  // crosswalks at intersections
  g.fillStyle = '#e8e4d8';
  for (const rx of ROADS) {
    for (const rz of ROADS) {
      for (let k = -2; k <= 2; k++) {
        g.fillRect(W(rx + k * 2.2 - 0.8), W(rz - ROAD_HALF - 1), M(1.6), M(2));
        g.fillRect(W(rx + k * 2.2 - 0.8), W(rz + ROAD_HALF - 1), M(1.6), M(2));
        g.fillRect(W(rx - ROAD_HALF - 1), W(rz + k * 2.2 - 0.8), M(2), M(1.6));
        g.fillRect(W(rx + ROAD_HALF - 1), W(rz + k * 2.2 - 0.8), M(2), M(1.6));
      }
    }
  }
  // beach sand ring at the city edge (east + south are the shore)
  g.fillStyle = '#e0c890';
  g.fillRect(W(160), 0, M(8), S);
  g.fillRect(0, W(160), S, M(8));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function waterTexture() {
  const c = makeCanvas(256, 256);
  const g = c.getContext('2d');
  g.fillStyle = '#2e7fb8';
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(255,255,255,0.25)';
  g.lineWidth = 2;
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + 12, y - 4, x + 26, y);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(24, 24);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function signTexture(text, bg, fg) {
  const c = makeCanvas(512, 128);
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, 512, 128);
  g.strokeStyle = fg;
  g.lineWidth = 6;
  g.strokeRect(6, 6, 500, 116);
  g.fillStyle = fg;
  g.font = 'bold 52px Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 256, 66);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class City {
  constructor(scene) {
    this.scene = scene;
    this.rng = mulberry32(20261121);
    this.colliders = []; // {x, z, hx, hz}
    this.buildings = [];
    this._buildGround();
    this._buildOcean();
    this._buildBuildings();
    this._buildPalms();
    this._buildStreetlights();
    this._buildLandmarks();
  }

  _buildGround() {
    const geo = new THREE.PlaneGeometry(CITY_HALF * 2, CITY_HALF * 2);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({ map: groundTexture(), roughness: 0.95, metalness: 0 });
    const ground = new THREE.Mesh(geo, mat);
    ground.receiveShadow = false;
    this.scene.add(ground);
    this.ground = ground;
  }

  _buildOcean() {
    const geo = new THREE.PlaneGeometry(1100, 1100);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({ map: waterTexture(), roughness: 0.35, metalness: 0.1, transparent: true, opacity: 0.96 });
    const water = new THREE.Mesh(geo, mat);
    water.position.y = -0.45;
    this.scene.add(water);
    this.water = water;
    this.waterMat = mat;
  }

  _inClear(x0, z0, x1, z1) {
    for (const b of CLEAR_BLOCKS) {
      if (x0 >= b[0] && z0 >= b[1] && x1 <= b[2] && z1 <= b[3]) return true;
    }
    return false;
  }

  _buildBuildings() {
    const rng = this.rng;
    const winTex = windowTexture();
    const geo = new THREE.BoxGeometry(1, 1, 1);
    geo.translate(0, 0.5, 0);
    const classes = [
      { min: 8, max: 15, rep: [2, 2], list: [] },
      { min: 15, max: 30, rep: [2, 4], list: [] },
      { min: 30, max: 46, rep: [2, 7], list: [] },
    ];
    for (let i = 0; i < ROADS.length - 1; i++) {
      for (let j = 0; j < ROADS.length - 1; j++) {
        const x0 = ROADS[i] + ROAD_HALF + 3;
        const z0 = ROADS[j] + ROAD_HALF + 3;
        const x1 = ROADS[i + 1] - ROAD_HALF - 3;
        const z1 = ROADS[j + 1] - ROAD_HALF - 3;
        if (this._inClear(x0, z0, x1, z1)) continue;
        const cx = (x0 + x1) / 2;
        const cz = (z0 + z1) / 2;
        const n = rng() < 0.55 ? 1 : 2;
        for (let k = 0; k < n; k++) {
          const w = range(rng, 10, 17);
          const d = range(rng, 10, 17);
          const h = range(rng, 8, 46);
          const bx = n === 1 ? cx : cx + (k === 0 ? -5 : 5);
          const bz = n === 1 ? cz : cz + (k === 0 ? -4 : 4);
          const cls = h < 15 ? classes[0] : h < 30 ? classes[1] : classes[2];
          cls.list.push({ x: bx, z: bz, w, d, h, color: pick(rng, PALETTE) });
          this.colliders.push({ x: bx, z: bz, hx: w / 2, hz: d / 2 });
          this.buildings.push({ x: bx, z: bz, w, d, h });
        }
      }
    }
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    classes.forEach((cls) => {
      if (cls.list.length === 0) return;
      const tex = winTex.clone();
      tex.needsUpdate = true;
      tex.repeat.set(cls.rep[0], cls.rep[1]);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, metalness: 0.05 });
      const mesh = new THREE.InstancedMesh(geo, mat, cls.list.length);
      cls.list.forEach((b, idx) => {
        dummy.position.set(b.x, 0, b.z);
        dummy.scale.set(b.w, b.h, b.d);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(idx, dummy.matrix);
        mesh.setColorAt(idx, color.setHex(b.color));
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      this.scene.add(mesh);
    });
  }

  _buildPalms() {
    const rng = this.rng;
    const spots = [];
    for (const r of ROADS) {
      for (let d = -150; d <= 150; d += 40) {
        if (rng() < 0.6) spots.push({ x: r + 8.5, z: d });
        if (rng() < 0.6) spots.push({ x: d, z: r + 8.5 });
      }
    }
    const trunkGeo = new THREE.CylinderGeometry(0.18, 0.3, 6, 6);
    trunkGeo.translate(0, 3, 0);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8a6a42, roughness: 1 });
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, spots.length);
    const crownGeo = new THREE.ConeGeometry(2.4, 2.2, 7);
    crownGeo.translate(0, 6.8, 0);
    const crownMat = new THREE.MeshStandardMaterial({ color: 0x2f8f4e, roughness: 0.9, flatShading: true });
    const crowns = new THREE.InstancedMesh(crownGeo, crownMat, spots.length);
    const dummy = new THREE.Object3D();
    spots.forEach((s, i) => {
      dummy.position.set(s.x, 0, s.z);
      dummy.rotation.set(0, rng() * Math.PI * 2, 0);
      dummy.scale.setScalar(range(rng, 0.85, 1.25));
      dummy.updateMatrix();
      trunks.setMatrixAt(i, dummy.matrix);
      crowns.setMatrixAt(i, dummy.matrix);
    });
    trunks.instanceMatrix.needsUpdate = true;
    crowns.instanceMatrix.needsUpdate = true;
    this.scene.add(trunks);
    this.scene.add(crowns);
  }

  _buildStreetlights() {
    const spots = [];
    for (const r of ROADS) {
      for (let d = -140; d <= 140; d += 80) {
        spots.push({ x: r + 7.2, z: d });
      }
    }
    const poleGeo = new THREE.CylinderGeometry(0.09, 0.12, 7, 5);
    poleGeo.translate(0, 3.5, 0);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x2c2f33, roughness: 0.6, metalness: 0.5 });
    const poles = new THREE.InstancedMesh(poleGeo, poleMat, spots.length);
    const headGeo = new THREE.SphereGeometry(0.28, 8, 6);
    headGeo.translate(0, 7.1, 0);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xffe9a8, emissive: 0xffdf80, emissiveIntensity: 0.55, roughness: 0.4 });
    const heads = new THREE.InstancedMesh(headGeo, headMat, spots.length);
    const dummy = new THREE.Object3D();
    spots.forEach((s, i) => {
      dummy.position.set(s.x, 0, s.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      poles.setMatrixAt(i, dummy.matrix);
      heads.setMatrixAt(i, dummy.matrix);
    });
    poles.instanceMatrix.needsUpdate = true;
    heads.instanceMatrix.needsUpdate = true;
    this.scene.add(poles);
    this.scene.add(heads);
  }

  _box(w, h, d, color, x, y, z, opts = {}) {
    const mat = new THREE.MeshStandardMaterial({ color, roughness: opts.rough ?? 0.85, metalness: opts.metal ?? 0.05 });
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    if (opts.ry) m.rotation.y = opts.ry;
    this.scene.add(m);
    if (opts.collide) this.colliders.push({ x, z, hx: w / 2, hz: d / 2 });
    return m;
  }

  _sign(text, bg, fg, w, x, y, z, ry = 0) {
    const mat = new THREE.MeshStandardMaterial({ map: signTexture(text, bg, fg), roughness: 0.7, emissive: 0xffffff, emissiveIntensity: 0.12, emissiveMap: signTexture(text, bg, fg) });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 4), mat);
    m.position.set(x, y, z);
    m.rotation.y = ry;
    this.scene.add(m);
    return m;
  }

  _buildLandmarks() {
    // Rico's Garage — low workshop with a sign and an open forecourt.
    this._box(20, 7, 12, 0xb8452f, -118, 3.5, 104, { collide: true });
    this._box(20, 0.6, 12, 0x3a3a3a, -118, 7.3, 104, {});
    this._sign("RICO'S GARAGE", '#20242a', '#ffb347', 16, -118, 5.2, 97.8, 0);
    // Solara Bank — wide pale building with columns at the intersection.
    this._box(18, 12, 12, 0xe8e0c8, -56, 6, -96, { collide: true });
    for (let k = -2; k <= 2; k++) {
      this._box(1, 10, 1, 0xf5efdd, -56 + k * 3.4, 5, -89.5, {});
    }
    this._sign('SOLARA BANK', '#1c2f4a', '#ffd98a', 14, -56, 10.5, -89.8, 0);
    // Safehouse — small coral house with a pyramid roof.
    this._box(9, 5, 8, 0xd98a6a, 138, 2.5, 76, { collide: true });
    const roof = new THREE.Mesh(new THREE.ConeGeometry(6.5, 3.4, 4), new THREE.MeshStandardMaterial({ color: 0x8a4a3a, roughness: 0.9, flatShading: true }));
    roof.position.set(138, 6.7, 76);
    roof.rotation.y = Math.PI / 4;
    this.scene.add(roof);
    // The Pier — wooden deck reaching east into the water, with posts.
    const deckMat = new THREE.MeshStandardMaterial({ color: 0x9a7a52, roughness: 1 });
    const deck = new THREE.Mesh(new THREE.BoxGeometry(26, 0.5, 12), deckMat);
    deck.position.set(172, 0.1, -40);
    this.scene.add(deck);
    for (let k = 0; k < 5; k++) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 2.4, 6), deckMat);
      post.position.set(162 + k * 5, 0.6, -46.5);
      this.scene.add(post);
      const post2 = post.clone();
      post2.position.set(162 + k * 5, 0.6, -33.5);
      this.scene.add(post2);
    }
    // Marina East — boardwalk + three moored boats.
    const walk = new THREE.Mesh(new THREE.BoxGeometry(30, 0.4, 10), new THREE.MeshStandardMaterial({ color: 0xc9b48a, roughness: 1 }));
    walk.position.set(112, 0.1, 30);
    this.scene.add(walk);
    const boatColors = [0xe8e8e8, 0x4a90c9, 0xd94a4a];
    boatColors.forEach((c, i) => {
      const hull = new THREE.Mesh(new THREE.BoxGeometry(7, 1.4, 2.6), new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 }));
      hull.position.set(140 + i * 3, -0.1, 18 + i * 8);
      hull.rotation.y = 0.25;
      this.scene.add(hull);
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 6, 5), new THREE.MeshStandardMaterial({ color: 0x888888 }));
      mast.position.set(140 + i * 3, 3, 18 + i * 8);
      this.scene.add(mast);
    });
    // Coral Junction plaza — a fountain ring.
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 4.5, 0.8, 20), new THREE.MeshStandardMaterial({ color: 0xb8c4c4, roughness: 0.8 }));
    rim.position.set(78, 0.4, 116);
    this.scene.add(rim);
    const pool = new THREE.Mesh(new THREE.CylinderGeometry(3.8, 3.8, 0.9, 20), new THREE.MeshStandardMaterial({ color: 0x3a9ac9, roughness: 0.2, metalness: 0.2 }));
    pool.position.set(78, 0.45, 116);
    this.scene.add(pool);
  }

  // Circle (x,z,r) vs building AABBs: push the circle out. Returns corrected x,z.
  collideCircle(x, z, r) {
    for (const b of this.colliders) {
      const cx = Math.max(b.x - b.hx, Math.min(x, b.x + b.hx));
      const cz = Math.max(b.z - b.hz, Math.min(z, b.z + b.hz));
      const dx = x - cx;
      const dz = z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 < 1e-8) {
          // centre inside the box: push out along the smallest penetration axis
          const px = b.hx + r - Math.abs(x - b.x);
          const pz = b.hz + r - Math.abs(z - b.z);
          if (px < pz) x = b.x + (x < b.x ? -(b.hx + r) : b.hx + r);
          else z = b.z + (z < b.z ? -(b.hz + r) : b.hz + r);
        } else {
          const d = Math.sqrt(d2);
          x = cx + (dx / d) * r;
          z = cz + (dz / d) * r;
        }
      }
    }
    return { x, z };
  }

  isOnRoad(x, z) {
    for (const r of ROADS) {
      if (Math.abs(x - r) <= ROAD_HALF + 0.5 || Math.abs(z - r) <= ROAD_HALF + 0.5) return true;
    }
    return false;
  }

  update(dt, t) {
    if (this.waterMat && this.waterMat.map) {
      this.waterMat.map.offset.x += dt * 0.008;
      this.waterMat.map.offset.y += dt * 0.005;
    }
  }
}
