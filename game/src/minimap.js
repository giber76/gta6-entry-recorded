// minimap.js — the corner minimap for Solara Bay.
// Drawn on a 2D canvas: ocean first (never painted over by the city),
// then the city base, roads, buildings, the mission target, police, Vipers
// and Marlo's arrow. Zoom cycles 1x / 2x / 4x, centred on the player.
import { ROADS, CITY_HALF, DISTRICTS } from './city.js';

export class Minimap {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.zoom = 1;
  }

  cycleIn() {
    this.zoom = this.zoom === 1 ? 2 : 4;
  }

  cycleOut() {
    this.zoom = this.zoom === 4 ? 2 : 1;
  }

  draw(g) {
    const ctx = this.ctx;
    const S = this.canvas.width;
    ctx.clearRect(0, 0, S, S);
    // ocean first — the sea is never painted over by the city base
    ctx.fillStyle = '#2e7fb8';
    ctx.fillRect(0, 0, S, S);
    const span = (CITY_HALF * 2) / this.zoom;
    const cx = g.player.x;
    const cz = g.player.z;
    const toPx = (x, z) => [
      ((x - (cx - span / 2)) / span) * S,
      ((z - (cz - span / 2)) / span) * S,
    ];
    // city base
    const [bx0, bz0] = toPx(-CITY_HALF, -CITY_HALF);
    const [bx1, bz1] = toPx(CITY_HALF, CITY_HALF);
    ctx.fillStyle = '#8a8378';
    ctx.fillRect(bx0, bz0, bx1 - bx0, bz1 - bz0);
    // roads
    ctx.strokeStyle = '#3c3a38';
    ctx.lineWidth = Math.max(1, (12 / span) * S);
    for (const r of ROADS) {
      const [ax, az] = toPx(r, -CITY_HALF);
      const [bx, bz] = toPx(r, CITY_HALF);
      ctx.beginPath();
      ctx.moveTo(ax, az);
      ctx.lineTo(bx, bz);
      ctx.stroke();
      const [cx0, cz0] = toPx(-CITY_HALF, r);
      const [cx1, cz1] = toPx(CITY_HALF, r);
      ctx.beginPath();
      ctx.moveTo(cx0, cz0);
      ctx.lineTo(cx1, cz1);
      ctx.stroke();
    }
    // buildings
    ctx.fillStyle = 'rgba(60,55,48,0.85)';
    for (const b of g.city.buildings) {
      const [x, z] = toPx(b.x - b.w / 2, b.z - b.d / 2);
      const w = (b.w / span) * S;
      const h = (b.d / span) * S;
      if (w < 0.5 || h < 0.5) continue;
      ctx.fillRect(x, z, Math.max(1, w), Math.max(1, h));
    }
    // mission target blip
    const target = this._target(g);
    if (target) {
      const [x, z] = toPx(target.x, target.z);
      ctx.fillStyle = '#ffd23e';
      ctx.beginPath();
      ctx.arc(x, z, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#7a5c00';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    // police (blue) and vipers (red)
    for (const c of g.police.cars) {
      if (c.wrecked) continue;
      const [x, z] = toPx(c.x, c.z);
      ctx.fillStyle = '#3a6bff';
      ctx.beginPath();
      ctx.arc(x, z, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const v of g.vipers) {
      if (!v.alive) continue;
      const [x, z] = toPx(v.x, v.z);
      ctx.fillStyle = '#ff3b30';
      ctx.beginPath();
      ctx.arc(x, z, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // player arrow (centre)
    const [px, pz] = toPx(g.player.x, g.player.z);
    ctx.save();
    ctx.translate(px, pz);
    ctx.rotate(Math.atan2(Math.sin(g.player.heading), Math.cos(g.player.heading)) + Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#1a7a5a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 6);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    // north tick
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = 'bold 11px Arial';
    ctx.fillText('N', 6, 13);
  }

  _target(g) {
    const m = g.missions.mission;
    if (m === 0) return g.missions.stage === 0 ? { x: 24, z: 26 } : DISTRICTS.garage;
    if (m === 1) return null; // rectangle — no single point
    if (m === 2) return g.missions.stage === 0 ? DISTRICTS.pier : DISTRICTS.coral;
    if (m === 3) return DISTRICTS.marina;
    if (m === 4) return g.missions.stage === 0 ? DISTRICTS.bank : DISTRICTS.safehouse;
    if (m === 5) return g.missions.stage === 0 ? { x: 126, z: 48 } : DISTRICTS.garage;
    return null;
  }
}
