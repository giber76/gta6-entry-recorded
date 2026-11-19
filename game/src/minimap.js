// minimap.js — a north-up 2D top-down map of Solara Bay: roads, the ocean,
// the player arrow, cars, police, enemies and the mission marker.
// Drawn fresh every frame onto the 180×180 HUD canvas.
//
// Zoom: 1x shows the whole city; 2x and 4x centre on Marlo and show a
// smaller patch (Z zooms in, X zooms out). The ground is painted in
// world-space rects, and the city base stops at the beach — it never
// paints over the sea.

const BLOCKS = [-100, -60, -20, 20, 60, 100];

export function createMinimap(G) {
  const canvas = document.getElementById('minimap');
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const SCALE = W / 380; // city spans about -190..190 in both axes

  // World-to-map: at zoom 1 the whole city fits; zoomed in, the view
  // centres on Marlo and shows a smaller patch of the city.
  function viewCenter() {
    const zoom = G.minimapZoom ?? 1;
    if (zoom <= 1) return [0, 0];
    const p = G.player;
    return [p.pos.x, p.pos.z];
  }

  function toMap(x, z) {
    const zoom = G.minimapZoom ?? 1;
    const [cx, cz] = viewCenter();
    const s = SCALE * zoom;
    return [W / 2 + (x - cx) * s, H / 2 + (z - cz) * s];
  }

  // A world-space rectangle, clipped to the canvas by the fill itself.
  function rectWorld(x0, z0, x1, z1, color) {
    const [ax, az] = toMap(x0, z0);
    const [bx, bz] = toMap(x1, z1);
    ctx.fillStyle = color;
    ctx.fillRect(Math.min(ax, bx), Math.min(az, bz), Math.abs(bx - ax), Math.abs(bz - az));
  }

  function fillBlock(bx, bz, w, color) {
    const [mx, mz] = toMap(bx, bz);
    ctx.fillStyle = color;
    ctx.fillRect(mx, mz, w * SCALE * (G.minimapZoom ?? 1), w * SCALE * (G.minimapZoom ?? 1));
  }

  function dot(x, z, r, color) {
    const [mx, mz] = toMap(x, z);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(mx, mz, r, 0, Math.PI * 2);
    ctx.fill();
  }

  function square(x, z, s, color) {
    const [mx, mz] = toMap(x, z);
    ctx.fillStyle = color;
    ctx.fillRect(mx - s / 2, mz - s / 2, s, s);
  }

  function drawGround() {
    // The city base stops at the beach (x = 140); the sea and the sand
    // east of it are painted after it, so the base can never cover them.
    rectWorld(-190, -190, 140, 190, '#3a3f46');
    rectWorld(160, -190, 440, 190, '#1e6f9e');
    rectWorld(140, -190, 162, 190, '#d9c08a');
    for (const bx of BLOCKS) {
      for (const bz of BLOCKS) {
        if (bx === 20 && bz === 20) continue; // plaza, painted separately
        fillBlock(bx - 18, bz - 18, 36, '#5a5f68');
      }
    }
    fillBlock(20 - 17, 20 - 17, 34, '#cbb98f');
  }

  function drawRoads() {
    ctx.strokeStyle = '#8a8f98';
    ctx.lineWidth = 10 * SCALE * (G.minimapZoom ?? 1);
    for (const r of G.city.roads) {
      const [, ay] = toMap(0, r);
      ctx.beginPath();
      ctx.moveTo(0, ay);
      ctx.lineTo(W, ay);
      ctx.stroke();
      const [bx] = toMap(r, 0);
      ctx.beginPath();
      ctx.moveTo(bx, 0);
      ctx.lineTo(bx, H);
      ctx.stroke();
    }
  }

  function drawMarker() {
    const m = G.mission;
    if (!m.target) return;
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

  function drawCars() {
    // Traffic: white squares. Parked cars: grey squares.
    for (const car of G.trafficCars || []) square(car.pos.x, car.pos.z, 3, '#e8e8e8');
    for (const car of G.parkedCars || []) {
      if (car.isPlayer) continue;
      square(car.pos.x, car.pos.z, 3, '#9aa0a8');
    }
  }

  function drawHostiles() {
    // Enemies: red circles. Police: alternating blue/red circles.
    for (const e of G.enemies || []) {
      if (e.dead) continue;
      dot(e.pos.x, e.pos.z, 2.5, '#ff3b30');
    }
    const flash = Math.floor((G.elapsed ?? 0) * 3) % 2 === 0;
    const color = flash ? '#2f7bff' : '#ff2222';
    for (const car of G.policeCars || []) dot(car.pos.x, car.pos.z, 3.5, color);
  }

  function drawPlayerArrow() {
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
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, W - 1, H - 1);
  }

  function draw(G) {
    ctx.clearRect(0, 0, W, H);
    drawGround();
    drawRoads();
    drawMarker();
    drawCars();
    drawHostiles();
    drawPlayerArrow();
    // North indicator (top edge, centred on the map).
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('N', canvas.width / 2, 16);
    ctx.textAlign = 'left';
    // Zoom level, bottom-left of the map.
    const zoom = G.minimapZoom ?? 1;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(`${zoom}x`, 6, H - 6);
    // Legend (bottom-right): gold = objective, red = Viper, blue = Marlo.
    const legend = [
      ['#e8b64c', 'job'],
      ['#e33d3d', 'Viper'],
      ['#4fc3f7', 'you'],
    ];
    ctx.font = '10px sans-serif';
    legend.forEach(([color, label], i) => {
      const y = H - 8 - i * 14;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(canvas.width - 52, y - 3, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillText(label, canvas.width - 44, y);
    });
  }

  return { draw };
}
