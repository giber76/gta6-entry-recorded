// hud.js — the on-screen HUD for Solara Bay.
// Cash, wanted stars, health bar, car health bar while driving, radio
// station label, mission objective, and the red damage flash overlay.

import { STATIONS } from './audio.js';

export function createHud(world) {
  const hud = {
    el: {},
    flashUntil: 0,
  };

  const ids = ['cash', 'wanted', 'health-fill', 'health-wrap', 'carhealth-fill', 'carhealth-wrap', 'radio', 'objective', 'damage-flash', 'menu', 'win', 'busted', 'win-cash', 'pause'];
  for (const id of ids) {
    hud.el[id] = document.getElementById(id);
  }

  hud.flashDamage = function () {
    hud.flashUntil = performance.now() + 220;
    const f = hud.el['damage-flash'];
    if (f) {
      f.style.opacity = '0.45';
      setTimeout(() => {
        f.style.opacity = '0';
      }, 220);
    }
  };

  function stars(n) {
    let s = '';
    for (let i = 0; i < 3; i++) s += i < n ? '★' : '☆';
    return s;
  }

  hud.update = function () {
    const p = world.player;
    if (hud.el.cash) hud.el.cash.textContent = '$' + world.cash.toLocaleString('en-US');
    if (hud.el.wanted) {
      hud.el.wanted.textContent = stars(world.wanted);
      hud.el.wanted.style.color = world.wanted > 0 ? '#ff5040' : '#888';
    }
    if (hud.el['health-fill']) {
      hud.el['health-fill'].style.width = Math.max(0, p.health) + '%';
      hud.el['health-fill'].style.background = p.health > 50 ? '#37c24a' : p.health > 25 ? '#e8a13a' : '#e83a3a';
    }
    const inCar = p.inCar && p.car;
    if (hud.el['carhealth-wrap']) {
      hud.el['carhealth-wrap'].style.display = inCar ? 'block' : 'none';
    }
    if (inCar && hud.el['carhealth-fill']) {
      hud.el['carhealth-fill'].style.width = Math.max(0, p.car.health) + '%';
      hud.el['carhealth-fill'].style.background =
        p.car.health > 50 ? '#37c24a' : p.car.health > 25 ? '#e8a13a' : '#e83a3a';
    }
    if (hud.el.radio) {
      const name = world.radio.station < 0 ? 'RADIO OFF' : STATIONS[world.radio.station];
      hud.el.radio.textContent = '♪ ' + name;
    }
    if (hud.el.objective) {
      hud.el.objective.textContent = world.missions.objectiveText();
    }
    // Overlays follow the game state.
    if (hud.el.menu) hud.el.menu.style.display = world.state === 'menu' ? 'flex' : 'none';
    if (hud.el.win) hud.el.win.style.display = world.state === 'won' ? 'flex' : 'none';
    if (hud.el.busted) hud.el.busted.style.display = world.state === 'busted' ? 'flex' : 'none';
    if (hud.el.pause) hud.el.pause.style.display = world.state === 'paused' ? 'flex' : 'none';
    if (hud.el['win-cash']) hud.el['win-cash'].textContent = '$' + world.cash.toLocaleString('en-US');
  };

  world.hud = hud;
  return hud;
}
