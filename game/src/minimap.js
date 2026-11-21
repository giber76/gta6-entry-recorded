// minimap.js — the Solara Bay minimap, drawn on a 2D canvas in the HUD.
// The ocean is the background, so it is never painted over by the city;
// zoom cycles 1x / 2x / 4x centred on Marlo.
import { ROADS } from './city.js';

export class Minimap {
  constructor() {
    this.canvas = document.getElementById('minimap');
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    this.size = 168;
  }

  draw(game) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const S = this.size;
    const zoom = game.mapZoom;
    const view = 360 / zoom; // metres across the map
    const px = (x) => ((x - game.player.x) / view + 0.5) * S;
    const pz = (z) => ((z - game.player.z) / view + 0.5) * S;
    const pw = (m) => (m / view) * S;
    // Ocean first: the background is water.
    ctx.fillStyle = '#1a5f8a';
    ctx.fillRect(0, 0, S, S);
    // City ground.
    ctx.fillStyle = '#83837c';
    ctx.fillRect(px(-180), pz(-180), pw(360), pw(360));
    // Beach.
    ctx.fillStyle = '#d9bd85';
    ctx.fillRect(px(165), pz(-180), pw(15), pw(360));
    ctx.fillRect(px(-180), pz(165), pw(360), pw(15));
    // Marina basin.
    ctx.fillStyle = '#2a7ab0';
    ctx.fillRect(px(128), pz(44), pw(24), pw(32));
    // Roads.
    ctx.fillStyle = '#2e2e33';
    for (const r of ROADS) {
      ctx.fillRect(px(r - 5), pz(-180), pw(10), pw(360));
      ctx.fillRect(px(-180), pz(r - 5), pw(360), pw(10));
    }
    // Objective marker.
    const obj = game.objectivePoint();
    if (obj) {
      ctx.fillStyle = '#ffd928';
      ctx.beginPath();
      ctx.arc(px(obj.x), pz(obj.z), 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    // Police cruisers.
    ctx.fillStyle = '#4a90ff';
    for (const p of game.police.positions()) {
      ctx.beginPath();
      ctx.arc(px(p.x), pz(p.z), 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Enemies.
    ctx.fillStyle = '#ff4444';
    for (const e of game.enemies) {
      if (!e.alive) continue;
      ctx.beginPath();
      ctx.arc(px(e.x), pz(e.z), 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Marlo: a white arrow pointing along his heading.
    const cx = px(game.player.x);
    const cy = pz(game.player.z);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(game.player.heading);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 6);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
    // Border.
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, S - 2, S - 2);
  }
}
