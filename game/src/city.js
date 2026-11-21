// city.js — world geometry for Solara Bay: ground, sea, beach, roads,
// buildings with lit windows, palms, streetlights, crosswalks, pier,
// marina, bank, garage, safehouse, and the mission beacon.
// Coordinates: x east, z south. Roads on a 40 m grid at -160..160.
// Land covers [-180, 175]; the sea shows beyond x/z > 175 and around it.
import * as THREE from 'three';
import { clamp, randRange } from './util.js';

const ROADS = [-160, -120, -80, -40, 0, 40, 80, 120, 160];
const BLOCKS = [-140, -100, -60, -20, 20, 60, 100, 140];
const LAND_MIN = -180;
const LAND_MAX = 175;

// Places that must stay clear of random buildings: [x, z, radius].
const CLEAR = [
  [-118, 116, 16], // Rico's Garage
  [-40, -80, 14], // bank plaza / vault
  [138, 76, 12], // safehouse
  [78, 116, 11], // Coral Junction
  [24, 26, 7], // M1 coupe
  [44, 124, 7], // parked car
  [86, -46, 7], // parked car
  [-46, 8, 7], // getaway car
  [126, 48, 9], // boss coupe
  [100, 36, 10], // Marina East vipers
  [158, -40, 10], // pier
];

function makeGroundTexture() {
  const S = 1024;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const g = c.getContext('2d');
  const toPx = (v) => ((v - LAND_MIN) / (LAND_MAX - LAND_MIN)) * S;
  // Land base: warm concrete.
  g.fillStyle = '#8a7a63';
  g.fillRect(0, 0, S, S);
  // Beach strips along the east (x 160..175) and south (z 160..175) edges.
  g.fillStyle = '#e0c98f';
  g.fillRect(toPx(160), 0, toPx(175) - toPx(160), S);
  g.fillRect(0, toPx(160), S, toPx(175) - toPx(160));
  // City blocks: slightly varied concrete + a few green parks.
  for (let i = 0; i < BLOCKS.length; i++) {
    for (let j = 0; j < BLOCKS.length; j++) {
      const bx = BLOCKS[i];
      const bz = BLOCKS[j];
      const x0 = toPx(bx - 20);
      const z0 = toPx(bz - 20);
      const w = toPx(bx + 20) - x0;
      if ((i * 7 + j * 13) % 11 === 0) {
        g.fillStyle = '#5d7d4a'; // park
      } else if ((i + j) % 3 === 0) {
        g.fillStyle = '#7d7468';
      } else {
        g.fillStyle = '#84796a';
      }
      g.fillRect(x0, z0, w, w);
    }
  }
  // Roads: dark asphalt bands, 10 m wide, with sidewalks.
  g.fillStyle = '#3a3a40';
  for (const r of ROADS) {
    g.fillRect(toPx(r - 5), 0, toPx(r + 5) - toPx(r - 5), S);
    g.fillRect(0, toPx(r - 5), S, toPx(r + 5) - toPx(r - 5));
  }
  // Sidewalk edges (light strips just outside the asphalt).
  g.fillStyle = '#a89a86';
  for (const r of ROADS) {
    g.fillRect(toPx(r - 7), 0, toPx(r - 5) - toPx(r - 7), S);
    g.fillRect(toPx(r + 5), 0, toPx(r + 7) - toPx(r + 5), S);
    g.fillRect(0, toPx(r - 7), S, toPx(r - 5) - toPx(r - 7));
    g.fillRect(0, toPx(r + 5), S, toPx(r + 7) - toPx(r + 5));
  }
  // Dashed centre lines.
  g.fillStyle = '#e8c33a';
  for (const r of ROADS) {
    for (let v = -170; v < 175; v += 12) {
      g.fillRect(toPx(r) - 1.5, toPx(v), 3, toPx(v + 5) - toPx(v));
      g.fillRect(toPx(v), toPx(r) - 1.5, toPx(v + 5) - toPx(v), 3);
    }
  }
  // Crosswalks at every intersection.
  g.fillStyle = 'rgba(255,255,255,0.85)';
  for (const rx of ROADS) {
    for (const rz of ROADS) {
      for (let k = -4; k <= 4; k += 2) {
        g.fillRect(toPx(rx + k - 0.6), toPx(rz - 7), toPx(rx + k + 0.6) - toPx(rx + k - 0.6), toPx(rz - 5) - toPx(rz - 7));
        g.fillRect(toPx(rx + k - 0.6), toPx(rz + 5), toPx(rx + k + 0.6) - toPx(rx + k - 0.6), toPx(rz + 7) - toPx(rz + 5));
        g.fillRect(toPx(rx - 7), toPx(rz + k - 0.6), toPx(rx - 5) - toPx(rx - 7), toPx(rz + k + 0.6) - toPx(rz + k - 0.6));
        g.fillRect(toPx(rx + 5), toPx(rz + k - 0.6), toPx(rx + 7) - toPx(rx + 5), toPx(rz + k + 0.6) - toPx(rz + k - 0.6));
      }
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function makeWindowTexture(seed, litRatio) {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const g = c.getContext('2d');
  let s = seed;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  // Facade base.
  const bases = ['#5a4a6e', '#6e4a3a', '#3a4a5e', '#5e5a3a'];
  g.fillStyle = bases[seed % bases.length];
  g.fillRect(0, 0, S, S);
  // Window grid: 8 cols x 12 rows.
  for (let row = 0; row < 12; row++) {
    for (let col = 0; col < 8; col++) {
      const x = 8 + col * 30;
      const y = 8 + row * 20;
      if (rnd() < litRatio) {
        g.fillStyle = rnd() < 0.7 ? '#ffd97a' : '#ffb85e';
      } else {
        g.fillStyle = '#1c2438';
      }
      g.fillRect(x, y, 20, 12);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeSeaTexture() {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#1d6fb8';
  g.fillRect(0, 0, S, S);
  g.strokeStyle = 'rgba(255,255,255,0.25)';
  g.lineWidth = 2;
  for (let i = 0; i < 40; i++) {
    const y = (i * 37) % S;
    const x = (i * 53) % S;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + 20, y + 6, x + 44, y);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 6);
  return tex;
}

function scaleBoxUVs(geo, su, sv) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  }
  return geo;
}

export function buildCity(G) {
  const scene = G.scene;
  const rng = G.rng;
  const colliders = [];
  const buildings = [];

  // --- Ground (land) ---
  const groundMat = new THREE.MeshLambertMaterial({ map: makeGroundTexture() });
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(LAND_MAX - LAND_MIN, LAND_MAX - LAND_MIN),
    groundMat,
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set((LAND_MIN + LAND_MAX) / 2, 0, (LAND_MIN + LAND_MAX) / 2);
  scene.add(ground);

  // --- Sea (visible water around the land, animated) ---
  const seaTex = makeSeaTexture();
  const seaMat = new THREE.MeshLambertMaterial({ map: seaTex, transparent: true, opacity: 0.94 });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), seaMat);
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, -0.45, 0);
  scene.add(sea);
  G.seaTex = seaTex;

  // --- Buildings (seeded, on blocks, clear of roads and special sites) ---
  const winTexes = [makeWindowTexture(11, 0.55), makeWindowTexture(23, 0.4), makeWindowTexture(37, 0.65)];
  const winMats = winTexes.map((t) => new THREE.MeshLambertMaterial({ map: t }));
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x2e2a33 });
  const isClear = (x, z, pad) => {
    for (const [cx, cz, r] of CLEAR) {
      if (Math.abs(x - cx) < r + pad && Math.abs(z - cz) < r + pad) return false;
    }
    return true;
  };
  const marinaRect = (x, z) => x > 86 && x < 144 && z > 22 && z < 64;
  for (const bx of BLOCKS) {
    for (const bz of BLOCKS) {
      if (marinaRect(bx, bz)) continue;
      const n = 1 + Math.floor(rng() * 2.4); // 1..3 buildings per block
      for (let k = 0; k < n; k++) {
        const w = randRange(rng, 12, 22);
        const d = randRange(rng, 12, 22);
        const h = randRange(rng, 8, 42);
        const ox = randRange(rng, -2, 2) + (k === 0 ? 0 : randRange(rng, -9, 9));
        const oz = randRange(rng, -2, 2) + (k === 0 ? 0 : randRange(rng, -9, 9));
        const x = bx + ox;
        const z = bz + oz;
        if (!isClear(x, z, Math.max(w, d) / 2 + 1)) continue;
        const mat = winMats[Math.floor(rng() * winMats.length)];
        const geo = scaleBoxUVs(new THREE.BoxGeometry(w, h, d), Math.max(1, w / 9), Math.max(1, h / 9));
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, h / 2, z);
        scene.add(mesh);
        const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.5, d + 0.6), roofMat);
        roof.position.set(x, h + 0.25, z);
        scene.add(roof);
        colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, height: h });
        buildings.push(mesh);
      }
    }
  }

  // --- Bank (vault plaza at -40,-80; bank block behind it) ---
  const bankMat = new THREE.MeshLambertMaterial({ color: 0xd8c9a3 });
  const bank = new THREE.Mesh(new THREE.BoxGeometry(22, 12, 12), bankMat);
  bank.position.set(-40, 6, -94);
  scene.add(bank);
  const bankRoof = new THREE.Mesh(new THREE.BoxGeometry(23, 1, 13), roofMat);
  bankRoof.position.set(-40, 12.5, -94);
  scene.add(bankRoof);
  const bankSignMat = new THREE.MeshLambertMaterial({ color: 0x1e3a6e, emissive: 0x1e3a6e, emissiveIntensity: 0.4 });
  const bankSign = new THREE.Mesh(new THREE.BoxGeometry(16, 2.2, 0.6), bankSignMat);
  bankSign.position.set(-40, 9.5, -87.8);
  scene.add(bankSign);
  colliders.push({ minX: -51, maxX: -29, minZ: -100, maxZ: -88, height: 12 });

  // --- Rico's Garage (south-west) ---
  const garageMat = new THREE.MeshLambertMaterial({ color: 0xb3541e });
  const garage = new THREE.Mesh(new THREE.BoxGeometry(18, 7, 12), garageMat);
  garage.position.set(-128, 3.5, 116);
  scene.add(garage);
  const garageRoof = new THREE.Mesh(new THREE.BoxGeometry(19, 0.8, 13), roofMat);
  garageRoof.position.set(-128, 7.4, 116);
  scene.add(garageRoof);
  colliders.push({ minX: -137, maxX: -119, minZ: 110, maxZ: 122, height: 7 });

  // --- Safehouse (small house east of the delivery point) ---
  const houseMat = new THREE.MeshLambertMaterial({ color: 0xe8dcc0 });
  const house = new THREE.Mesh(new THREE.BoxGeometry(9, 6, 8), houseMat);
  house.position.set(148, 3, 78);
  scene.add(house);
  const houseRoof = new THREE.Mesh(new THREE.ConeGeometry(7, 3.5, 4), new THREE.MeshLambertMaterial({ color: 0x8a3a2a }));
  houseRoof.position.set(148, 7.7, 78);
  houseRoof.rotation.y = Math.PI / 4;
  scene.add(houseRoof);
  colliders.push({ minX: 143.5, maxX: 152.5, minZ: 74, maxZ: 82, height: 6 });

  // --- Pier (wooden deck east over the sea at z=-40) ---
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x8a6a42 });
  const pier = new THREE.Mesh(new THREE.BoxGeometry(42, 0.5, 12), pierMat);
  pier.position.set(169, -0.1, -40);
  scene.add(pier);
  const pierPostMat = new THREE.MeshLambertMaterial({ color: 0x5a4028 });
  for (let px = 152; px <= 188; px += 12) {
    for (const pz of [-45, -35]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 3, 6), pierPostMat);
      post.position.set(px, -1.2, pz);
      scene.add(post);
    }
  }
  // Pier end kiosk.
  const kiosk = new THREE.Mesh(new THREE.BoxGeometry(5, 4, 5), new THREE.MeshLambertMaterial({ color: 0x4a6e8a }));
  kiosk.position.set(184, 2, -44);
  scene.add(kiosk);
  colliders.push({ minX: 181.5, maxX: 186.5, minZ: -46.5, maxZ: -41.5, height: 4 });

  // --- Marina: docks + moored boats ---
  const dockMat = new THREE.MeshLambertMaterial({ color: 0x7a5a38 });
  for (const dz of [30, 44]) {
    const dock = new THREE.Mesh(new THREE.BoxGeometry(26, 0.4, 3), dockMat);
    dock.position.set(116, 0.1, dz);
    scene.add(dock);
  }
  const boatMat = new THREE.MeshLambertMaterial({ color: 0xf0f0e8 });
  const boatMat2 = new THREE.MeshLambertMaterial({ color: 0x3a6ea8 });
  for (let i = 0; i < 4; i++) {
    const boat = new THREE.Mesh(new THREE.BoxGeometry(7, 1.4, 2.6), i % 2 ? boatMat : boatMat2);
    boat.position.set(104 + i * 9, -0.1, 36 + (i % 2) * 8);
    boat.rotation.y = (i % 2 ? 0.3 : -0.2);
    scene.add(boat);
  }

  // --- Palms (beach + avenues) ---
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6e4a2a });
  const frondMat = new THREE.MeshLambertMaterial({ color: 0x2e7d32 });
  const palmSpots = [];
  for (let i = 0; i < 14; i++) palmSpots.push([166 + rng() * 4, -140 + i * 22 + rng() * 6]);
  for (let i = 0; i < 10; i++) palmSpots.push([-140 + i * 30 + rng() * 6, 166 + rng() * 4]);
  for (const [px, pz] of palmSpots) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 7, 6), trunkMat);
    trunk.position.set(px, 3.5, pz);
    trunk.rotation.z = randRange(rng, -0.08, 0.08);
    scene.add(trunk);
    const canopy = new THREE.Mesh(new THREE.ConeGeometry(2.6, 2.2, 7), frondMat);
    canopy.position.set(px, 7.6, pz);
    scene.add(canopy);
  }

  // --- Streetlights (emissive heads, no point lights for perf) ---
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x2a2a2e });
  const lampMat = new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0xffdf80, emissiveIntensity: 0.9 });
  for (const rx of [-120, -40, 40, 120]) {
    for (const rz of [-120, -40, 40, 120]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 6, 5), poleMat);
      pole.position.set(rx + 6, 3, rz + 6);
      scene.add(pole);
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 0.4), lampMat);
      lamp.position.set(rx + 6, 6.1, rz + 6);
      scene.add(lamp);
    }
  }

  // --- Mission beacon (tall light pillar, moved by missions.js) ---
  const beaconMat = new THREE.MeshBasicMaterial({
    color: 0xffd23f, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false,
  });
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.4, 60, 12, 1, true), beaconMat);
  beacon.position.set(24, 30, 26);
  scene.add(beacon);
  const beaconBaseMat = new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.5 });
  const beaconBase = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 0.3, 16), beaconBaseMat);
  beaconBase.position.set(24, 0.15, 26);
  scene.add(beaconBase);
  G.beacon = beacon;
  G.beaconBase = beaconBase;

  G.city = { colliders, buildings };
  return G.city;
}

export function setBeacon(G, x, z) {
  if (!G.beacon) return;
  G.beacon.position.x = x;
  G.beacon.position.z = z;
  G.beaconBase.position.x = x;
  G.beaconBase.position.z = z;
}

export function updateCity(G, dt) {
  if (G.seaTex) {
    G.seaTex.offset.x += dt * 0.008;
    G.seaTex.offset.y += dt * 0.005;
  }
  if (G.beacon) {
    const s = 1 + Math.sin(G.elapsed * 3) * 0.08;
    G.beacon.scale.set(s, 1, s);
  }
}

// Ray vs axis-aligned building boxes. Returns nearest hit distance or Infinity.
export function rayBuildings(G, ox, oy, oz, dx, dy, dz, maxDist) {
  let best = Infinity;
  for (const b of G.city.colliders) {
    if (b.height < oy && dy <= 0) {
      // Ray starts above the roof and goes down: it can still hit the roof.
    }
    let tmin = 0;
    let tmax = maxDist;
    // X slab
    if (Math.abs(dx) < 1e-9) {
      if (ox < b.minX || ox > b.maxX) continue;
    } else {
      let t1 = (b.minX - ox) / dx;
      let t2 = (b.maxX - ox) / dx;
      if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) continue;
    }
    // Z slab
    if (Math.abs(dz) < 1e-9) {
      if (oz < b.minZ || oz > b.maxZ) continue;
    } else {
      let t1 = (b.minZ - oz) / dz;
      let t2 = (b.maxZ - oz) / dz;
      if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) continue;
    }
    // Y slab (0..height)
    if (Math.abs(dy) < 1e-9) {
      if (oy < 0 || oy > b.height) continue;
    } else {
      let t1 = (0 - oy) / dy;
      let t2 = (b.height - oy) / dy;
      if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) continue;
    }
    if (tmin >= 0 && tmin < best) best = tmin;
  }
  return best;
}

// Resolve a circle (x,z,r) against building AABBs: push out, return true if hit.
export function collideBuildings(G, x, z, r) {
  let hit = false;
  let px = x;
  let pz = z;
  for (const b of G.city.colliders) {
    const nx = clamp(px, b.minX - r, b.maxX + r);
    const nz = clamp(pz, b.minZ - r, b.maxZ + r);
    const dx = px - nx;
    const dz = pz - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      hit = true;
      if (d2 > 1e-9) {
        const d = Math.sqrt(d2);
        px = nx + (dx / d) * r;
        pz = nz + (dz / d) * r;
      } else {
        // Centre inside the expanded box: push out along the smallest axis.
        const pushL = px - (b.minX - r);
        const pushR = (b.maxX + r) - px;
        const pushU = pz - (b.minZ - r);
        const pushD = (b.maxZ + r) - pz;
        const m = Math.min(pushL, pushR, pushU, pushD);
        if (m === pushL) px = b.minX - r;
        else if (m === pushR) px = b.maxX + r;
        else if (m === pushU) pz = b.minZ - r;
        else pz = b.maxZ + r;
      }
    }
  }
  return { hit, x: px, z: pz };
}

export function clampToWorld(x, z) {
  return { x: clamp(x, -178, 178), z: clamp(z, -178, 178) };
}
