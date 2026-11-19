// minimap.js — a north-up 2D top-down map of Solara Bay: roads, the ocean,
// the player arrow, cars, police, enemies and the mission marker.

export function createMinimap(G) {
  const canvas = document.getElementById('minimap');
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const SCALE = W / 380; // city spans about -190..190 in both axes

  function toMap(x, z) {
    return [W / 2 + x * SCALE, H / 2 + z * SCALE];
  }

  function draw(G) {
    ctx.clearRect(0, 0, W, H);
    // Sea and sand on the east edge.
    ctx.fillStyle = '#1e6f9e';
    ctx.fillRect(W / 2 + 140 * SCALE, 0, W, H);
    ctx.fillStyle = '#d9c08a';
    ctx.fillRect(W / 2 + 140 * SCALE - 22 * SCALE, 0, 22 * SCALE, H);
    // City blocks.
    ctx.fillStyle = '#3a3f46';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#5a5f68';
    for (const bx of [-100, -60, -20, 20, 60, 100]) {
      for (const bz of [-100, -60, -20, 20, 60, 100]) {
        if (bx === 20 && bz === 20) continue;
        const [mx, mz] = toMap(bx - 18, bz - 18);
        ctx.fillRect(mx, mz, 36 * SCALE, 36 * SCALE);
      }
    }
    // Plaza.
    ctx.fillStyle = '#cbb98f';
    const [px, pz] = toMap(20 - 17, 20 - 17);
    ctx.fillRect(px, pz, 34 * SCALE, 34 * SCALE);
    // Roads.
    ctx.strokeStyle = '#8a8f98';
    ctx.lineWidth = 10 * SCALE;
    for (const r of G.city.roads) {
      const [ax] = toMap(0, r);
      ctx.beginPath();
      ctx.moveTo(0, ax);
      ctx.lineTo(W, ax);
      ctx.stroke();
      const [bx2] = toMap(r, 0);
      ctx.beginPath();
      ctx.moveTo(bx2, 0);
      ctx.lineTo(bx2, H);
      ctx.stroke();
    }
    // Mission marker: a pulsing yellow diamond.
    const m = G.mission;
    if (m.target) {
      const [tx, tz] = toMap(m.target.x, m.target.z);
      const pulse = 4 + Math.sin((G.elapsed ?? 0) * 4) * 1.5;
      ctx.fillStyle = '#ffd23c';
      ctx.beginPath();
      ctx.moveTo(tx, tz - pulse);
      ctx.lineTo(tx + pulse, tz);
      ctx.lineTo(tx, tz + pulse);
      ctx.lineTo(tx - pulse, tz);
      ctx.closePath();
      ctx.fill();
    }
    // Traffic cars: white dots. Parked cars: grey dots.
    ctx.fillStyle = '#e8e8e8';
    for (const car of G.trafficCars || []) {
      const [cx, cz] = toMap(car.pos.x, car.pos.z);
      ctx.fillRect(cx - 1.5, cz - 1.5, 3, 3);
    }
    ctx.fillStyle = '#9aa0a8';
    for (const car of G.parkedCars || []) {
      if (car.isPlayer) continue;
      const [cx, cz] = toMap(car.pos.x, car.pos.z);
      ctx.fillRect(cx - 1.5, cz - 1.5, 3, 3);
    }
    // Enemies: red dots. Police: flashing blue.
    ctx.fillStyle = '#ff3b30';
    for (const e of G.enemies || []) {
      if (e.dead) continue;
      const [ex, ez] = toMap(e.pos.x, e.pos.z);
      ctx.beginPath();
      ctx.arc(ex, ez, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    const flash = Math.floor((G.elapsed ?? 0) * 3) % 2 === 0;
    ctx.fillStyle = flash ? '#2f7bff' : '#ff2222';
    for (const car of G.policeCars || []) {
      const [cx, cz] = toMap(car.pos.x, car.pos.z);
      ctx.beginPath();
      ctx.arc(cx, cz, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Player: a white arrow pointing where Marlo faces.
    const p = G.player;
    const [mx, mz] = toMap(p.pos.x, p.pos.z);
    const yaw = p.inCar && p.car ? p.car.heading : p.yaw;
    ctx.save();
    ctx.translate(mx, mz);
    ctx.rotate(Math.PI - yaw);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#111111';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4.5, 5);
    ctx.lineTo(0, 2.5);
    ctx.lineTo(-4.5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    // View cone border.
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, W - 1, H - 1);
  }

  return { draw };
}
