// util.js — deterministic randomness, small math helpers and the procedural
// canvas textures Solara Bay is built from. Everything here is offline:
// textures are painted on canvases at runtime, nothing is fetched.

function mixStep(s) {
  const t = Math.imul(s ^ (s >>> 15), 1 | s);
  return (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
}

export function mulberry32(seed) {
  let s = seed >>> 0;
  return function roll() {
    s = (s + 0x6d2b79f5) | 0;
    const mixed = mixStep(s);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

// A dice bag on top of mulberry32: the city, traffic and pedestrians each
// take their own bag with a fixed seed, so the world is identical on every
// load while each system still gets its own stream.
export function makeRng(seed) {
  const roll = mulberry32(seed);
  return {
    next: roll,
    range(lo, hi) {
      return lo + roll() * (hi - lo);
    },
    int(lo, hi) {
      return Math.floor(lo + roll() * (hi - lo + 1));
    },
    pick(items) {
      return items[Math.floor(roll() * items.length)];
    },
    chance(p) {
      return roll() < p;
    },
  };
}

export function clamp(v, lo, hi) {
  if (v < lo) return lo;
  if (v > hi) return hi;
  return v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Step `current` toward `target` by at most `maxStep` radians.
export function turnToward(current, target, maxStep) {
  const d = angleDiff(current, target);
  if (Math.abs(d) <= maxStep) return target;
  return current + Math.sign(d) * maxStep;
}

export function dist2D(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}

// Paint on a canvas and hand it back as a three.js texture.
export function makeCanvasTexture(THREE, width, height, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d'), width, height);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// The window grid of a building face: one lit-or-dark pane per cell, plus
// a pale highlight along each pane's top edge.
function paintWindows(ctx, rng, margin, cellW, cellH, floors, cols) {
  for (let floor = 0; floor < floors; floor++) {
    for (let col = 0; col < cols; col++) {
      const x = margin + col * cellW + 3;
      const y = 8 + floor * cellH + 4;
      ctx.fillStyle = rng.chance(0.28) ? '#ffd98a' : '#1d2733';
      ctx.fillRect(x, y, cellW - 6, cellH - 8);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(x, y, cellW - 6, 2);
    }
  }
}

// A building face: flat base colour, a grid of windows (a few lit), and a
// darker shopfront band along the ground floor.
export function makeFacadeTexture(THREE, rng, baseColor, floors, cols) {
  return makeCanvasTexture(THREE, 128, 256, (ctx, w, h) => {
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, w, h);
    const shade = ctx.createLinearGradient(0, 0, w, 0);
    shade.addColorStop(0, 'rgba(0,0,0,0.18)');
    shade.addColorStop(0.5, 'rgba(255,255,255,0.06)');
    shade.addColorStop(1, 'rgba(0,0,0,0.18)');
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, w, h);
    const margin = 10;
    const cellW = (w - margin * 2) / cols;
    const cellH = (h - 34) / floors;
    paintWindows(ctx, rng, margin, cellW, cellH, floors, cols);
    ctx.fillStyle = '#20242c';
    ctx.fillRect(0, h - 26, w, 26);
    ctx.fillStyle = '#7fd4ff';
    for (let col = 0; col < cols; col++) {
      ctx.fillRect(margin + col * cellW + 3, h - 21, cellW - 6, 14);
    }
  });
}

// A road strip: dark asphalt, pale edges and a dashed yellow centre line.
export function makeRoadTexture(THREE) {
  return makeCanvasTexture(THREE, 64, 256, (ctx, w, h) => {
    ctx.fillStyle = '#2e3138';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#3a3e46';
    ctx.fillRect(0, 0, 3, h);
    ctx.fillRect(w - 3, 0, 3, h);
    ctx.fillStyle = '#e8c33c';
    let y = 8;
    while (y < h) {
      ctx.fillRect(w / 2 - 2, y, 4, 32);
      y += 64;
    }
  });
}
