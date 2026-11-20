// minimap.js — the corner minimap for Solara Bay.
// Sea-blue background (the ocean is never painted over by the city),
// city slab, roads, buildings, Marlo's arrow, cars, police, Vipers and
// the mission beacon. Z zooms in, X zooms out across 1x / 2x / 4x.

import { ROAD_LINES } from './city.js';

export function createMinimap(world) {
  const canvas = document.getElementById('minimap');
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const minimap = { canvas, zoom: 1 };

  function worldToMap(x, z) {
    const p = world.player;
    const half = 180 / minimap.zoom;
    const mx = ((x - (p.x - half)) / (half * 2)) * W;
    const my = ((z - (p.z - half)) / (half * 2)) * H;
    return { x: mx, y: my };
  }

  minimap.draw = function () {
    if (!ctx) return;
    const p = world.player;
    // Ocean first: the whole minimap is sea.
    ctx.fillStyle = '#1d6fb8';
    ctx.fillRect(0, 0, W, H);
    // City slab.
    const c0 = worldToMap(-180, -180);
    const c1 = worldToMap(180, 180);
    ctx.fillStyle = '#43434a';
    ctx.fillRect(c0.x, c0.y, c1.x - c0.x, c1.y - c0.y);
    // Roads.
    ctx.strokeStyle = '#2f2f36';
    ctx.lineWidth = Math.max(2, 5 * (minimap.zoom / 2));
    for (const c of ROAD_LINES) {
      const a = worldToMap(c, -180);
      const b = worldToMap(c, 180);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      const d = worldToMap(-180, c);
      const e = worldToMap(180, c);
      ctx.beginPath();
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(e.x, e.y);
      ctx.stroke();
    }
    // Buildings as small blocks.
    ctx.fillStyle = '#8d7d6b';
    for (const col of world.colliders) {
      const a = worldToMap(col.minX, col.minZ);
      const b = worldToMap(col.maxX, col.maxZ);
      const w = Math.max(1.5, b.x - a.x);
      const h = Math.max(1.5, b.y - a.y);
      ctx.fillRect(a.x, a.y, w, h);
    }
    // Mission beacon.
    if (world.beacon && world.beacon.visible) {
      const b = worldToMap(world.beacon.position.x, world.beacon.position.z);
      ctx.fillStyle = '#ffd23e';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#7a5c00';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    // Parked / traffic cars (grey dots), police (blue).
    ctx.fillStyle = '#c2c2c2';
    for (const car of world.cars) {
      if (car.wrecked || car.kind === 'police') continue;
      const m = worldToMap(car.x, car.z);
      ctx.fillRect(m.x - 1.5, m.y - 1.5, 3, 3);
    }
    ctx.fillStyle = '#2244ff';
    for (const car of world.police.cars) {
      if (car.wrecked) continue;
      const m = worldToMap(car.x, car.z);
      ctx.fillRect(m.x - 2, m.y - 2, 4, 4);
    }
    // Vipers (red).
    ctx.fillStyle = '#ff2a2a';
    for (const v of world.vipers) {
      if (!v.alive) continue;
      const m = worldToMap(v.x, v.z);
      ctx.beginPath();
      ctx.arc(m.x, m.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Marlo: a white arrow pointing along his heading.
    const m = worldToMap(p.x, p.z);
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.rotate(Math.atan2(Math.sin(p.heading), -Math.cos(p.heading)) + Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 5);
    ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // Zoom label.
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '11px monospace';
    ctx.fillText(minimap.zoom + 'x', 6, H - 6);
  };

  minimap.zoomIn = function () {
    minimap.zoom = minimap.zoom >= 4 ? 4 : minimap.zoom * 2;
    world.mapZoom = minimap.zoom;
  };

  minimap.zoomOut = function () {
    minimap.zoom = minimap.zoom <= 1 ? 1 : minimap.zoom / 2;
    world.mapZoom = minimap.zoom;
  };

  world.minimap = minimap;
  world.mapZoom = 1;
  return minimap;
}
