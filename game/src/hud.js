// hud.js — the Solara Bay HUD: health, cash, wanted stars, objective,
// prompts, dialogue, toasts, speed, the car's health while driving, the
// radio station, and the menu / pause / busted / win screens.
// The radio label shows the current station; the car bar appears only while driving.
//
// The damage vignette flashes red when Marlo takes a hit (player.js
// sets game.hudFlash) and fades out over the next second.

import { nearestParkedCar } from './vehicles.js';

function grab(id) {
  return document.getElementById(id);
}

function healthColor(h) {
  if (h > 50) return '#37c978';
  if (h > 25) return '#f0a13a';
  return '#e33d3d';
}

function money(c) {
  return `$${c.toLocaleString('en-US')}`;
}

// Element ids, grouped by role. The HUD object is built from this table.
const EL_IDS = {
  healthFill: 'health-fill',
  healthText: 'health-text',
  carHealthBar: 'car-health-bar',
  carHealthFill: 'car-health-fill',
  carHealthLabel: 'car-health-label',
  cashText: 'cash-text',
  starsEl: 'stars',
  objectiveText: 'objective-text',
  objectiveDist: 'objective-dist',
  promptEl: 'prompt',
  dialogueEl: 'dialogue',
  dialogueText: 'dialogue-text',
  toastEl: 'toasts',
  speedEl: 'speed',
  weaponEl: 'weapon',
  radioEl: 'radio',
  flashEl: 'damage-flash',
  missionEl: 'mission-name',
  startTitle: 'start-title',
  winCash: 'win-cash',
  bustedCash: 'busted-cash',
};

export function createHud(game) {
  const hud = { toasts: [] };
  for (const [field, id] of Object.entries(EL_IDS)) hud[field] = grab(id);
  hud.screens = {
    start: grab('screen-start'),
    pause: grab('screen-pause'),
    busted: grab('screen-busted'),
    win: grab('screen-win'),
  };

  hud.setHealth = function setHealth(h) {
    const pct = Math.max(0, Math.min(100, h));
    hud.healthFill.style.width = `${pct}%`;
    hud.healthFill.style.background = healthColor(h);
    hud.healthText.textContent = `${Math.ceil(h)}`;
  };

  // The driven car's health, shown only while Marlo is behind the wheel.
  hud.setCarHealth = function setCarHealth(h) {
    const show = h != null;
    hud.carHealthBar.style.display = show ? 'block' : 'none';
    hud.carHealthLabel.style.display = show ? 'block' : 'none';
    if (!show) return;
    const pct = Math.max(0, Math.min(100, h));
    hud.carHealthFill.style.width = `${pct}%`;
    hud.carHealthFill.style.background = healthColor(h);
  };

  hud.setCash = function setCash(c) {
    hud.cashText.textContent = money(c);
  };

  hud.setStars = function setStars(n) {
    let s = '';
    for (let i = 0; i < 5; i++) s += i < n ? '★' : '☆';
    hud.starsEl.textContent = s;
    hud.starsEl.classList.toggle('hot', n > 0);
  };

  hud.setMission = function setMission(name, num, total) {
    hud.missionEl.textContent = `Mission ${num}/${total} — ${name}`;
  };

  hud.setObjective = function setObjective(text, dist) {
    hud.objectiveText.textContent = text;
    hud.objectiveDist.textContent = dist != null ? `${Math.round(dist)}m` : '';
  };

  hud.setPrompt = function setPrompt(text) {
    hud.promptEl.textContent = text || '';
    hud.promptEl.style.display = text ? 'block' : 'none';
  };

  hud.setDialogue = function setDialogue(text) {
    hud.dialogueText.textContent = text || '';
    hud.dialogueEl.style.display = text ? 'block' : 'none';
  };

  hud.setSpeed = function setSpeed(kmh) {
    hud.speedEl.textContent = kmh > 1 ? `${Math.round(kmh)} km/h` : '';
  };

  hud.setWeapon = function setWeapon(w) {
    hud.weaponEl.textContent = w === 'pistol' ? 'PISTOL [Q]' : 'FISTS [Q]';
  };

  hud.setRadio = function setRadio(name) {
    hud.radioEl.textContent = name ? `RADIO ${name} [R]` : '';
  };

  hud.toast = function toast(text) {
    const div = document.createElement('div');
    div.className = 'toast';
    div.textContent = text;
    hud.toastEl.appendChild(div);
    hud.toasts.push({ el: div, t: 0 });
    while (hud.toastEl.children.length > 4) hud.toastEl.removeChild(hud.toastEl.firstChild);
  };

  hud.tickToasts = function tickToasts(dt) {
    for (const t of hud.toasts) {
      t.t += dt;
      if (t.t > 4) t.el.style.opacity = '0';
      if (t.t > 4.6 && t.el.parentNode) t.el.parentNode.removeChild(t.el);
    }
    hud.toasts = hud.toasts.filter((t) => t.t <= 4.6);
  };

  hud.showScreen = function showScreen(name) {
    for (const key of Object.keys(hud.screens)) {
      hud.screens[key].style.display = key === name ? 'flex' : 'none';
    }
    grab('hud').style.display = name === null ? 'block' : 'none';
  };

  game.hud = hud;
  return hud;
}

// What E does right now, as a prompt line.
function currentPrompt(game) {
  const p = game.player;
  const m = game.mission;
  if (game.state !== 'playing' || p.health <= 0) return '';
  const bits = [];
  if (p.inCar) {
    bits.push('[E] Get out', '[SPACE] Handbrake');
  } else if (nearestParkedCar(game)) {
    bits.push('[E] Steal car');
  } else if (
    m.index === 4 &&
    m.stage === 0 &&
    m.target &&
    Math.hypot(p.pos.x - m.target.x, p.pos.z - m.target.z) < 6
  ) {
    bits.push('Hold [E] to grab the cash');
  }
  if (p.hasPistol) bits.push('[Q] Switch weapon', '[Click] Shoot');
  else if (!p.inCar) bits.push('[Q] Fists', '[Click] Punch');
  return bits.join('    ');
}

// Per-frame HUD refresh: health, cash, objective distance, speed, prompts,
// the driven car's health, the radio station and the damage vignette.
export function updateHud(game, dt) {
  const hud = game.hud;
  const p = game.player;
  hud.setHealth(p.health);
  hud.setCash(p.cash);
  hud.setStars(game.wanted);
  hud.setWeapon(p.hasPistol ? p.weapon : 'fists');
  const speedKmh = p.inCar && p.car ? Math.abs(p.car.speed) * 3.6 : p.speed * 3.6;
  hud.setSpeed(speedKmh);
  hud.setCarHealth(p.inCar && p.car ? p.car.health : null);
  hud.setRadio(game.audio ? game.audio.stationName() : '');
  // The damage vignette: flashes red on a hit, then fades out.
  if (hud.flashEl) {
    hud.flashEl.style.opacity = String(Math.max(0, game.hudFlash ?? 0));
    game.hudFlash = Math.max(0, (game.hudFlash ?? 0) - dt * 1.4);
  }
  const m = game.mission;
  const dist = m.target ? Math.hypot(p.pos.x - m.target.x, p.pos.z - m.target.z) : null;
  hud.setObjective(m.objective, dist);
  hud.setPrompt(currentPrompt(game));
  hud.tickToasts(dt);
  // Crosshair shows only on foot with the pistol out.
  grab('crosshair').style.display =
    game.state === 'playing' && !p.inCar && p.hasPistol && p.weapon === 'pistol' ? 'block' : 'none';
}
