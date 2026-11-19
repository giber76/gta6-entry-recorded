// audio.js — all sound is synthesised with WebAudio: no audio files, no network.
// Engine hum, police siren, gunshots, punches, pickups and mission stingers.

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

  function ensure() {
    if (audio.ctx) {
      if (audio.ctx.state === 'suspended') audio.ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      audio.ctx = new AC();
      audio.master = audio.ctx.createGain();
      audio.master.gain.value = 0.5;
      audio.master.connect(audio.ctx.destination);
      // Engine: a low sawtooth whose pitch follows speed.
      audio.engineOsc = audio.ctx.createOscillator();
      audio.engineOsc.type = 'sawtooth';
      audio.engineOsc.frequency.value = 55;
      audio.engineGain = audio.ctx.createGain();
      audio.engineGain.gain.value = 0.0;
      const engineFilter = audio.ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      audio.engineOsc.connect(engineFilter);
      engineFilter.connect(audio.engineGain);
      audio.engineGain.connect(audio.master);
      audio.engineOsc.start();
      // Siren: a sine that alternates between two tones.
      audio.sirenOsc = audio.ctx.createOscillator();
      audio.sirenOsc.type = 'sine';
      audio.sirenOsc.frequency.value = 720;
      audio.sirenGain = audio.ctx.createGain();
      audio.sirenGain.gain.value = 0.0;
      audio.sirenOsc.connect(audio.sirenGain);
      audio.sirenGain.connect(audio.master);
      audio.sirenOsc.start();
      return true;
    } catch (err) {
      return false;
    }
  }

  function blip(freq, dur, type, vol, slideTo) {
    if (!ensure()) return;
    const t = audio.ctx.currentTime;
    const osc = audio.ctx.createOscillator();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const gain = audio.ctx.createGain();
    gain.gain.setValueAtTime(vol || 0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(audio.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noiseBurst(dur, vol, filterFreq) {
    if (!ensure()) return;
    const t = audio.ctx.currentTime;
    const len = Math.max(1, Math.floor(audio.ctx.sampleRate * dur));
    const buffer = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = audio.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = audio.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq || 1800;
    const gain = audio.ctx.createGain();
    gain.gain.setValueAtTime(vol || 0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(audio.master);
    src.start(t);
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
    noiseBurst(0.14, 0.5, 2600);
    blip(160, 0.08, 'square', 0.2, 60);
  };

  audio.enemyShot = function enemyShot() {
    noiseBurst(0.12, 0.22, 2000);
  };

  audio.punch = function punch() {
    noiseBurst(0.08, 0.3, 900);
  };

  audio.pickup = function pickup() {
    blip(660, 0.1, 'sine', 0.25);
    setTimeout(() => blip(990, 0.14, 'sine', 0.25), 90);
  };

  audio.cash = function cash() {
    blip(880, 0.09, 'triangle', 0.3);
    setTimeout(() => blip(1174, 0.09, 'triangle', 0.3), 90);
    setTimeout(() => blip(1568, 0.16, 'triangle', 0.3), 180);
  };

  audio.crash = function crash() {
    noiseBurst(0.2, 0.35, 700);
  };

  audio.busted = function busted() {
    blip(392, 0.25, 'sawtooth', 0.2, 196);
    setTimeout(() => blip(311, 0.4, 'sawtooth', 0.2, 155), 220);
  };

  audio.win = function win() {
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.22, 'triangle', 0.3), i * 130));
  };

  return audio;
}
