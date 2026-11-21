// minimap.js — the HUD minimap, centred on Marlo. Zoom cycles 1x / 2x / 4x.
// The ocean is drawn first and the land on top of it, so the sea is never
// painted over by the city base.
import { clamp } from './util.js';

const SIZE = 180;
const WORLD = 360; // world span shown at 1x

export function drawMinimap(G) {
  const canvas = document.getElementById('minimap');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const zoom = G.mapZoom;
  const scale = (SIZE / WORLD) * zoom;
  const px = (wx) => SIZE / 2 + (wx - G.player.x) * scale;
  const pz = (wz) => SIZE / 2 + (wz - G.player.z) * scale;

  // Ocean first (the whole canvas is sea).
  ctx.fillStyle = '#0e4d8a';
  ctx.fillRect(0, 0, SIZE, SIZE);
  // Land: the city ground rect [-180, 175].
  ctx.fillStyle = '#3d3a44';
  ctx.fillRect(px(-180), pz(-180), (175 - -180) * scale, (175 - -180) * scale);
  // Beach strips.
  ctx.fillStyle = '#c9b183';
  ctx.fillRect(px(160), pz(-180), 15 * scale, 355 * scale);
  ctx.fillRect(px(-180), pz(160), 355 * scale, 15 * scale);
  // Roads.
  ctx.strokeStyle = '#17171c';
  ctx.lineWidth = Math.max(1, 7 * scale);
  for (const r of [-160, -120, -80, -40, 0, 40, 80, 120, 160]) {
    ctx.beginPath(); ctx.moveTo(px(r), pz(-180)); ctx.lineTo(px(r), pz(175)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(px(-180), pz(r)); ctx.lineTo(px(175), pz(r)); ctx.stroke();
  }
  // Buildings.
  ctx.fillStyle = '#8d84a8';
  for (const b of G.city.colliders) {
    const w = (b.maxX - b.minX) * scale;
    const h = (b.maxZ - b.minZ) * scale;
    if (w < 1 || h < 1) continue;
    ctx.fillRect(px(b.minX), pz(b.minZ), w, h);
  }
  // Pier.
  ctx.fillStyle = '#8a6a42';
  ctx.fillRect(px(148), pz(-46), 42 * scale, 12 * scale);
  // Mission beacon.
  if (G.beacon) {
    const bx = px(G.beacon.position.x);
    const bz = pz(G.beacon.position.z);
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.arc(bx, bz, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#7a5a00';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  // Enemies (red).
  ctx.fillStyle = '#ff3b30';
  for (const e of G.enemies) {
    if (e.dead) continue;
    ctx.beginPath();
    ctx.arc(px(e.x), pz(e.z), 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Police (blue).
  ctx.fillStyle = '#4fc3ff';
  for (const c of G.police) {
    if (c.wrecked) continue;
    ctx.beginPath();
    ctx.arc(px(c.x), pz(c.z), 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Player (yellow, with a heading tick).
  const cx = SIZE / 2;
  const cz = SIZE / 2;
  ctx.fillStyle = '#ffe14d';
  ctx.beginPath();
  ctx.arc(cx, cz, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#7a5a00';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  const hx = Math.sin(G.player.heading);
  const hz = Math.cos(G.player.heading);
  ctx.strokeStyle = '#ffe14d';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, cz);
  ctx.lineTo(cx + hx * 9, cz + hz * 9);
  ctx.stroke();
  // North tick.
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText('N', SIZE / 2 - 4, 12);
}
