// city.js — Solara Bay itself: ground, roads, buildings with lit windows,
// palms, streetlights, beach, ocean, marina, pier and the landmark tower.
// World coordinates in metres, roughly x/z in [-180, 180]. Roads sit on a
// 40 m grid; buildings fill the blocks between them, kept clear of every
// mission point and parked-car spot.
import * as THREE from 'three';
import { mulberry32, clamp, range, pick } from './util.js';

export const ROADS = [-160, -120, -80, -40, 0, 40, 80, 120, 160];
export const WORLD = 180;

// Points that must stay free of buildings (mission spots, parked cars).
const CLEAR = [
  [-118, 116, 14], [78, 116, 14], [-40, -80, 12], [138, 76, 12],
  [24, 26, 10], [126, 48, 10], [-46, 8, 10], [100, 36, 14],
  [158, -40, 12], [44, 124, 9], [86, -46, 9], [-84, 44, 9],
  [124, -84, 9], [-124, -4, 9], [4, 164, 9],
];

function groundTexture(rng) {
  const S = 1024;
  const cv = document.createElement('canvas');
  cv.width = S;
  cv.height = S;
  const g = cv.getContext('2d');
  const px = (x) => ((x + 180) / 360) * S;
  const pw = (m) => (m / 360) * S;
  g.fillStyle = '#83837c';
  g.fillRect(0, 0, S, S);
  // Beach sand along the east and south edges.
  g.fillStyle = '#d9bd85';
  g.fillRect(px(165), 0, pw(15), S);
  g.fillRect(0, px(165), S, pw(15));
  // Park blocks.
  for (let i = 0; i < 64; i++) {
    const bx = ROADS[i % 8];
    const bz = ROADS[Math.floor(i / 8)];
    if (rng() < 0.22) {
      g.fillStyle = '#5d7a4a';
      g.fillRect(px(bx + 5), px(bz + 5), pw(30), pw(30));
    }
  }
  // Roads (dark asphalt) with lighter sidewalks.
  for (const r of ROADS) {
    g.fillStyle = '#a8a89e';
    g.fillRect(px(r - 7), 0, pw(14), S);
    g.fillRect(0, px(r - 7), S, pw(14));
    g.fillStyle = '#2e2e33';
    g.fillRect(px(r - 5), 0, pw(10), S);
    g.fillRect(0, px(r - 5), S, pw(10));
  }
  // Centre dashes.
  g.fillStyle = '#c9a227';
  for (const r of ROADS) {
    for (let m = -170; m < 170; m += 12) {
      g.fillRect(px(r) - 1, px(m), 2, pw(6));
      g.fillRect(px(m), px(r) - 1, pw(6), 2);
    }
  }
  // Crosswalks at every intersection.
  g.fillStyle = '#e8e8e0';
  for (const rx of ROADS) {
    for (const rz of ROADS) {
      for (let k = -2; k <= 2; k++) {
        g.fillRect(px(rx - 4 + k * 1.8), px(rz - 7), pw(1), pw(3));
        g.fillRect(px(rx - 4 + k * 1.8), px(rz + 4), pw(1), pw(3));
        g.fillRect(px(rx - 7), px(rz - 4 + k * 1.8), pw(3), pw(1));
        g.fillRect(px(rx + 4), px(rz - 4 + k * 1.8), pw(3), pw(1));
      }
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function windowTexture(rng, base, litRatio) {
  const cv = document.createElement('canvas');
  cv.width = 128;
  cv.height = 256;
  const g = cv.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 128, 256);
  for (let y = 8; y < 248; y += 22) {
    for (let x = 8; x < 120; x += 18) {
      const lit = rng() < litRatio;
      g.fillStyle = lit ? '#ffd98a' : '#20242e';
      g.fillRect(x, y, 11, 14);
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function waterTexture(rng) {
  const cv = document.createElement('canvas');
  cv.width = 256;
  cv.height = 256;
  const g = cv.getContext('2d');
  g.fillStyle = '#1a5f8a';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 90; i++) {
    g.strokeStyle = `rgba(180, 220, 255, ${0.08 + rng() * 0.2})`;
    g.lineWidth = 1 + rng() * 2;
    g.beginPath();
    const y = rng() * 256;
    g.moveTo(rng() * 256, y);
    g.lineTo(rng() * 256, y + (rng() - 0.5) * 20);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(10, 10);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildCity(scene, rng) {
  const colliders = [];
  const group = new THREE.Group();
  scene.add(group);

  // Ground.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(360, 360),
    new THREE.MeshLambertMaterial({ map: groundTexture(rng) })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = false;
  group.add(ground);

  // Ocean: a big plane below the ground edge, visible past the beach.
  const oceanTex = waterTexture(rng);
  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 900),
    new THREE.MeshLambertMaterial({ map: oceanTex, color: 0x9fc8e8 })
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.y = -0.25;
  group.add(ocean);

  // Marina basin: a calm water pool inside the block east of the marina road.
  const basinTex = waterTexture(rng);
  basinTex.repeat.set(2, 2);
  const basin = new THREE.Mesh(
    new THREE.PlaneGeometry(24, 32),
    new THREE.MeshLambertMaterial({ map: basinTex, color: 0xbfe0f2 })
  );
  basin.rotation.x = -Math.PI / 2;
  basin.position.set(140, 0.06, 60);
  group.add(basin);

  // Window materials.
  const facades = ['#6b6f7a', '#7a6a58', '#5d6b7a', '#8a7a72'].map((c, i) =>
    new THREE.MeshLambertMaterial({
      map: windowTexture(mulberry32(100 + i), c, 0.55),
    })
  );
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x3a3a40 });
  const wallMats = facades.map((f) => [f, f, roofMat, roofMat, f, f]);

  function clearOf(x, z) {
    for (const [cx, cz, r] of CLEAR) {
      const dx = x - cx;
      const dz = z - cz;
      if (dx * dx + dz * dz < r * r) return false;
    }
    return true;
  }

  // Buildings, one to three per block.
  const tints = [0xffffff, 0xffe8c8, 0xd8e8ff, 0xffd8d8, 0xe8ffd8];
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      const bx = ROADS[i];
      const bz = ROADS[j];
      if (rng() < 0.18) continue; // park block
      const n = 1 + Math.floor(rng() * 3);
      for (let k = 0; k < n; k++) {
        const w = range(rng, 8, 16);
        const d = range(rng, 8, 14);
        const x = bx + 5 + w / 2 + rng() * (30 - w);
        const z = bz + 5 + d / 2 + rng() * (30 - d);
        if (!clearOf(x, z)) continue;
        const h = range(rng, 8, 30);
        const geo = new THREE.BoxGeometry(w, h, d);
        const mesh = new THREE.Mesh(geo, wallMats[Math.floor(rng() * wallMats.length)]);
        mesh.material[0].color.setHex(pick(rng, tints));
        mesh.position.set(x, h / 2, z);
        group.add(mesh);
        colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
      }
    }
  }

  // The bank: a low marble building whose vault face is at (-40, -80).
  const bank = new THREE.Mesh(
    new THREE.BoxGeometry(12, 9, 8),
    new THREE.MeshLambertMaterial({ color: 0xd8d2c0 })
  );
  bank.position.set(-40, 4.5, -84);
  group.add(bank);
  colliders.push({ minX: -46, maxX: -34, minZ: -88, maxZ: -80 });

  // Rico's Garage: a low workshop at the south-west.
  const garage = new THREE.Mesh(
    new THREE.BoxGeometry(12, 6, 9),
    new THREE.MeshLambertMaterial({ color: 0x8a4a3a })
  );
  garage.position.set(-126, 3, 116);
  group.add(garage);
  colliders.push({ minX: -132, maxX: -120, minZ: 111.5, maxZ: 120.5 });

  // The safehouse: a small house near the marina road.
  const house = new THREE.Mesh(
    new THREE.BoxGeometry(9, 6, 8),
    new THREE.MeshLambertMaterial({ color: 0x7a8a6a })
  );
  house.position.set(144, 3, 80);
  group.add(house);
  colliders.push({ minX: 139.5, maxX: 148.5, minZ: 76, maxZ: 84 });

  // Landmark tower with a red beacon, east edge near the marina.
  const tower = new THREE.Mesh(
    new THREE.BoxGeometry(10, 62, 10),
    new THREE.MeshLambertMaterial({ color: 0x4a5568 })
  );
  tower.position.set(168, 31, -20);
  group.add(tower);
  colliders.push({ minX: 163, maxX: 173, minZ: -25, maxZ: -15 });
  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(1.2, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xff2222 })
  );
  beacon.position.set(168, 63, -20);
  group.add(beacon);

  // Billboard: SOLARA BAY, on a rooftop near the marina.
  const bcv = document.createElement('canvas');
  bcv.width = 512;
  bcv.height = 128;
  const bg = bcv.getContext('2d');
  bg.fillStyle = '#14202e';
  bg.fillRect(0, 0, 512, 128);
  bg.fillStyle = '#ffd98a';
  bg.font = 'bold 64px sans-serif';
  bg.textAlign = 'center';
  bg.textBaseline = 'middle';
  bg.fillText('SOLARA BAY', 256, 66);
  const billTex = new THREE.CanvasTexture(bcv);
  billTex.colorSpace = THREE.SRGBColorSpace;
  const bill = new THREE.Mesh(
    new THREE.PlaneGeometry(24, 6),
    new THREE.MeshBasicMaterial({ map: billTex })
  );
  bill.position.set(100, 16, 24);
  bill.rotation.y = Math.PI / 4;
  group.add(bill);

  // Palms along the roads and the beach.
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6a4a2a });
  const crownMat = new THREE.MeshLambertMaterial({ color: 0x2e7a3a });
  for (let i = 0; i < 46; i++) {
    const onBeach = rng() < 0.35;
    let x;
    let z;
    if (onBeach) {
      x = rng() < 0.5 ? range(rng, 166, 176) : range(rng, -176, 176);
      z = rng() < 0.5 ? range(rng, 166, 176) : range(rng, -176, 176);
      if (x < 166 && z < 166) continue;
    } else {
      const r = pick(rng, ROADS);
      if (rng() < 0.5) {
        x = r + (rng() < 0.5 ? -6.5 : 6.5);
        z = range(rng, -170, 170);
      } else {
        x = range(rng, -170, 170);
        z = r + (rng() < 0.5 ? -6.5 : 6.5);
      }
    }
    if (!clearOf(x, z)) continue;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 5, 6), trunkMat);
    trunk.position.set(x, 2.5, z);
    group.add(trunk);
    const crown = new THREE.Mesh(new THREE.SphereGeometry(1.9, 8, 6), crownMat);
    crown.scale.y = 0.55;
    crown.position.set(x, 5.4, z);
    group.add(crown);
  }

  // Streetlights along the roads.
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x2a2a2e });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (const r of ROADS) {
    for (let m = -140; m <= 140; m += 40) {
      for (const [x, z] of [[r + 6, m], [m, r + 6]]) {
        if (!clearOf(x, z)) continue;
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 6, 6), poleMat);
        pole.position.set(x, 3, z);
        group.add(pole);
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), lampMat);
        lamp.position.set(x, 6.1, z);
        group.add(lamp);
      }
    }
  }

  // Marina docks and boats.
  const woodMat = new THREE.MeshLambertMaterial({ color: 0x7a5a34 });
  for (const dz of [48, 60, 72]) {
    const dock = new THREE.Mesh(new THREE.BoxGeometry(10, 0.3, 2), woodMat);
    dock.position.set(132, 0.35, dz);
    group.add(dock);
  }
  const boatColors = [0xe8e8e8, 0x3a6a9a];
  for (let i = 0; i < 2; i++) {
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(3, 1, 7), new THREE.MeshLambertMaterial({ color: boatColors[i] }));
    hull.position.y = 0.4;
    boat.add(hull);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 3), new THREE.MeshLambertMaterial({ color: 0xdddddd }));
    cabin.position.y = 1.2;
    boat.add(cabin);
    boat.position.set(140 + i * 8, 0, 52 + i * 12);
    boat.rotation.y = 0.2 * i;
    group.add(boat);
  }

  // The pier: a wooden deck running east into the ocean at z = -40.
  const pier = new THREE.Mesh(new THREE.BoxGeometry(48, 0.25, 6), woodMat);
  pier.position.set(172, 0.28, -40);
  group.add(pier);
  for (let x = 152; x <= 192; x += 8) {
    for (const dz of [-42.5, -37.5]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 3, 6), poleMat);
      post.position.set(x, -0.8, dz);
      group.add(post);
    }
  }

  // Circle-vs-AABB push-out. Returns a corrected {x, z}.
  function resolveCircle(x, z, r) {
    let nx = clamp(x, -178, 178);
    let nz = clamp(z, -178, 178);
    for (const c of colliders) {
      const cx = clamp(nx, c.minX, c.maxX);
      const cz = clamp(nz, c.minZ, c.maxZ);
      const dx = nx - cx;
      const dz = nz - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 > 1e-6) {
          const d = Math.sqrt(d2);
          nx = cx + (dx / d) * r;
          nz = cz + (dz / d) * r;
        } else {
          // Centre inside the box: push out along the smallest penetration.
          const pl = nx - (c.minX - r);
          const pr = (c.maxX + r) - nx;
          const pt = nz - (c.minZ - r);
          const pb = (c.maxZ + r) - nz;
          const m = Math.min(pl, pr, pt, pb);
          if (m === pl) nx = c.minX - r;
          else if (m === pr) nx = c.maxX + r;
          else if (m === pt) nz = c.minZ - r;
          else nz = c.maxZ + r;
        }
      }
    }
    return { x: nx, z: nz };
  }

  function update(dt, t) {
    oceanTex.offset.x = t * 0.008;
    oceanTex.offset.y = t * 0.005;
    basinTex.offset.x = t * 0.012;
    beacon.material.color.setHex(Math.sin(t * 4) > 0 ? 0xff2222 : 0x881111);
  }

  return { colliders, resolveCircle, update };
}
