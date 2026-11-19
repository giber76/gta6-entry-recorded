// hud.js — the Solara Bay HUD: health, cash, wanted stars, objective,
// prompts, dialogue, toasts, speed, car health and the radio, plus the
// menu / pause / busted / win screens. The damage flash that vignettes
// the screen when Marlo is hurt is driven here, off G.hudFlash.

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

export function createHud(G) {
  const hud = {
    healthFill: grab('health-fill'),
    healthText: grab('health-text'),
    cashText: grab('cash-text'),
    starsEl: grab('stars'),
    objectiveText: grab('objective-text'),
    objectiveDist: grab('objective-dist'),
    promptEl: grab('prompt'),
    dialogueEl: grab('dialogue'),
    dialogueText: grab('dialogue-text'),
    toastEl: grab('toasts'),
    speedEl: grab('speed'),
    weaponEl: grab('weapon'),
    missionEl: grab('mission-name'),
    carHealthEl: grab('car-health'),
    carHealthFill: grab('car-health-fill'),
    carHealthText: grab('car-health-text'),
    radioEl: grab('radio'),
    flashEl: grab('damage-flash'),
    crosshairEl: grab('crosshair'),
    screens: {
      start: grab('screen-start'),
      pause: grab('screen-pause'),
      busted: grab('screen-busted'),
      win: grab('screen-win'),
    },
    startTitle: grab('start-title'),
    winCash: grab('win-cash'),
    bustedCash: grab('busted-cash'),
    toasts: [],
  };

  hud.setHealth = function setHealth(h) {
    const pct = Math.max(0, Math.min(100, h));
    hud.healthFill.style.width = `${pct}%`;
    hud.healthFill.style.background = healthColor(h);
    hud.healthText.textContent = `${Math.ceil(h)}`;
  };

  hud.setCash = function setCash(c) {
    hud.cashText.textContent = money(c);
  };

  hud.setStars = function setStars(n) {
    const s = Array.from({ length: 5 }, (_, i) => (i < n ? '★' : '☆')).join('');
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

  // Car health bar, shown only while driving.
  hud.setCarHealth = function setCarHealth(h) {
    if (h == null) {
      hud.carHealthEl.style.display = 'none';
      return;
    }
    hud.carHealthEl.style.display = 'block';
    const pct = Math.max(0, Math.min(100, h));
    hud.carHealthFill.style.width = `${pct}%`;
    hud.carHealthFill.style.background = healthColor(h);
    hud.carHealthText.textContent = `${Math.ceil(h)}`;
  };

  hud.setRadio = function setRadio(text) {
    hud.radioEl.textContent = text;
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

  G.hud = hud;
  return hud;
}

// What E does right now, as a prompt line.
function currentPrompt(G) {
  const p = G.player;
  const m = G.mission;
  if (G.state !== 'playing' || p.health <= 0) return '';
  let prompt = '';
  if (p.inCar) {
    prompt = '[E] Get out    [SPACE] Handbrake';
    if (p.hasPistol && p.weapon === 'pistol') prompt += '    [Click] Drive-by shoot';
    prompt += '    [R] Radio    [Z/X] Map zoom';
  } else {
    const near = nearestParkedCar(G);
    if (near) {
      prompt = '[E] Steal car';
    } else if (
      m.index === 4 &&
      m.stage === 0 &&
      m.target &&
      Math.hypot(p.pos.x - m.target.x, p.pos.z - m.target.z) < 6
    ) {
      prompt = 'Hold [E] to grab the cash';
    }
  }
  if (p.hasPistol) prompt += '    [Q] Switch weapon    [Click] Shoot';
  else if (!p.inCar) prompt += '    [Q] Fists    [Click] Punch';
  if (!p.inCar) prompt += '    [R] Radio    [Z/X] Map zoom';
  return prompt;
}

// Per-frame HUD refresh: health, cash, objective distance, speed, car
// health, radio, prompts, and the damage flash fading out.
export function updateHud(G, dt) {
  const hud = G.hud;
  const p = G.player;
  hud.setHealth(p.health);
  hud.setCash(p.cash);
  hud.setStars(G.wanted);
  hud.setWeapon(p.hasPistol ? p.weapon : 'fists');
  const speedKmh = p.inCar && p.car ? Math.abs(p.car.speed) * 3.6 : p.speed * 3.6;
  hud.setSpeed(speedKmh);
  hud.setCarHealth(p.inCar && p.car ? p.car.health : null);
  hud.setRadio(G.audio ? G.audio.radioLabel() : 'RADIO OFF');
  const m = G.mission;
  const dist = m.target ? Math.hypot(p.pos.x - m.target.x, p.pos.z - m.target.z) : null;
  hud.setObjective(m.objective, dist);
  hud.setPrompt(currentPrompt(G));
  hud.tickToasts(dt);
  // Damage flash: G.hudFlash is set to 1 when Marlo is hurt and fades here.
  if (G.hudFlash > 0) {
    hud.flashEl.style.opacity = String(G.hudFlash * 0.9);
    G.hudFlash = Math.max(0, G.hudFlash - dt * 2);
  } else {
    hud.flashEl.style.opacity = '0';
  }
  // Crosshair shows with the pistol out, on foot or driving (drive-by).
  hud.crosshairEl.style.display =
    G.state === 'playing' && p.hasPistol && p.weapon === 'pistol' ? 'block' : 'none';
}
