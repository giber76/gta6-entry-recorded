// audio.js — generated WebAudio sound for Solara Bay.
// No audio files: the three radio stations are 16-step bass + lead + hat
// loops, and the engine, shots and explosions are synthesized. Everything
// is guarded so the game still runs when audio is unavailable (headless).
const STATIONS = [
  { name: 'OFF', bpm: 0, bass: [], lead: [], wave: 'sine' },
  {
    name: 'SOLARA FM', bpm: 112, wave: 'sawtooth',
    bass: [0, 0, 7, 0, 10, 0, 7, 5, 0, 0, 7, 0, 12, 10, 7, 5],
    lead: [12, 0, 15, 19, 0, 15, 12, 0, 19, 0, 17, 15, 12, 0, 10, 0],
  },
  {
    name: 'BAY 97.5', bpm: 96, wave: 'triangle',
    bass: [0, 0, 0, 3, 0, 0, 5, 0, 0, 0, 3, 0, 7, 5, 3, 0],
    lead: [12, 15, 0, 12, 10, 0, 12, 0, 15, 17, 15, 12, 10, 12, 0, 0],
  },
  {
    name: 'VICE 101', bpm: 128, wave: 'square',
    bass: [0, 0, 12, 0, 0, 10, 0, 0, 0, 0, 12, 0, 10, 0, 7, 0],
    lead: [24, 0, 22, 24, 0, 19, 0, 22, 24, 0, 24, 27, 24, 22, 19, 0],
  },
];

function noteFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.station = 0; // index into STATIONS; 0 = OFF
    this.step = 0;
    this.nextStepTime = 0;
    this.engineOsc = null;
    this.engineGain = null;
    this.radioGain = null;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
      this.radioGain = this.ctx.createGain();
      this.radioGain.gain.value = 0.16;
      this.radioGain.connect(this.master);
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0.0;
      this.engineOsc.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
      this.nextStepTime = this.ctx.currentTime + 0.1;
    } catch (e) {
      this.ctx = null;
    }
  }

  stationName() {
    return STATIONS[this.station].name;
  }

  cycleStation() {
    this.ensure();
    this.station = (this.station + 1) % STATIONS.length;
    this.step = 0;
    if (this.ctx) this.nextStepTime = this.ctx.currentTime + 0.05;
    return this.stationName();
  }

  setEngine(speedNorm) {
    if (!this.ctx || !this.engineOsc) return;
    try {
      this.engineOsc.frequency.value = 55 + speedNorm * 140;
      this.engineGain.gain.value = 0.015 + speedNorm * 0.05;
    } catch (e) {}
  }

  update() {
    if (!this.ctx || this.station === 0) return;
    const st = STATIONS[this.station];
    const stepDur = 60 / st.bpm / 4;
    try {
      while (this.nextStepTime < this.ctx.currentTime + 0.15) {
        this.scheduleStep(st, this.step, this.nextStepTime, stepDur);
        this.step = (this.step + 1) % 16;
        this.nextStepTime += stepDur;
      }
    } catch (e) {}
  }

  scheduleStep(st, step, t, stepDur) {
    const bassNote = st.bass[step];
    if (bassNote !== 0 && bassNote !== undefined) {
      const o = this.ctx.createOscillator();
      o.type = st.wave;
      o.frequency.value = noteFreq(36 + bassNote);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.5, t);
      g.gain.exponentialRampToValueAtTime(0.01, t + stepDur * 0.9);
      o.connect(g);
      g.connect(this.radioGain);
      o.start(t);
      o.stop(t + stepDur);
    }
    const leadNote = st.lead[step];
    if (leadNote !== 0 && leadNote !== undefined) {
      const o = this.ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = noteFreq(60 + leadNote);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.22, t);
      g.gain.exponentialRampToValueAtTime(0.01, t + stepDur * 1.8);
      o.connect(g);
      g.connect(this.radioGain);
      o.start(t);
      o.stop(t + stepDur * 2);
    }
    if (step % 2 === 0) {
      const len = Math.floor(this.ctx.sampleRate * 0.03);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const g = this.ctx.createGain();
      g.gain.value = step % 4 === 0 ? 0.25 : 0.12;
      src.connect(g);
      g.connect(this.radioGain);
      src.start(t);
    }
  }

  shot() {
    if (!this.ctx) return;
    try {
      const t = this.ctx.currentTime;
      const len = Math.floor(this.ctx.sampleRate * 0.12);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.5, t);
      g.gain.exponentialRampToValueAtTime(0.01, t + 0.12);
      src.connect(g);
      g.connect(this.master);
      src.start(t);
    } catch (e) {}
  }

  explosion() {
    if (!this.ctx) return;
    try {
      const t = this.ctx.currentTime;
      const len = Math.floor(this.ctx.sampleRate * 0.7);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.7, t);
      g.gain.exponentialRampToValueAtTime(0.01, t + 0.7);
      src.connect(g);
      g.connect(this.master);
      src.start(t);
      const o = this.ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(90, t);
      o.frequency.exponentialRampToValueAtTime(28, t + 0.5);
      const og = this.ctx.createGain();
      og.gain.setValueAtTime(0.5, t);
      og.gain.exponentialRampToValueAtTime(0.01, t + 0.5);
      o.connect(og);
      og.connect(this.master);
      o.start(t);
      o.stop(t + 0.55);
    } catch (e) {}
  }

  blip() {
    if (!this.ctx) return;
    try {
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = 880;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.2, t);
      g.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
      o.connect(g);
      g.connect(this.master);
      o.start(t);
      o.stop(t + 0.16);
    } catch (e) {}
  }
}
