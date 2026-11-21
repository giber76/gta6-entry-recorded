// audio.js — WebAudio radio (3 generated stations, no audio files) + effects.
// Everything is guarded: in headless browsers the AudioContext may stay
// suspended, and no call may throw a console error.
const STATIONS = ['OFF', 'SOLARA FM', 'BAY 97.5', 'VICE 101'];

// 16-step patterns: bass notes (semitone offsets from the station root),
// lead notes, and hat hits. Each station has its own root, tempo and wave.
const PATTERNS = {
  'SOLARA FM': { root: 110, bpm: 96, wave: 'sawtooth', bass: [0, 0, 7, 0, 5, 0, 7, 10, 0, 0, 7, 0, 3, 5, 7, 12], lead: [12, 0, 15, 12, 19, 15, 12, 0, 12, 0, 15, 19, 15, 12, 10, 7], hats: [1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 0, 1] },
  'BAY 97.5': { root: 98, bpm: 112, wave: 'square', bass: [0, 0, 0, 7, 0, 0, 5, 0, 0, 0, 0, 7, 10, 7, 5, 3], lead: [0, 12, 0, 15, 0, 12, 0, 10, 0, 12, 0, 15, 19, 15, 12, 10], hats: [1, 1, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 0, 1, 1] },
  'VICE 101': { root: 130.8, bpm: 82, wave: 'triangle', bass: [0, 7, 0, 5, 0, 3, 0, 5, 0, 7, 0, 10, 0, 7, 5, 0], lead: [19, 15, 12, 15, 19, 24, 19, 15, 12, 15, 12, 10, 12, 15, 19, 12], hats: [1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1] },
};

function noteFreq(root, semis) {
  return root * Math.pow(2, semis / 12);
}

export function initAudio(G) {
  G.audio = {
    ctx: null,
    master: null,
    station: 'OFF',
    step: 0,
    nextStepTime: 0,
    noiseBuf: null,
  };
}

function ensureCtx(G) {
  if (G.audio.ctx) return G.audio.ctx;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    const ctx = new AC();
    const master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    // Shared noise buffer for hats / explosions.
    const len = ctx.sampleRate * 0.5;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    G.audio.ctx = ctx;
    G.audio.master = master;
    G.audio.noiseBuf = buf;
    return ctx;
  } catch (e) {
    return null;
  }
}

export function setRadio(G, station) {
  G.audio.station = station;
  G.radio = station;
  G.audio.step = 0;
  if (station !== 'OFF') {
    const ctx = ensureCtx(G);
    if (ctx) {
      try {
        if (ctx.state === 'suspended') void ctx.resume();
        G.audio.nextStepTime = ctx.currentTime + 0.05;
      } catch (e) { /* audio is best-effort */ }
    }
  }
}

export function cycleRadio(G) {
  const i = STATIONS.indexOf(G.audio.station);
  const next = STATIONS[(i + 1) % STATIONS.length];
  setRadio(G, next);
}

function playTone(G, freq, start, dur, type, vol) {
  const ctx = G.audio.ctx;
  if (!ctx) return;
  try {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, start);
    g.gain.exponentialRampToValueAtTime(0.001, start + dur);
    o.connect(g);
    g.connect(G.audio.master);
    o.start(start);
    o.stop(start + dur + 0.02);
  } catch (e) { /* best-effort */ }
}

function playHat(G, start, vol) {
  const ctx = G.audio.ctx;
  if (!ctx || !G.audio.noiseBuf) return;
  try {
    const src = ctx.createBufferSource();
    src.buffer = G.audio.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 7000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, start);
    g.gain.exponentialRampToValueAtTime(0.001, start + 0.05);
    src.connect(f);
    f.connect(g);
    g.connect(G.audio.master);
    src.start(start, Math.random() * 0.3, 0.08);
  } catch (e) { /* best-effort */ }
}

export function updateAudio(G, dt) {
  const ctx = G.audio.ctx;
  if (!ctx || G.audio.station === 'OFF') return;
  if (ctx.state !== 'running') return;
  const pat = PATTERNS[G.audio.station];
  if (!pat) return;
  const stepDur = 60 / pat.bpm / 4;
  try {
    while (G.audio.nextStepTime < ctx.currentTime + 0.15) {
      const t = Math.max(G.audio.nextStepTime, ctx.currentTime);
      const s = G.audio.step % 16;
      const bassNote = pat.bass[s];
      if (bassNote !== 0 || s % 4 === 0) {
        playTone(G, noteFreq(pat.root / 2, bassNote), t, stepDur * 1.8, pat.wave, 0.16);
      }
      const leadNote = pat.lead[s];
      if (leadNote !== 0 && s % 2 === 0) {
        playTone(G, noteFreq(pat.root * 2, leadNote), t, stepDur * 0.9, 'sine', 0.07);
      }
      if (pat.hats[s]) playHat(G, t, 0.05);
      G.audio.step++;
      G.audio.nextStepTime += stepDur;
    }
  } catch (e) { /* best-effort */ }
}

export function playShot(G) {
  const ctx = ensureCtx(G);
  if (!ctx || ctx.state !== 'running') return;
  try {
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = G.audio.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1800;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    src.connect(f);
    f.connect(g);
    g.connect(G.audio.master);
    src.start(t, 0, 0.15);
    playTone(G, 160, t, 0.08, 'square', 0.2);
  } catch (e) { /* best-effort */ }
}

export function playExplosion(G) {
  const ctx = ensureCtx(G);
  if (!ctx || ctx.state !== 'running') return;
  try {
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = G.audio.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 400;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.8, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
    src.connect(f);
    f.connect(g);
    g.connect(G.audio.master);
    src.start(t, 0, 1.0);
    playTone(G, 55, t, 0.7, 'sine', 0.5);
  } catch (e) { /* best-effort */ }
}

export function playCrash(G) {
  const ctx = ensureCtx(G);
  if (!ctx || ctx.state !== 'running') return;
  try {
    const t = ctx.currentTime;
    playTone(G, 90, t, 0.15, 'sawtooth', 0.25);
    playTone(G, 60, t + 0.05, 0.15, 'square', 0.2);
  } catch (e) { /* best-effort */ }
}
