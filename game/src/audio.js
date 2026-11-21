// audio.js — Solara Bay radio: three generated stations (WebAudio, no
// audio files) plus tiny synth sound effects. Everything is guarded: if
// the browser cannot make audio, the game still runs and the radio label
// still cycles.
export const STATIONS = ['SOLARA FM', 'BAY 97.5', 'VICE 101'];

// 16-step patterns per station: bass notes (Hz, 0 = rest), lead notes,
// hat on/off. Each station has its own tempo and mood.
const PATTERNS = [
  {
    bpm: 104, bass: [55, 0, 55, 0, 65.4, 0, 55, 0, 49, 0, 55, 0, 73.4, 0, 65.4, 0],
    lead: [220, 0, 261.6, 0, 329.6, 0, 261.6, 0, 196, 0, 220, 0, 293.7, 0, 329.6, 0],
    wave: 'sawtooth',
  },
  {
    bpm: 88, bass: [41.2, 0, 0, 41.2, 0, 49, 0, 0, 36.7, 0, 0, 41.2, 0, 55, 0, 0],
    lead: [174.6, 0, 0, 207.7, 0, 0, 233.1, 0, 155.6, 0, 0, 174.6, 0, 0, 261.6, 0],
    wave: 'triangle',
  },
  {
    bpm: 122, bass: [65.4, 65.4, 0, 65.4, 0, 65.4, 73.4, 0, 65.4, 0, 58.3, 0, 65.4, 0, 82.4, 0],
    lead: [392, 0, 440, 0, 523.3, 0, 440, 0, 392, 0, 493.9, 0, 587.3, 0, 523.3, 0],
    wave: 'square',
  },
];

export class Radio {
  constructor() {
    this.index = -1; // -1 = off; first R press -> SOLARA FM (index 0)
    this.ctx = null;
    this.master = null;
    this.step = 0;
    this.nextStepTime = 0;
    this.timer = null;
    this.enabled = false;
  }

  get station() {
    return this.index < 0 ? 'OFF' : STATIONS[this.index];
  }

  ensureAudio() {
    if (this.ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.16;
      this.master.connect(this.ctx.destination);
      return true;
    } catch (e) {
      this.ctx = null;
      return false;
    }
  }

  cycle() {
    this.index = (this.index + 1) % STATIONS.length;
    if (!this.ensureAudio()) return this.station;
    try {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      this.step = 0;
      this.nextStepTime = this.ctx.currentTime + 0.05;
      if (!this.timer) {
        this.timer = setInterval(() => this.schedule(), 40);
      }
      this.enabled = true;
    } catch (e) {
      this.enabled = false;
    }
    return this.station;
  }

  schedule() {
    if (!this.ctx || !this.enabled || this.index < 0) return;
    const pat = PATTERNS[this.index];
    const stepDur = 60 / pat.bpm / 4;
    try {
      while (this.nextStepTime < this.ctx.currentTime + 0.18) {
        const s = this.step % 16;
        const t = this.nextStepTime;
        const bass = pat.bass[s];
        if (bass) this.tone(bass, stepDur * 0.95, pat.wave, 0.5, t);
        const lead = pat.lead[s];
        if (lead) this.tone(lead, stepDur * 0.5, 'sine', 0.22, t);
        if (s % 2 === 0) this.hat(t, s % 4 === 0 ? 0.12 : 0.06);
        this.step++;
        this.nextStepTime += stepDur;
      }
    } catch (e) {
      // Never let the sequencer throw into the game loop.
    }
  }

  tone(freq, dur, wave, vol, when) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = wave;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(when);
    o.stop(when + dur + 0.02);
  }

  hat(when, vol) {
    const len = 0.05;
    const buf = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * len), this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    const f = this.ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 6000;
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(when);
  }

  // One-shot sound effects, all synthesized.
  blip(freq, dur, wave, vol) {
    if (!this.ensureAudio() || !this.master) return;
    try {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      this.tone(freq, dur, wave, vol, this.ctx.currentTime);
    } catch (e) {
      /* ignore */
    }
  }

  shot() {
    this.blip(180, 0.09, 'square', 0.25);
    this.blip(90, 0.12, 'sawtooth', 0.2);
  }

  explosion() {
    if (!this.ensureAudio() || !this.master) return;
    try {
      const dur = 0.7;
      const buf = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * dur), this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(900, this.ctx.currentTime);
      f.frequency.exponentialRampToValueAtTime(90, this.ctx.currentTime + dur);
      const g = this.ctx.createGain();
      g.gain.value = 0.5;
      src.connect(f);
      f.connect(g);
      g.connect(this.master);
      src.start();
    } catch (e) {
      /* ignore */
    }
  }

  cash() {
    this.blip(880, 0.12, 'sine', 0.2);
    setTimeout(() => this.blip(1318, 0.18, 'sine', 0.2), 110);
  }
}
