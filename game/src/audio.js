// audio.js — every sound in Solara Bay is made with WebAudio: no audio
// files, no network. Engine hum, police siren, gunshots, punches,
// pickups, mission stingers — and a three-station radio.
// First R press switches the radio on to SOLARA FM; later presses cycle.
//
// Three layers do the work: a voice rack (the two always-on voices,
// engine and siren), a pattern player (short sequences of notes and
// noise bursts, described as data), and the radio (a 16-step sequencer
// that loops its station's bass and lead lines).

// MIDI note number to frequency in Hz.
function noteHz(m) {
  return 440 * Math.pow(2, (m - 69) / 12);
}

// The radio stations. Bass and lead are 16-step loops written as
// space-separated MIDI note numbers (0 = rest), played as sixteenth
// notes at the station's tempo. A hi-hat ticks on every even step.
const STATION_ROWS = [
  ['SOLARA FM', 96, 'triangle', 'sine',
    '33 0 33 0 36 0 33 0 40 0 40 0 36 0 31 0',
    '69 0 72 0 76 0 72 0 69 0 67 0 64 0 67 0'],
  ['BAY 97.5', 112, 'square', 'triangle',
    '28 0 28 31 28 0 35 0 28 0 28 31 33 0 31 0',
    '64 67 0 69 0 67 64 0 62 0 64 0 67 69 0 0'],
  ['VICE 101', 128, 'sawtooth', 'square',
    '26 26 0 26 29 0 26 0 31 0 29 0 26 0 24 0',
    '62 0 65 0 69 0 65 0 62 0 65 69 0 67 65 0'],
];
const STATIONS = STATION_ROWS.map(([name, bpm, bassWave, leadWave, bass, lead]) => ({
  name,
  bpm,
  bassWave,
  leadWave,
  bass: bass.split(' ').map(Number),
  lead: lead.split(' ').map(Number),
}));

// One-shot effects, as compact event rows. A note row is
// [at, freq, dur, wave, vol, slide?]; a burst row is
// [at, dur, vol, cutoff]. Times are milliseconds from the pattern start.
const PATTERN_ROWS = {
  shot: [
    [0, 0.14, 0.5, 2600],
    [0, 160, 0.08, 'square', 0.2, 60],
  ],
  enemyShot: [[0, 0.12, 0.22, 2000]],
  punch: [[0, 0.08, 0.3, 900]],
  pickup: [
    [0, 660, 0.1, 'sine', 0.25],
    [90, 990, 0.14, 'sine', 0.25],
  ],
  cash: [
    [0, 880, 0.09, 'triangle', 0.3],
    [90, 1174, 0.09, 'triangle', 0.3],
    [180, 1568, 0.16, 'triangle', 0.3],
  ],
  crash: [[0, 0.2, 0.35, 700]],
  explosion: [
    [0, 0.5, 0.6, 500],
    [0, 90, 0.5, 'sine', 0.4, 30],
    [120, 0.3, 0.3, 1200],
  ],
  busted: [
    [0, 392, 0.25, 'sawtooth', 0.2, 196],
    [220, 311, 0.4, 'sawtooth', 0.2, 155],
  ],
  win: [
    [0, 523, 0.22, 'triangle', 0.3],
    [130, 659, 0.22, 'triangle', 0.3],
    [260, 784, 0.22, 'triangle', 0.3],
    [390, 1046, 0.22, 'triangle', 0.3],
  ],
  // A new job starts: a short rising figure that says "go".
  missionStart: [
    [0, 392, 0.12, 'triangle', 0.28],
    [110, 523, 0.12, 'triangle', 0.28],
    [220, 659, 0.2, 'triangle', 0.3],
  ],
  // The heat goes up: a low two-note warning.
  wantedUp: [
    [0, 220, 0.16, 'sawtooth', 0.2, 180],
    [150, 233, 0.2, 'sawtooth', 0.2, 175],
  ],
  // The engine turning over when Marlo steals a car.
  engineStart: [
    [0, 60, 0.3, 'sawtooth', 0.25, 110],
    [260, 110, 0.15, 'sawtooth', 0.2, 165],
  ],
  // A low-health heartbeat: two dull thumps, Marlo is almost done.
  heartbeat: [
    [0, 55, 0.12, 'sine', 0.4],
    [180, 50, 0.16, 'sine', 0.35],
  ],
};

// Expand the compact rows into event objects. A row with a wave string
// is a note { at, freq, dur, wave, vol, slide? }; a row without one is
// a noise burst { at, dur, vol, cutoff }.
function expandPattern(rows) {
  return rows.map((row) => {
    if (typeof row[3] === 'string') {
      const [at, freq, dur, wave, vol, slide] = row;
      return { at, freq, dur, wave, vol, slide };
    }
    const [at, dur, vol, cutoff] = row;
    return { at, dur, vol, cutoff };
  });
}
const PATTERNS = Object.fromEntries(
  Object.entries(PATTERN_ROWS).map(([name, rows]) => [name, expandPattern(rows)])
);

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
  function playTone(spec) {
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
  function playHiss(spec) {
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

  // Play a pattern: notes go through playTone, bursts through
  // playHiss. The pattern's `at` offsets are milliseconds.
  function playEvents(events) {
    for (const ev of events) {
      if (ev.freq !== undefined) playTone(ev);
      else playHiss(ev);
    }
  }

  // The radio: a 16-step sequencer looping the current station. Each
  // step plays the station's bass note, lead note and (on even steps)
  // a hi-hat tick. R cycles the station; the HUD reads the name.
  function makeRadio() {
    // fresh: the first R press after the radio is built returns the
    // current station (SOLARA FM) without advancing — the station the
    // radio starts on is the one the first press should show.
    const radio = { index: 0, step: 0, timer: 0, fresh: true };
    radio.name = function () {
      return STATIONS[radio.index].name;
    };
    radio.next = function () {
      if (radio.fresh) {
        radio.fresh = false;
        return radio.name();
      }
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
          playTone({
            freq: noteHz(bassNote),
            dur: stepDur * 0.9,
            wave: station.bassWave,
            vol: 0.16,
          });
        }
        const leadNote = station.lead[s];
        if (leadNote) {
          playTone({
            freq: noteHz(leadNote),
            dur: stepDur * 0.9,
            wave: station.leadWave,
            vol: 0.08,
          });
        }
        if (s % 2 === 0) playHiss({ dur: 0.03, vol: 0.05, cutoff: 8000 });
        radio.step = (radio.step + 1) % 16;
      }
    };
    return radio;
  }

  // Build the context and the two always-on voices on first use.
  // Returns false if the browser has no WebAudio.
  function ensureContext() {
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
    state.radio = makeRadio();
    return true;
  }

  // The public sound board. Every effect ensures the context first.
  const api = {
    unlock: ensureContext,

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
      if (!ensureContext()) return;
      playEvents(PATTERNS.shot);
    },

    enemyShot() {
      if (!ensureContext()) return;
      playEvents(PATTERNS.enemyShot);
    },

    punch() {
      if (!ensureContext()) return;
      playEvents(PATTERNS.punch);
    },

    pickup() {
      if (!ensureContext()) return;
      playEvents(PATTERNS.pickup);
    },

    cash() {
      if (!ensureContext()) return;
      playEvents(PATTERNS.cash);
    },

    crash() {
      if (!ensureContext()) return;
      playEvents(PATTERNS.crash);
    },

    explosion() {
      if (!ensureContext()) return;
      playEvents(PATTERNS.explosion);
    },

    busted() {
      if (!ensureContext()) return;
      playEvents(PATTERNS.busted);
    },

    win() {
      if (!ensureContext()) return;
      playEvents(PATTERNS.win);
    },

    missionStart() {
      if (!ensureContext()) return;
      playEvents(PATTERNS.missionStart);
    },

    wantedUp() {
      if (!ensureContext()) return;
      playEvents(PATTERNS.wantedUp);
    },

    engineStart() {
      if (!ensureContext()) return;
      playEvents(PATTERNS.engineStart);
    },

    heartbeat() {
      if (!ensureContext()) return;
      playEvents(PATTERNS.heartbeat);
    },

    nextStation() {
      if (!ensureContext()) return '';
      return state.radio.next();
    },

    stationName() {
      return state.radio ? state.radio.name() : STATIONS[0].name;
    },

    // The station label for the debug snapshot: 'RADIO OFF' until the
    // radio has actually been built (unlike stationName, which names
    // the first station even when there is no radio yet).
    radioLabel() {
      return state.radio ? state.radio.name() : 'RADIO OFF';
    },

    stationIndex() {
      return state.radio ? state.radio.index : 0;
    },

    setStation(i) {
      if (!ensureContext()) return;
      state.radio.set(i);
    },
  };

  return api;
}
