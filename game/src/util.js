// util.js — seeded RNG + small math helpers for Solara Bay.
// Everything deterministic: the same seed always builds the same city.

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

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Shortest signed angle difference from `from` to `to`, in (-PI, PI].
export function angleDelta(from, to) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

// Wrap an angle into (-PI, PI].
export function wrapAngle(a) {
  a = a % (Math.PI * 2);
  if (a > Math.PI) a -= Math.PI * 2;
  if (a <= -Math.PI) a += Math.PI * 2;
  return a;
}

export function dist2d(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}

// Forward unit vector for a heading. Heading 0 faces +Z (south),
// PI/2 faces +X (east), PI faces -Z (north), -PI/2 faces -X (west).
export function forwardOf(heading) {
  return { x: Math.sin(heading), z: Math.cos(heading) };
}

// Heading (radians) that looks from (ax, az) toward (bx, bz).
export function headingTo(ax, az, bx, bz) {
  return Math.atan2(bx - ax, bz - az);
}

export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

export function range(rng, lo, hi) {
  return lo + rng() * (hi - lo);
}
