// util.js — seeded RNG, math helpers and procedural canvas textures for Solara Bay.
// Nothing here touches the network; every texture is drawn on a canvas at runtime.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed) {
  const next = mulberry32(seed);
  return {
    next,
    range(min, max) {
      return min + next() * (max - min);
    },
    int(min, max) {
      return Math.floor(min + next() * (max - min + 1));
    },
    pick(list) {
      return list[Math.floor(next() * list.length)];
    },
    chance(p) {
      return next() < p;
    },
  };
}

export function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Shortest signed difference between two angles, in radians.
export function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

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

// Draw on a canvas and return it as a three.js texture (caller passes THREE in).
export function makeCanvasTexture(THREE, width, height, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  draw(ctx, width, height);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// A building facade: base colour, a grid of lit/unlit windows, a darker ground floor.
export function makeFacadeTexture(THREE, rng, baseColor, floors, cols) {
  return makeCanvasTexture(THREE, 128, 256, (ctx, w, h) => {
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, w, h);
    // Subtle vertical shading so neighbouring buildings read differently.
    const shade = ctx.createLinearGradient(0, 0, w, 0);
    shade.addColorStop(0, 'rgba(0,0,0,0.18)');
    shade.addColorStop(0.5, 'rgba(255,255,255,0.06)');
    shade.addColorStop(1, 'rgba(0,0,0,0.18)');
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, w, h);
    const margin = 10;
    const cw = (w - margin * 2) / cols;
    const ch = (h - 34) / floors;
    for (let f = 0; f < floors; f++) {
      for (let c = 0; c < cols; c++) {
        const x = margin + c * cw + 3;
        const y = 8 + f * ch + 4;
        const lit = rng.chance(0.28);
        ctx.fillStyle = lit ? '#ffd98a' : '#1d2733';
        ctx.fillRect(x, y, cw - 6, ch - 8);
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.fillRect(x, y, cw - 6, 2);
      }
    }
    // Ground floor: shopfront band.
    ctx.fillStyle = '#20242c';
    ctx.fillRect(0, h - 26, w, 26);
    ctx.fillStyle = '#7fd4ff';
    for (let c = 0; c < cols; c++) {
      ctx.fillRect(margin + c * cw + 3, h - 21, cw - 6, 14);
    }
  });
}

// A road strip texture with a dashed centre line, drawn along the strip's length.
export function makeRoadTexture(THREE) {
  return makeCanvasTexture(THREE, 64, 256, (ctx, w, h) => {
    ctx.fillStyle = '#2e3138';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#3a3e46';
    ctx.fillRect(0, 0, 3, h);
    ctx.fillRect(w - 3, 0, 3, h);
    ctx.fillStyle = '#e8c33c';
    for (let y = 0; y < h; y += 64) {
      ctx.fillRect(w / 2 - 2, y + 8, 4, 32);
    }
  });
}
