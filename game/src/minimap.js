// minimap.js — a north-up 2D top-down map of Solara Bay: roads, the ocean,
// the player arrow, cars, police, enemies and the mission marker.
// Drawn fresh every frame onto the 180×180 HUD canvas. Z zooms in and X
// zooms out (1x / 2x / 4x, centred on Marlo when zoomed in).

const BLOCKS = [-100, -60, -20, 20, 60, 100];

export function createMinimap(G) {
  const canvas = document.getElementById('minimap');
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;

  // Screen scale for one world unit, and the world point at the centre.
  // Zoomed out the whole city is visible; zoomed in the map centres on
  // Marlo so the streets around him read clearly.
  function scale() {
    return (W / 380) * (G.mapZoom ?? 1);
  }

  function toMap(x, z) {
    const zoom = G.mapZoom ?? 1;
    const s = scale();
    const cx = zoom === 1 ? 0 : G.player.pos.x;
    const cz = zoom === 1 ? 0 : G.player.pos.z;
    return [W / 2 + (x - cx) * s, H / 2 + (z - cz) * s];
  }

  // Marker sizes grow slowly with zoom so dots stay readable up close.
  function markScale() {
    return Math.sqrt(G.mapZoom ?? 1);
  }

  function fillBlock(bx, bz, w, color) {
    const [mx, mz] = toMap(bx, bz);
    ctx.fillStyle = color;
    ctx.fillRect(mx, mz, w * scale(), w * scale());
  }

  function dot(x, z, r, color) {
    const [mx, mz] = toMap(x, z);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(mx, mz, r * markScale(), 0, Math.PI * 2);
    ctx.fill();
  }

  function square(x, z, s, color) {
    const [mx, mz] = toMap(x, z);
    const size = s * markScale();
    ctx.fillStyle = color;
    ctx.fillRect(mx - size / 2, mz - size / 2, size, size);
  }

  function drawGround() {
    // City base first, then the sea and sand on the east edge (painted
    // after the base so the ocean actually shows), then the blocks.
    ctx.fillStyle = '#3a3f46';
    ctx.fillRect(0, 0, W, H);
    const [seaX] = toMap(140, 0);
    ctx.fillStyle = '#1e6f9e';
    ctx.fillRect(seaX, 0, W, H);
    const [sandX] = toMap(118, 0);
    ctx.fillStyle = '#d9c08a';
    ctx.fillRect(sandX, 0, 22 * scale(), H);
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
    ctx.lineWidth = 10 * scale();
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
    const pulse = (4 + Math.sin((G.elapsed ?? 0) * 4) * 1.5) * markScale();
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

  function drawZoomLabel() {
    const zoom = G.mapZoom ?? 1;
    if (zoom <= 1) return;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(`x${zoom}`, 6, 14);
  }

  function draw(G) {
    ctx.clearRect(0, 0, W, H);
    drawGround();
    drawRoads();
    drawMarker();
    drawCars();
    drawHostiles();
    drawPlayerArrow();
    drawZoomLabel();
  }

  return { draw };
}
