// hud.js — the Solara Bay HUD: health, cash, wanted stars, objective, prompts,
// dialogue, toasts, speed and the menu / pause / busted / win screens.

import { nearestParkedCar } from './vehicles.js';

export function createHud(G) {
  const $ = (id) => document.getElementById(id);
  const hud = {
    healthFill: $('health-fill'),
    healthText: $('health-text'),
    cashText: $('cash-text'),
    starsEl: $('stars'),
    objectiveText: $('objective-text'),
    objectiveDist: $('objective-dist'),
    promptEl: $('prompt'),
    dialogueEl: $('dialogue'),
    dialogueText: $('dialogue-text'),
    toastEl: $('toasts'),
    speedEl: $('speed'),
    weaponEl: $('weapon'),
    missionEl: $('mission-name'),
    screens: {
      start: $('screen-start'),
      pause: $('screen-pause'),
      busted: $('screen-busted'),
      win: $('screen-win'),
    },
    startTitle: $('start-title'),
    winCash: $('win-cash'),
    bustedCash: $('busted-cash'),
    toasts: [],
  };

  hud.setHealth = function setHealth(h) {
    hud.healthFill.style.width = `${Math.max(0, Math.min(100, h))}%`;
    hud.healthFill.style.background = h > 50 ? '#37c978' : h > 25 ? '#f0a13a' : '#e33d3d';
    hud.healthText.textContent = `${Math.ceil(h)}`;
  };

  hud.setCash = function setCash(c) {
    hud.cashText.textContent = `$${c.toLocaleString('en-US')}`;
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
    if (text) {
      hud.dialogueText.textContent = text;
      hud.dialogueEl.style.display = 'block';
    } else {
      hud.dialogueEl.style.display = 'none';
    }
  };

  hud.setSpeed = function setSpeed(kmh) {
    hud.speedEl.textContent = kmh > 1 ? `${Math.round(kmh)} km/h` : '';
  };

  hud.setWeapon = function setWeapon(w) {
    hud.weaponEl.textContent = w === 'pistol' ? 'PISTOL [Q]' : 'FISTS [Q]';
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
      if (t.t > 4) {
        t.el.style.opacity = '0';
      }
      if (t.t > 4.6 && t.el.parentNode) {
        t.el.parentNode.removeChild(t.el);
      }
    }
    hud.toasts = hud.toasts.filter((t) => t.t <= 4.6);
  };

  hud.showScreen = function showScreen(name) {
    for (const key of Object.keys(hud.screens)) {
      hud.screens[key].style.display = key === name ? 'flex' : 'none';
    }
    const inGame = name === null;
    document.getElementById('hud').style.display = inGame ? 'block' : 'none';
  };

  G.hud = hud;
  return hud;
}

// Per-frame HUD refresh: health, cash, objective distance, speed, prompts.
export function updateHud(G, dt) {
  const hud = G.hud;
  const p = G.player;
  hud.setHealth(p.health);
  hud.setCash(p.cash);
  hud.setStars(G.wanted);
  hud.setWeapon(p.hasPistol ? p.weapon : 'fists');
  const speedKmh = p.inCar && p.car ? Math.abs(p.car.speed) * 3.6 : p.speed * 3.6;
  hud.setSpeed(speedKmh);
  const m = G.mission;
  let dist = null;
  if (m.target) dist = Math.hypot(p.pos.x - m.target.x, p.pos.z - m.target.z);
  hud.setObjective(m.objective, dist);

  // Contextual prompt: what E does right now.
  let prompt = '';
  if (G.state === 'playing' && p.health > 0) {
    if (p.inCar) {
      prompt = '[E] Get out    [SPACE] Handbrake';
    } else {
      const near = nearestParkedCar(G);
      if (near) prompt = '[E] Steal car';
      else if (m.index === 4 && m.stage === 0 && m.target && Math.hypot(p.pos.x - m.target.x, p.pos.z - m.target.z) < 6) {
        prompt = 'Hold [E] to grab the cash';
      }
    }
    if (p.hasPistol) prompt += '    [Q] Switch weapon    [Click] Shoot';
    else if (!p.inCar) prompt += '    [Q] Fists    [Click] Punch';
  }
  hud.setPrompt(prompt);
  hud.tickToasts(dt);
  // Crosshair shows only on foot with the pistol out.
  document.getElementById('crosshair').style.display =
    G.state === 'playing' && !p.inCar && p.hasPistol && p.weapon === 'pistol' ? 'block' : 'none';
}
