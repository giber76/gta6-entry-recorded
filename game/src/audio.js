// audio.js — every sound in Solara Bay is synthesised with WebAudio:
// no audio files, no network. Engine hum, police siren, gunshots,
// punches, pickups, mission stingers — and a three-station radio.
//
// The sound engine has three layers: a voice rack (the two always-on
// voices, engine and siren), a pattern player (short sequences of notes
// and noise bursts, described as data), and the radio (a 16-step
// sequencer that loops its station's bass and lead lines).

// MIDI note number to frequency in Hz.
function midiToFreq(m) {
  return 440 * Math.pow(2, (m - 69) / 12);
}

// The radio stations. Each one is a 16-step loop: bass and lead are MIDI
// note numbers (0 = rest), played as sixteenth notes at the station's
// tempo. A hi-hat ticks on every even step.
const STATIONS = [
  {
    name: 'SOLARA FM',
    bpm: 96,
    bassWave: 'triangle',
    leadWave: 'sine',
    bass: [33, 0, 33, 0, 36, 0, 33, 0, 40, 0, 40, 0, 36, 0, 31, 0],
    lead: [69, 0, 72, 0, 76, 0, 72, 0, 69, 0, 67, 0, 64, 0, 67, 0],
  },
  {
    name: 'BAY 97.5',
    bpm: 112,
    bassWave: 'square',
    leadWave: 'triangle',
    bass: [28, 0, 28, 31, 28, 0, 35, 0, 28, 0, 28, 31, 33, 0, 31, 0],
    lead: [64, 67, 0, 69, 0, 67, 64, 0, 62, 0, 64, 0, 67, 69, 0, 0],
  },
  {
    name: 'VICE 101',
    bpm: 128,
    bassWave: 'sawtooth',
    leadWave: 'square',
    bass: [26, 26, 0, 26, 29, 0, 26, 0, 31, 0, 29, 0, 26, 0, 24, 0],
    lead: [62, 0, 65, 0, 69, 0, 65, 0, 62, 0, 65, 69, 0, 67, 65, 0],
  },
];

// One-shot effects, as patterns: a list of events. A note event is
// { at, freq, dur, wave, vol, slide? }; a burst event is
// { at, dur, vol, cutoff }. Times are milliseconds from the pattern start.
const PATTERNS = {
  shot: [
    { at: 0, dur: 0.14, vol: 0.5, cutoff: 2600 },
    { at: 0, freq: 160, dur: 0.08, wave: 'square', vol: 0.2, slide: 60 },
  ],
  enemyShot: [{ at: 0, dur: 0.12, vol: 0.22, cutoff: 2000 }],
  punch: [{ at: 0, dur: 0.08, vol: 0.3, cutoff: 900 }],
  pickup: [
    { at: 0, freq: 660, dur: 0.1, wave: 'sine', vol: 0.25 },
    { at: 90, freq: 990, dur: 0.14, wave: 'sine', vol: 0.25 },
  ],
  cash: [
    { at: 0, freq: 880, dur: 0.09, wave: 'triangle', vol: 0.3 },
    { at: 90, freq: 1174, dur: 0.09, wave: 'triangle', vol: 0.3 },
    { at: 180, freq: 1568, dur: 0.16, wave: 'triangle', vol: 0.3 },
  ],
  crash: [{ at: 0, dur: 0.2, vol: 0.35, cutoff: 700 }],
  explosion: [
    { at: 0, dur: 0.5, vol: 0.6, cutoff: 500 },
    { at: 0, freq: 90, dur: 0.5, wave: 'sine', vol: 0.4, slide: 30 },
    { at: 120, dur: 0.3, vol: 0.3, cutoff: 1200 },
  ],
  busted: [
    { at: 0, freq: 392, dur: 0.25, wave: 'sawtooth', vol: 0.2, slide: 196 },
    { at: 220, freq: 311, dur: 0.4, wave: 'sawtooth', vol: 0.2, slide: 155 },
  ],
  win: [
    { at: 0, freq: 523, dur: 0.22, wave: 'triangle', vol: 0.3 },
    { at: 130, freq: 659, dur: 0.22, wave: 'triangle', vol: 0.3 },
    { at: 260, freq: 784, dur: 0.22, wave: 'triangle', vol: 0.3 },
    { at: 390, freq: 1046, dur: 0.22, wave: 'triangle', vol: 0.3 },
  ],
};

export function createAudio() {
  const state = {
    ctx: null,
    master: null,
    engine: null,
    siren: null,
    radio: null,
  };

  // One short oscillator note, optionally sliding to another pitch.
  // spec: { freq, dur, wave, vol, slide?, at? } — at is ms from now.
  function scheduleNote(spec) {
    if (!state.ctx) return;
    const ctx = state.ctx;
    const t = ctx.currentTime + (spec.at ?? 0) / 1000;
    const osc = ctx.createOscillator();
    osc.type = spec.wave ?? 'sine';
    osc.frequency.setValueAtTime(spec.freq, t);
    if (spec.slide !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, spec.slide), t + spec.dur);
    }
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(spec.vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + spec.dur);
    osc.connect(gain);
    gain.connect(state.master);
    osc.start(t);
    osc.stop(t + spec.dur + 0.02);
  }

  // One short burst of filtered noise (shots, punches, crashes).
  // spec: { dur, vol, cutoff, at? }
  function scheduleHiss(spec) {
    if (!state.ctx) return;
    const ctx = state.ctx;
    const t = ctx.currentTime + (spec.at ?? 0) / 1000;
    const len = Math.max(1, Math.floor(ctx.sampleRate * spec.dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = spec.cutoff;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(spec.vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + spec.dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(state.master);
    src.start(t);
  }

  // Play a pattern: notes go through scheduleNote, bursts through
  // scheduleHiss. The pattern's `at` offsets are milliseconds.
  function playPattern(events) {
    for (const ev of events) {
      if (ev.freq !== undefined) scheduleNote(ev);
      else scheduleHiss(ev);
    }
  }

  // The radio: a 16-step sequencer looping the current station. Each
  // step plays the station's bass note, lead note and (on even steps)
  // a hi-hat tick. R cycles the station; the HUD reads the name.
  function buildRadio() {
    const radio = { index: 0, step: 0, timer: 0 };
    radio.name = function () {
      return STATIONS[radio.index].name;
    };
    radio.next = function () {
      radio.index = (radio.index + 1) % STATIONS.length;
      radio.step = 0;
      radio.timer = 0;
      return radio.name();
    };
    radio.set = function (i) {
      radio.index = ((i % STATIONS.length) + STATIONS.length) % STATIONS.length;
      radio.step = 0;
      radio.timer = 0;
    };
    radio.tick = function (dt) {
      if (!state.ctx) return;
      const station = STATIONS[radio.index];
      const stepDur = 60 / station.bpm / 4;
      radio.timer += dt;
      while (radio.timer >= stepDur) {
        radio.timer -= stepDur;
        const s = radio.step;
        const bassNote = station.bass[s];
        if (bassNote) {
          scheduleNote({
            freq: midiToFreq(bassNote),
            dur: stepDur * 0.9,
            wave: station.bassWave,
            vol: 0.16,
          });
        }
        const leadNote = station.lead[s];
        if (leadNote) {
          scheduleNote({
            freq: midiToFreq(leadNote),
            dur: stepDur * 0.9,
            wave: station.leadWave,
            vol: 0.08,
          });
        }
        if (s % 2 === 0) scheduleHiss({ dur: 0.03, vol: 0.05, cutoff: 8000 });
        radio.step = (radio.step + 1) % 16;
      }
    };
    return radio;
  }

  // Build the context and the two always-on voices on first use.
  // Returns false if the browser has no WebAudio.
  function buildContext() {
    if (state.ctx) {
      if (state.ctx.state === 'suspended') state.ctx.resume();
      return true;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try {
      state.ctx = new AC();
    } catch (err) {
      return false;
    }
    const ctx = state.ctx;
    state.master = ctx.createGain();
    state.master.gain.value = 0.5;
    state.master.connect(ctx.destination);
    // Engine voice: a low sawtooth through a lowpass, pitch follows speed.
    const engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 55;
    const engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 420;
    const engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engineOsc.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(state.master);
    engineOsc.start();
    state.engine = { osc: engineOsc, gain: engineGain };
    // Siren voice: a sine that alternates between two tones.
    const sirenOsc = ctx.createOscillator();
    sirenOsc.type = 'sine';
    sirenOsc.frequency.value = 720;
    const sirenGain = ctx.createGain();
    sirenGain.gain.value = 0;
    sirenOsc.connect(sirenGain);
    sirenGain.connect(state.master);
    sirenOsc.start();
    state.siren = { osc: sirenOsc, gain: sirenGain, timer: 0, high: false };
    state.radio = buildRadio();
    return true;
  }

  // The public sound board. Every effect ensures the context first.
  const api = {
    unlock: buildContext,

    setEngine(speed01, on) {
      if (!state.ctx || !state.engine) return;
      const target = on ? 0.05 + speed01 * 0.09 : 0;
      state.engine.gain.gain.setTargetAtTime(target, state.ctx.currentTime, 0.08);
      state.engine.osc.frequency.setTargetAtTime(55 + speed01 * 130, state.ctx.currentTime, 0.08);
    },

    // Per-frame: the siren wails while wanted, the radio steps along.
    tick(dt, wanted) {
      if (!state.ctx) return;
      const siren = state.siren;
      if (siren) {
        if (wanted > 0) {
          siren.timer += dt;
          if (siren.timer > 0.42) {
            siren.timer = 0;
            siren.high = !siren.high;
            siren.osc.frequency.setTargetAtTime(siren.high ? 920 : 660, state.ctx.currentTime, 0.03);
          }
          siren.gain.gain.setTargetAtTime(0.045, state.ctx.currentTime, 0.1);
        } else {
          siren.gain.gain.setTargetAtTime(0, state.ctx.currentTime, 0.1);
        }
      }
      if (state.radio) state.radio.tick(dt);
    },

    shot() {
      if (!buildContext()) return;
      playPattern(PATTERNS.shot);
    },

    enemyShot() {
      if (!buildContext()) return;
      playPattern(PATTERNS.enemyShot);
    },

    punch() {
      if (!buildContext()) return;
      playPattern(PATTERNS.punch);
    },

    pickup() {
      if (!buildContext()) return;
      playPattern(PATTERNS.pickup);
    },

    cash() {
      if (!buildContext()) return;
      playPattern(PATTERNS.cash);
    },

    crash() {
      if (!buildContext()) return;
      playPattern(PATTERNS.crash);
    },

    explosion() {
      if (!buildContext()) return;
      playPattern(PATTERNS.explosion);
    },

    busted() {
      if (!buildContext()) return;
      playPattern(PATTERNS.busted);
    },

    win() {
      if (!buildContext()) return;
      playPattern(PATTERNS.win);
    },

    nextStation() {
      if (!buildContext()) return '';
      return state.radio.next();
    },

    stationName() {
      return state.radio ? state.radio.name() : STATIONS[0].name;
    },

    stationIndex() {
      return state.radio ? state.radio.index : 0;
    },

    setStation(i) {
      if (!buildContext()) return;
      state.radio.set(i);
    },
  };

  return api;
}
