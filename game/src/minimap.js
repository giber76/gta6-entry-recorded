// minimap.js — a north-up 2D top-down map of Solara Bay: roads, the ocean,
// the player arrow, cars, police, enemies and the mission marker.
// Drawn fresh every frame onto the 180×180 HUD canvas.
// Zoom levels are 1x / 2x / 4x, centred on Marlo; the ocean fills the east half.
//
// Zoom: 1x shows the whole city; 2x and 4x centre on Marlo and show a
// smaller patch (Z zooms in, X zooms out). The ground is painted in
// world-space rects, and the city base stops at the beach — it never
// paints over the sea.

const BLOCKS = [-100, -60, -20, 20, 60, 100];

export function createMinimap(game) {
  const canvas = document.getElementById('minimap');
  const g = canvas.getContext('2d');
  const cw = canvas.width;
  const ch = canvas.height;
  const BASE_SCALE = cw / 380; // city spans about -190..190 in both axes

  // Current scale factor: the base scale times the zoom level.
  function scale() {
    return BASE_SCALE * (game.minimapZoom ?? 1);
  }

  // World-to-map: at zoom 1 the whole city fits; zoomed in, the view
  // centres on Marlo and shows a smaller patch of the city.
  function centre() {
    const zoom = game.minimapZoom ?? 1;
    if (zoom <= 1) return [0, 0];
    const p = game.player;
    return [p.pos.x, p.pos.z];
  }

  function toMap(x, z) {
    const zoom = game.minimapZoom ?? 1;
    const [cx, cz] = centre();
    const s = BASE_SCALE * zoom;
    return [cw / 2 + (x - cx) * s, ch / 2 + (z - cz) * s];
  }

  // A world-space rectangle, clipped to the canvas by the fill itself.
  function worldRect(x0, z0, x1, z1, color) {
    const [ax, az] = toMap(x0, z0);
    const [bx, bz] = toMap(x1, z1);
    g.fillStyle = color;
    g.fillRect(Math.min(ax, bx), Math.min(az, bz), Math.abs(bx - ax), Math.abs(bz - az));
  }

  function block(bx, bz, w, color) {
    const [mx, mz] = toMap(bx, bz);
    g.fillStyle = color;
    const size = w * scale();
    g.fillRect(mx, mz, size, size);
  }

  function dot(x, z, r, color) {
    const [mx, mz] = toMap(x, z);
    g.fillStyle = color;
    g.beginPath();
    g.arc(mx, mz, r, 0, Math.PI * 2);
    g.fill();
  }

  function square(x, z, s, color) {
    const [mx, mz] = toMap(x, z);
    g.fillStyle = color;
    g.fillRect(mx - s / 2, mz - s / 2, s, s);
  }

  // Ground layers, painted back to front: the city base stops at the
  // beach (x = 140), then the sea and the sand east of it, so the base
  // can never cover them. Then the blocks, with the plaza cut out.
  const GROUND_LAYERS = [
    [-190, -190, 140, 190, '#3a3f46'],
    [160, -190, 440, 190, '#1e6f9e'],
    [140, -190, 162, 190, '#d9c08a'],
  ];

  function drawGround() {
    for (const [x0, z0, x1, z1, color] of GROUND_LAYERS) worldRect(x0, z0, x1, z1, color);
    for (const bx of BLOCKS) {
      for (const bz of BLOCKS) {
        if (bx === 20 && bz === 20) continue; // plaza, painted separately
        block(bx - 18, bz - 18, 36, '#5a5f68');
      }
    }
    block(20 - 17, 20 - 17, 34, '#cbb98f');
  }

  function drawRoads() {
    g.strokeStyle = '#8a8f98';
    g.lineWidth = 10 * scale();
    for (const r of game.city.roads) {
      const [, ay] = toMap(0, r);
      g.beginPath();
      g.moveTo(0, ay);
      g.lineTo(cw, ay);
      g.stroke();
      const [bx] = toMap(r, 0);
      g.beginPath();
      g.moveTo(bx, 0);
      g.lineTo(bx, ch);
      g.stroke();
    }
  }

  function drawMarker() {
    const m = game.mission;
    if (!m.target) return;
    const [tx, tz] = toMap(m.target.x, m.target.z);
    const pulse = 4 + Math.sin((game.elapsed ?? 0) * 4) * 1.5;
    g.fillStyle = '#ffd23c';
    g.beginPath();
    g.moveTo(tx, tz - pulse);
    g.lineTo(tx + pulse, tz);
    g.lineTo(tx, tz + pulse);
    g.lineTo(tx - pulse, tz);
    g.closePath();
    g.fill();
  }

  function drawCars() {
    // Traffic: white squares. Parked cars: grey squares.
    for (const car of game.trafficCars || []) square(car.pos.x, car.pos.z, 3, '#e8e8e8');
    for (const car of game.parkedCars || []) {
      if (car.isPlayer) continue;
      square(car.pos.x, car.pos.z, 3, '#9aa0a8');
    }
  }

  function drawHostiles() {
    // Enemies: red circles. Police: alternating blue/red circles.
    for (const e of game.enemies || []) {
      if (e.dead) continue;
      dot(e.pos.x, e.pos.z, 2.5, '#ff3b30');
    }
    const flash = Math.floor((game.elapsed ?? 0) * 3) % 2 === 0;
    const color = flash ? '#2f7bff' : '#ff2222';
    for (const car of game.policeCars || []) dot(car.pos.x, car.pos.z, 3.5, color);
  }

  function drawPlayerArrow() {
    const p = game.player;
    const [mx, mz] = toMap(p.pos.x, p.pos.z);
    const yaw = p.inCar && p.car ? p.car.heading : p.yaw;
    g.save();
    g.translate(mx, mz);
    g.rotate(Math.PI - yaw);
    g.fillStyle = '#ffffff';
    g.strokeStyle = '#111111';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(0, -6);
    g.lineTo(4.5, 5);
    g.lineTo(0, 2.5);
    g.lineTo(-4.5, 5);
    g.closePath();
    g.fill();
    g.stroke();
    g.restore();
    g.strokeStyle = 'rgba(255,255,255,0.35)';
    g.lineWidth = 1;
    g.strokeRect(0.5, 0.5, cw - 1, ch - 1);
  }

  // North indicator, zoom level and the legend.
  function drawLabels() {
    g.fillStyle = 'rgba(255,255,255,0.85)';
    g.font = 'bold 12px sans-serif';
    g.textAlign = 'center';
    g.fillText('N', canvas.width / 2, 16);
    g.textAlign = 'left';
    const zoom = game.minimapZoom ?? 1;
    g.fillStyle = 'rgba(255,255,255,0.85)';
    g.font = 'bold 11px sans-serif';
    g.fillText(`${zoom}x`, 6, ch - 6);
    // Legend (bottom-right): gold = objective, red = Viper, blue = Marlo.
    const legend = [
      ['#e8b64c', 'job'],
      ['#e33d3d', 'Viper'],
      ['#4fc3f7', 'you'],
    ];
    g.font = '10px sans-serif';
    legend.forEach(([color, label], i) => {
      const y = ch - 8 - i * 14;
      g.fillStyle = color;
      g.beginPath();
      g.arc(canvas.width - 52, y - 3, 3.5, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.85)';
      g.fillText(label, canvas.width - 44, y);
    });
  }

  function draw(game) {
    g.clearRect(0, 0, cw, ch);
    drawGround();
    drawRoads();
    drawMarker();
    drawCars();
    drawHostiles();
    drawPlayerArrow();
    drawLabels();
  }

  return { draw };
}
