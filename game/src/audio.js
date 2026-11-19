// audio.js — every sound is synthesised with WebAudio: no audio files, no
// network. Engine hum, police siren, gunshots, punches, pickups and the
// mission stingers.
//
// Two primitives do all the work: tone() (an oscillator note that can
// slide) and noise() (a burst of filtered noise). The named effects are
// data: small tables of notes and bursts, played by playNotes()/playBursts().

export function createAudio() {
  const audio = {
    ctx: null,
    master: null,
    engineOsc: null,
    engineGain: null,
    sirenOsc: null,
    sirenGain: null,
    sirenTimer: 0,
    sirenHigh: false,
    muted: false,
  };

  // Build the context and the two always-on voices on first use. Returns
  // false if the browser has no WebAudio.
  function ensure() {
    if (audio.ctx) {
      if (audio.ctx.state === 'suspended') audio.ctx.resume();
      return true;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try {
      audio.ctx = new AC();
    } catch (err) {
      return false;
    }
    audio.master = audio.ctx.createGain();
    audio.master.gain.value = 0.5;
    audio.master.connect(audio.ctx.destination);
    // Engine voice: a low sawtooth through a lowpass, pitch follows speed.
    audio.engineOsc = audio.ctx.createOscillator();
    audio.engineOsc.type = 'sawtooth';
    audio.engineOsc.frequency.value = 55;
    const filter = audio.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    audio.engineGain = audio.ctx.createGain();
    audio.engineGain.gain.value = 0.0;
    audio.engineOsc.connect(filter);
    filter.connect(audio.engineGain);
    audio.engineGain.connect(audio.master);
    audio.engineOsc.start();
    // Siren voice: a sine that alternates between two tones.
    audio.sirenOsc = audio.ctx.createOscillator();
    audio.sirenOsc.type = 'sine';
    audio.sirenOsc.frequency.value = 720;
    audio.sirenGain = audio.ctx.createGain();
    audio.sirenGain.gain.value = 0.0;
    audio.sirenOsc.connect(audio.sirenGain);
    audio.sirenGain.connect(audio.master);
    audio.sirenOsc.start();
    return true;
  }

  // One short oscillator note, optionally sliding down to another pitch.
  // note = [freq, dur, type, vol, slideTo?]
  function tone(note) {
    if (!ensure()) return;
    const [freq, dur, type, vol, slideTo] = note;
    const t = audio.ctx.currentTime;
    const osc = audio.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const gain = audio.ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(audio.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  // One short burst of filtered noise (shots, punches, crashes).
  // spec = [dur, vol, filterFreq]
  function noise(spec) {
    if (!ensure()) return;
    const [dur, vol, filterFreq] = spec;
    const t = audio.ctx.currentTime;
    const len = Math.max(1, Math.floor(audio.ctx.sampleRate * dur));
    const buffer = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = audio.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = audio.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = audio.ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(audio.master);
    src.start(t);
  }

  // Play a list of notes, each [delayMs, note...].
  function playNotes(list) {
    for (const [delay, ...note] of list) {
      if (delay > 0) setTimeout(() => tone(note), delay);
      else tone(note);
    }
  }

  audio.unlock = ensure;

  audio.setEngine = function setEngine(speed01, on) {
    if (!audio.ctx || !audio.engineOsc) return;
    const target = on ? 0.05 + speed01 * 0.09 : 0.0;
    audio.engineGain.gain.setTargetAtTime(target, audio.ctx.currentTime, 0.08);
    audio.engineOsc.frequency.setTargetAtTime(55 + speed01 * 130, audio.ctx.currentTime, 0.08);
  };

  audio.tick = function tick(dt, wanted) {
    if (!audio.ctx || !audio.sirenOsc) return;
    if (wanted > 0) {
      audio.sirenTimer += dt;
      if (audio.sirenTimer > 0.42) {
        audio.sirenTimer = 0;
        audio.sirenHigh = !audio.sirenHigh;
        audio.sirenOsc.frequency.setTargetAtTime(audio.sirenHigh ? 920 : 660, audio.ctx.currentTime, 0.03);
      }
      audio.sirenGain.gain.setTargetAtTime(0.045, audio.ctx.currentTime, 0.1);
    } else {
      audio.sirenGain.gain.setTargetAtTime(0.0, audio.ctx.currentTime, 0.1);
    }
  };

  audio.shot = function shot() {
    noise([0.14, 0.5, 2600]);
    tone([160, 0.08, 'square', 0.2, 60]);
  };

  audio.enemyShot = function enemyShot() {
    noise([0.12, 0.22, 2000]);
  };

  audio.punch = function punch() {
    noise([0.08, 0.3, 900]);
  };

  audio.pickup = function pickup() {
    playNotes([
      [0, 660, 0.1, 'sine', 0.25],
      [90, 990, 0.14, 'sine', 0.25],
    ]);
  };

  audio.cash = function cash() {
    playNotes([
      [0, 880, 0.09, 'triangle', 0.3],
      [90, 1174, 0.09, 'triangle', 0.3],
      [180, 1568, 0.16, 'triangle', 0.3],
    ]);
  };

  audio.crash = function crash() {
    noise([0.2, 0.35, 700]);
  };

  audio.busted = function busted() {
    playNotes([
      [0, 392, 0.25, 'sawtooth', 0.2, 196],
      [220, 311, 0.4, 'sawtooth', 0.2, 155],
    ]);
  };

  audio.win = function win() {
    playNotes([
      [0, 523, 0.22, 'triangle', 0.3],
      [130, 659, 0.22, 'triangle', 0.3],
      [260, 784, 0.22, 'triangle', 0.3],
      [390, 1046, 0.22, 'triangle', 0.3],
    ]);
  };

  return audio;
}
