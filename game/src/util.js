// util.js — seeded RNG and small math helpers for Solara Bay.
// Every random choice in world generation goes through the seeded RNG so two
// runs of the game build the same city.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Smallest signed difference between two angles, in (-PI, PI].
export function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

// Heading convention: forward = (sin h, cos h) in (x, z).
// h = 0 faces +z (south), PI/2 faces +x (east), PI faces -z (north).
export function dirFromHeading(h) {
  return { x: Math.sin(h), z: Math.cos(h) };
}

export function headingTo(x0, z0, x1, z1) {
  return Math.atan2(x1 - x0, z1 - z0);
}

export function dist2(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}

export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

export function range(rng, a, b) {
  return a + rng() * (b - a);
}
