// audio.js — generated radio + game sounds for Solara Bay.
// No audio files: every station is a 16-step WebAudio loop (bass + lead +
// hats), and effects are synthesized noise/oscillator bursts. Everything is
// guarded so a missing AudioContext can never break the game.
export const STATIONS = ['SOLARA FM', 'BAY 97.5', 'VICE 101'];

const STATION_STYLE = [
  { bpm: 96, bass: [0, 0, 7, 0, 5, 0, 7, 10, 0, 0, 7, 0, 5, 3, 7, 12], lead: [12, 0, 0, 15, 0, 0, 12, 0, 10, 0, 0, 12, 0, 15, 17, 0], wave: 'triangle', bright: 0.5 },
  { bpm: 118, bass: [0, 0, 0, 7, 0, 0, 5, 0, 0, 0, 0, 7, 0, 10, 7, 5], lead: [0, 12, 0, 0, 15, 0, 12, 0, 0, 0, 17, 0, 15, 0, 12, 0], wave: 'square', bright: 0.35 },
  { bpm: 84, bass: [0, 5, 0, 0, 7, 0, 0, 3, 0, 5, 0, 0, 7, 0, 10, 0], lead: [12, 0, 15, 0, 0, 19, 0, 0, 17, 0, 15, 0, 12, 0, 0, 10], wave: 'sawtooth', bright: 0.3 },
];

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.stationIndex = -1; // -1 = OFF
    this._step = 0;
    this._nextTime = 0;
    this._timer = null;
    this._engineOsc = null;
    this._engineGain = null;
    this._noiseBuf = null;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.4;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 0.5;
      this._noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this._noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) {
      this.ctx = null;
      return false;
    }
    return true;
  }

  stationName() {
    return this.stationIndex < 0 ? 'OFF' : STATIONS[this.stationIndex];
  }

  cycleStation() {
    this.stationIndex = (this.stationIndex + 1) % STATIONS.length;
    if (this.stationIndex === 0 && this._wasOff) {
      // first press from OFF lands on SOLARA FM
    }
    this._wasOff = false;
    this._restartLoop();
    return this.stationName();
  }

  // First R press from the start must show SOLARA FM.
  pressR() {
    if (this.stationIndex < 0) {
      this.stationIndex = 0;
      this._wasOff = true;
      this._restartLoop();
      return this.stationName();
    }
    return this.cycleStation();
  }

  _restartLoop() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
    if (!this.ensure() || this.stationIndex < 0) return;
    const style = STATION_STYLE[this.stationIndex];
    const stepDur = 60 / style.bpm / 4;
    this._step = 0;
    this._nextTime = this.ctx.currentTime + 0.05;
    this._timer = setInterval(() => this._schedule(style, stepDur), 40);
  }

  _schedule(style, stepDur) {
    if (!this.ctx) return;
    while (this._nextTime < this.ctx.currentTime + 0.18) {
      const s = this._step % 16;
      const t = this._nextTime;
      const bassNote = style.bass[s];
      if (bassNote !== 0) this._tone(55 * Math.pow(2, bassNote / 12), t, stepDur * 0.9, style.wave, 0.30);
      const leadNote = style.lead[s];
      if (leadNote !== 0) this._tone(220 * Math.pow(2, leadNote / 12), t, stepDur * 0.5, 'sine', 0.12 * style.bright + 0.05);
      if (s % 2 === 0) this._hat(t, 0.03);
      if (s % 4 === 2) this._hat(t, 0.05);
      this._step++;
      this._nextTime += stepDur;
    }
  }

  _tone(freq, t, dur, wave, vol) {
    try {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = wave;
      o.frequency.value = freq;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g);
      g.connect(this.master);
      o.start(t);
      o.stop(t + dur + 0.05);
    } catch (e) { /* never break the game for sound */ }
  }

  _hat(t, vol) {
    try {
      const src = this.ctx.createBufferSource();
      src.buffer = this._noiseBuf;
      const f = this.ctx.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = 6000;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
      src.connect(f);
      f.connect(g);
      g.connect(this.master);
      src.start(t, Math.random() * 0.2);
      src.stop(t + 0.06);
    } catch (e) { /* ignore */ }
  }

  gunshot() {
    if (!this.ensure()) return;
    try {
      const t = this.ctx.currentTime;
      const src = this.ctx.createBufferSource();
      src.buffer = this._noiseBuf;
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(3000, t);
      f.frequency.exponentialRampToValueAtTime(300, t + 0.12);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.5, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      src.connect(f);
      f.connect(g);
      g.connect(this.master);
      src.start(t);
      src.stop(t + 0.18);
    } catch (e) { /* ignore */ }
  }

  explosion() {
    if (!this.ensure()) return;
    try {
      const t = this.ctx.currentTime;
      const src = this.ctx.createBufferSource();
      src.buffer = this._noiseBuf;
      src.loop = true;
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(900, t);
      f.frequency.exponentialRampToValueAtTime(60, t + 0.7);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.9, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
      src.connect(f);
      f.connect(g);
      g.connect(this.master);
      src.start(t);
      src.stop(t + 0.85);
      this._tone(70, t, 0.5, 'sine', 0.5);
    } catch (e) { /* ignore */ }
  }

  engine(on, speedNorm) {
    if (!this.ensure()) return;
    try {
      if (!on) {
        if (this._engineOsc) {
          this._engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
        }
        return;
      }
      if (!this._engineOsc) {
        this._engineOsc = this.ctx.createOscillator();
        this._engineGain = this.ctx.createGain();
        this._engineOsc.type = 'sawtooth';
        this._engineGain.gain.value = 0;
        const f = this.ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 500;
        this._engineOsc.connect(f);
        f.connect(this._engineGain);
        this._engineGain.connect(this.master);
        this._engineOsc.start();
      }
      const t = this.ctx.currentTime;
      this._engineOsc.frequency.setTargetAtTime(55 + speedNorm * 140, t, 0.08);
      this._engineGain.gain.setTargetAtTime(0.05 + speedNorm * 0.05, t, 0.1);
    } catch (e) { /* ignore */ }
  }
}
