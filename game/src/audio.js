// audio.js — generated radio stations + simple sound effects for Solara Bay.
// No audio files: every station is a 16-step bass + lead + hats loop built
// with WebAudio oscillators. Everything is wrapped so a missing or
// suspended AudioContext can never throw or break the game.

export const STATIONS = ['SOLARA FM', 'BAY 97.5', 'VICE 101'];

// 16-step patterns, one row per station. Values are semitone offsets from
// the station root; 0 means rest for the lead row.
const PATTERNS = [
  {
    root: 55,
    bass: [0, 0, 7, 0, 0, 10, 0, 7, 0, 0, 7, 0, 12, 0, 10, 7],
    lead: [12, 0, 15, 0, 19, 0, 15, 0, 12, 0, 17, 0, 19, 0, 15, 12],
    tempo: 116,
  },
  {
    root: 49,
    bass: [0, 0, 0, 5, 0, 0, 3, 0, 0, 0, 0, 5, 0, 7, 0, 3],
    lead: [12, 0, 0, 15, 0, 17, 0, 0, 19, 0, 17, 0, 15, 0, 12, 0],
    tempo: 96,
  },
  {
    root: 62,
    bass: [0, 3, 0, 0, 5, 0, 3, 0, 0, 0, 7, 0, 5, 0, 3, 0],
    lead: [0, 12, 0, 15, 0, 0, 19, 0, 17, 0, 15, 0, 12, 0, 19, 0],
    tempo: 128,
  },
];

function semitoneToFreq(root, semis) {
  return root * Math.pow(2, semis / 12);
}

export function createAudio(world) {
  const audio = {
    ctx: null,
    master: null,
    station: -1, // -1 = off, 0/1/2 = station index
    step: 0,
    nextStepTime: 0,
    noiseBuf: null,
    enabled: false,
  };

  audio.ensure = function () {
    if (audio.ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      audio.ctx = new AC();
      audio.master = audio.ctx.createGain();
      audio.master.gain.value = 0.16;
      audio.master.connect(audio.ctx.destination);
      const len = audio.ctx.sampleRate * 0.25;
      audio.noiseBuf = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
      const data = audio.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      audio.enabled = true;
      return true;
    } catch (err) {
      audio.enabled = false;
      return false;
    }
  };

  audio.resume = function () {
    try {
      if (audio.ctx && audio.ctx.state === 'suspended') audio.ctx.resume();
    } catch (err) {
      /* audio is best-effort */
    }
  };

  audio.setStation = function (index) {
    audio.station = index;
    audio.step = 0;
    if (audio.ctx) audio.nextStepTime = audio.ctx.currentTime + 0.05;
    world.radio.station = index;
  };

  audio.cycleStation = function () {
    const next = audio.station < 0 ? 0 : (audio.station + 1) % STATIONS.length;
    audio.setStation(next);
    return STATIONS[next];
  };

  function playTone(freq, time, dur, type, vol) {
    try {
      const osc = audio.ctx.createOscillator();
      const gain = audio.ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(vol, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
      osc.connect(gain);
      gain.connect(audio.master);
      osc.start(time);
      osc.stop(time + dur + 0.02);
    } catch (err) {
      /* ignore */
    }
  }

  function playHat(time) {
    try {
      const src = audio.ctx.createBufferSource();
      src.buffer = audio.noiseBuf;
      const gain = audio.ctx.createGain();
      const filter = audio.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 7000;
      gain.gain.setValueAtTime(0.08, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(audio.master);
      src.start(time);
      src.stop(time + 0.06);
    } catch (err) {
      /* ignore */
    }
  }

  // Called every frame; schedules the radio loop a little ahead of time.
  audio.update = function () {
    if (!audio.enabled || audio.station < 0 || !audio.ctx) return;
    try {
      if (audio.ctx.state === 'suspended') return;
      const pat = PATTERNS[audio.station];
      const stepDur = 60 / pat.tempo / 4;
      if (audio.nextStepTime < audio.ctx.currentTime) {
        audio.nextStepTime = audio.ctx.currentTime + 0.05;
      }
      while (audio.nextStepTime < audio.ctx.currentTime + 0.15) {
        const s = audio.step % 16;
        const t = audio.nextStepTime;
        const bassNote = pat.bass[s];
        if (bassNote !== null && bassNote !== undefined) {
          playTone(
            semitoneToFreq(pat.root, bassNote),
            t,
            stepDur * 0.9,
            'triangle',
            0.5,
          );
        }
        const leadNote = pat.lead[s];
        if (leadNote) {
          playTone(
            semitoneToFreq(pat.root * 2, leadNote),
            t,
            stepDur * 0.8,
            'square',
            0.1,
          );
        }
        if (s % 2 === 0) playHat(t);
        audio.step += 1;
        audio.nextStepTime += stepDur;
      }
    } catch (err) {
      /* ignore */
    }
  };

  function blip(freq, dur, type, vol) {
    if (!audio.enabled || !audio.ctx) return;
    try {
      if (audio.ctx.state === 'suspended') return;
      playTone(freq, audio.ctx.currentTime, dur, type, vol);
    } catch (err) {
      /* ignore */
    }
  }

  audio.shoot = function () {
    if (!audio.enabled || !audio.ctx) return;
    try {
      if (audio.ctx.state === 'suspended') return;
      const src = audio.ctx.createBufferSource();
      src.buffer = audio.noiseBuf;
      const gain = audio.ctx.createGain();
      const filter = audio.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 1800;
      gain.gain.setValueAtTime(0.5, audio.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audio.ctx.currentTime + 0.12);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(audio.master);
      src.start();
      src.stop(audio.ctx.currentTime + 0.13);
    } catch (err) {
      /* ignore */
    }
  };

  audio.explosion = function () {
    if (!audio.enabled || !audio.ctx) return;
    try {
      if (audio.ctx.state === 'suspended') return;
      const src = audio.ctx.createBufferSource();
      src.buffer = audio.noiseBuf;
      const gain = audio.ctx.createGain();
      const filter = audio.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 320;
      gain.gain.setValueAtTime(0.9, audio.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audio.ctx.currentTime + 0.7);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(audio.master);
      src.start();
      src.stop(audio.ctx.currentTime + 0.75);
      blip(48, 0.5, 'sine', 0.5);
    } catch (err) {
      /* ignore */
    }
  };

  audio.crash = function () {
    blip(90, 0.12, 'sawtooth', 0.25);
  };

  audio.pickup = function () {
    blip(660, 0.09, 'sine', 0.2);
    setTimeout(() => blip(880, 0.12, 'sine', 0.2), 90);
  };

  world.audio = audio;
  return audio;
}
