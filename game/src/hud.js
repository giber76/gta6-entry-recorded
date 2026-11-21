// hud.js — the HUD: cash, wanted stars, health, radio, mission, speed,
// car health, crosshair, toasts, and the menu / win / busted overlays.
import { missionText } from './missions.js';

export function initHud(G) {
  G.hud = {
    cash: document.getElementById('hud-cash'),
    wanted: document.getElementById('hud-wanted'),
    healthFill: document.getElementById('hud-health-fill'),
    radio: document.getElementById('hud-radio'),
    missionTitle: document.getElementById('hud-mission-title'),
    missionText: document.getElementById('hud-mission-text'),
    carBox: document.getElementById('hud-car'),
    speed: document.getElementById('hud-speed'),
    carHealthFill: document.getElementById('hud-carhealth-fill'),
    crosshair: document.getElementById('crosshair'),
    toast: document.getElementById('hud-toast'),
    menu: document.getElementById('menu'),
    win: document.getElementById('win'),
    busted: document.getElementById('busted'),
  };
  const btnNew = document.getElementById('btn-new');
  if (btnNew) btnNew.addEventListener('click', () => G.startNewGame());
  const btnFree = document.getElementById('btn-freeroam');
  if (btnFree) btnFree.addEventListener('click', () => G.enterFreeRoam());
  const btnRetry = document.getElementById('btn-retry');
  if (btnRetry) btnRetry.addEventListener('click', () => G.startNewGame());
}

export function updateHud(G) {
  const h = G.hud;
  if (!h) return;
  const p = G.player;
  h.cash.textContent = '$' + G.cash.toLocaleString();
  h.wanted.textContent = '★'.repeat(G.wanted) + '☆'.repeat(Math.max(0, 3 - G.wanted));
  h.wanted.style.visibility = G.wanted > 0 ? 'visible' : 'hidden';
  h.healthFill.style.width = Math.max(0, p.health) + '%';
  h.radio.textContent = G.radio === 'OFF' ? 'RADIO OFF' : '♪ ' + G.radio;
  const [title, text] = missionText(G);
  h.missionTitle.textContent = title;
  h.missionText.textContent = text;
  if (p.inCar && p.car) {
    h.carBox.classList.remove('hidden');
    h.speed.innerHTML = Math.round(Math.abs(p.car.speed) * 3.6) + ' <small>km/h</small>';
    h.carHealthFill.style.width = Math.max(0, p.car.health) + '%';
  } else {
    h.carBox.classList.add('hidden');
  }
  h.crosshair.classList.toggle('hidden', !p.hasPistol || G.state !== 'playing');
  if (G.toastTimer > 0 && G.toast) {
    h.toast.textContent = G.toast;
    h.toast.style.opacity = '1';
  } else {
    h.toast.style.opacity = '0';
  }
  // Overlays follow the state.
  h.menu.classList.toggle('hidden', G.state !== 'menu');
  h.win.classList.toggle('hidden', G.state !== 'won');
  h.busted.classList.toggle('hidden', G.state !== 'busted');
  // Damage flash: a red vignette via the toast element's parent is too
  // fiddly; use the health bar's glow instead.
  h.healthFill.style.boxShadow = G.damageFlash > 0.25 ? '0 0 12px #ff2a4d' : 'none';
}
