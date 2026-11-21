// minimap.js — a 2D canvas minimap in the HUD corner, centred on Marlo.
// The ocean is drawn first (blue), then the land on top of it, so the sea
// is never painted over by the city base. Zoom cycles 1x / 2x / 4x.
import { LAND } from './city.js';

export class Minimap {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.zoom = 1;
  }

  cycleIn() {
    this.zoom = this.zoom === 1 ? 2 : this.zoom === 2 ? 4 : 4;
  }

  cycleOut() {
    this.zoom = this.zoom === 4 ? 2 : this.zoom === 2 ? 1 : 1;
  }

  draw(s) {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const px = s.x;
    const pz = s.z;
    // Metres shown across the map at each zoom.
    const span = this.zoom === 1 ? 420 : this.zoom === 2 ? 210 : 105;
    const scale = W / span;
    const toX = (x) => (x - px) * scale + W / 2;
    const toZ = (z) => (z - pz) * scale + H / 2;
    // Ocean first: the whole view is sea.
    ctx.fillStyle = '#14486e';
    ctx.fillRect(0, 0, W, H);
    // Land on top.
    ctx.fillStyle = '#3d3a36';
    ctx.fillRect(toX(LAND.minX), toZ(LAND.minZ), (LAND.maxX - LAND.minX) * scale, (LAND.maxZ - LAND.minZ) * scale);
    // Beach sand along the coasts.
    ctx.fillStyle = '#c9a86a';
    ctx.fillRect(toX(168), toZ(LAND.minZ), (LAND.maxX - 168) * scale, (LAND.maxZ - LAND.minZ) * scale);
    ctx.fillRect(toX(LAND.minX), toZ(168), (LAND.maxX - LAND.minX) * scale, (LAND.maxZ - 168) * scale);
    // Roads.
    ctx.fillStyle = '#26242a';
    for (const r of [-160, -120, -80, -40, 0, 40, 80, 120, 160]) {
      ctx.fillRect(toX(r - 5), toZ(LAND.minZ), 10 * scale, (LAND.maxZ - LAND.minZ) * scale);
      ctx.fillRect(toX(LAND.minX), toZ(r - 5), (LAND.maxX - LAND.minX) * scale, 10 * scale);
    }
    // Mission beacon.
    if (s.beacon) {
      ctx.fillStyle = '#ffd94a';
      ctx.beginPath();
      ctx.arc(toX(s.beacon.x), toZ(s.beacon.z), 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff2b0';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(toX(s.beacon.x), toZ(s.beacon.z), 8, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Police (blue) and enemies (red).
    for (const p of s.police || []) {
      ctx.fillStyle = '#3a86ff';
      ctx.beginPath();
      ctx.arc(toX(p.x), toZ(p.z), 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const e of s.enemiesPos || []) {
      ctx.fillStyle = '#ff3a3a';
      ctx.beginPath();
      ctx.arc(toX(e.x), toZ(e.z), 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Player: white arrow pointing along the heading.
    // Map north is up; heading 0 faces +z (map down), PI faces -z (map up).
    ctx.save();
    ctx.translate(toX(px), toZ(pz));
    ctx.rotate(Math.PI - s.heading);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 6);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // Frame.
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, W - 2, H - 2);
  }
}
