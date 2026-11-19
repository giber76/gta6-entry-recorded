// main.js — Solara Bay: game loop, state machine and wiring.
// States: menu → playing ⇄ paused, busted (respawn), won (free roam).

import { initCity } from './city.js';
import { createPlayer, updatePlayer, updateCamera, damagePlayer } from './player.js';
import { spawnParkedCars, updatePlayerCar, tryEnterExitCar } from './vehicles.js';
import { spawnTraffic, updateTraffic } from './traffic.js';
import { spawnPedestrians, updatePedestrians } from './pedestrians.js';
import { initPolice, updatePolice, raiseWanted, theftWitnessed } from './police.js';
import { initCombat, updateEnemies, playerAttack } from './combat.js';
import { MISSIONS, initMissions, updateMissions, advanceDialogue, startMission } from './missions.js';
import { createHud, updateHud } from './hud.js';
import { createMinimap } from './minimap.js';
import { createAudio } from './audio.js';
import { initInput } from './input.js';
import { initEffects, updateEffects } from './effects.js';
import { saveGame, loadSave, hasSave, clearSave } from './save.js';
import { initDebug } from './debug.js';

const THREE = window.THREE;
const MISSION_NAMES = ['Wheels for Rico', 'Lose the Heat', 'The Package', 'Viper Nest', 'The Big Score', 'The Last Job'];
const ZOOM_LEVELS = [1, 2, 4];

const G = {
  state: 'menu',
  elapsed: 0,
  camYaw: Math.PI,
  camPitch: 0.32,
  saveTimer: 0,
  minimapZoom: 1,
};

// --- renderer / scene -------------------------------------------------------
function buildRenderer() {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.getElementById('game-container').appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
  camera.position.set(0, 30, 60);
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
  return { renderer, scene, camera };
}

const { renderer, scene, camera } = buildRenderer();
G.renderer = renderer;
G.scene = scene;
G.camera = camera;

// --- modules ----------------------------------------------------------------
G.audio = createAudio();
initInput(G);
initCity(G);
initEffects(G);
createPlayer(G);
spawnParkedCars(G);
spawnTraffic(G);
spawnPedestrians(G);
initPolice(G);
initCombat(G);
createHud(G);
G.minimap = createMinimap(G);
initMissions(G);
initDebug(G);

G.saveGame = () => saveGame(G);

// --- game events ------------------------------------------------------------
// ENTER advances dialogue; P/ESC pauses; M shows the mission; Q swaps weapon.
// R cycles the radio station; Z/X zoom the minimap in and out.
G.onEnter = () => {
  if (G.state === 'playing') advanceDialogue(G);
};

G.onPauseKey = () => {
  const playing = G.state === 'playing';
  const paused = G.state === 'paused';
  if (!playing && !paused) return;
  G.state = playing ? 'paused' : 'playing';
  G.hud.showScreen(playing ? 'pause' : null);
  if (playing) saveGame(G);
};

G.onMissionKey = () => {
  if (G.state !== 'playing') return;
  const m = G.mission;
  G.hud.toast(`Mission ${m.index + 1}/${MISSIONS.length}: ${MISSION_NAMES[m.index]} — ${m.objective}`);
};

G.onWeaponKey = () => {
  const p = G.player;
  if (G.state !== 'playing' || p.inCar || !p.hasPistol) {
    if (G.state === 'playing' && !p.inCar) p.weapon = 'fists';
    return;
  }
  p.weapon = p.weapon === 'fists' ? 'pistol' : 'fists';
  G.hud.toast(p.weapon === 'pistol' ? 'Pistol out' : 'Fists out');
};

G.onRadioKey = () => {
  if (G.state !== 'playing' || !G.audio) return;
  const name = G.audio.nextStation();
  G.hud.toast(`Radio — ${name}`);
};

G.onZoomIn = () => {
  if (G.state !== 'playing') return;
  const i = ZOOM_LEVELS.indexOf(G.minimapZoom ?? 1);
  G.minimapZoom = ZOOM_LEVELS[(i + 1) % ZOOM_LEVELS.length];
  G.hud.toast(`Minimap ${G.minimapZoom}x`);
};

G.onZoomOut = () => {
  if (G.state !== 'playing') return;
  const i = ZOOM_LEVELS.indexOf(G.minimapZoom ?? 1);
  G.minimapZoom = ZOOM_LEVELS[(i + ZOOM_LEVELS.length - 1) % ZOOM_LEVELS.length];
  G.hud.toast(`Minimap ${G.minimapZoom}x`);
};

G.onClick = () => {
  if (G.state === 'playing') playerAttack(G);
};

G.onCarStolen = (car) => {
  if (theftWitnessed(G)) {
    raiseWanted(G, 1, 'car theft witnessed');
  } else {
    G.hud.toast('Car stolen — nobody saw');
  }
};

G.onPedHit = () => {
  raiseWanted(G, 1, 'pedestrian hit');
};

G.onPlayerHitByTraffic = () => {
  damagePlayer(G, 12, 'hit by traffic');
  const p = G.player;
  p.pos.x += (Math.random() - 0.5) * 4;
  p.pos.z += (Math.random() - 0.5) * 4;
};

G.onEnemyKilled = (enemy) => {
  G.hud.toast('Viper down');
  if (G.audio) G.audio.pickup();
};

G.onBusted = () => {
  G.hud.bustedCash.textContent = `$${G.player.cash.toLocaleString('en-US')}`;
  G.hud.showScreen('busted');
};

G.onWin = () => {
  G.hud.winCash.textContent = `$${G.player.cash.toLocaleString('en-US')}`;
  G.hud.showScreen('win');
};

// --- start / continue / respawn --------------------------------------------
// Shared reset used by new game, continue and respawn: put Marlo back on
// his feet at the plaza steps with a clean slate.
function freshMarlo(G, cash, health) {
  const p = G.player;
  p.cash = cash;
  p.health = health;
  p.hasPistol = false;
  p.weapon = 'fists';
  p.inCar = false;
  p.car = null;
  p.group.visible = true;
  p.pos.x = G.city.locations.start.x;
  p.pos.z = G.city.locations.start.z;
  p.group.position.set(p.pos.x, 0, p.pos.z);
  G.wanted = 0;
  for (const e of G.enemies) G.scene.remove(e.group);
  G.enemies = [];
}

// Enter play from a menu button: reset, show the game, toast a greeting.
function beginPlay(toast) {
  G.state = 'playing';
  G.hud.showScreen(null);
  if (toast) G.hud.toast(toast);
}

G.startNewGame = () => {
  clearSave();
  freshMarlo(G, 0, 100);
  initMissions(G);
  beginPlay('Welcome to Solara Bay — steal the orange coupe');
};

G.continueGame = () => {
  const data = loadSave();
  if (!data) return;
  const p = G.player;
  freshMarlo(G, data.cash, data.health);
  p.hasPistol = !!data.hasPistol;
  p.weapon = p.hasPistol ? 'pistol' : 'fists';
  p.pos.x = data.x;
  p.pos.z = data.z;
  p.group.position.set(p.pos.x, 0, p.pos.z);
  if (G.audio) G.audio.setStation(data.station ?? 0);
  initMissions(G);
  // Restore the saved mission directly (earlier jobs are already paid).
  if (data.mission > 0) startMission(G, data.mission);
  beginPlay('Save loaded — welcome back to Solara Bay');
};

G.respawnAfterBusted = () => {
  const p = G.player;
  const cash = Math.max(0, p.cash - 100);
  if (p.inCar && p.car) {
    p.car.isPlayer = false;
  }
  freshMarlo(G, cash, 100);
  beginPlay('You were busted — $100 fine, back on the plaza');
};

G.continueFreeRoam = () => {
  beginPlay('Free roam — Solara Bay is yours');
};

function refreshStartScreen() {
  const btn = document.getElementById('btn-continue');
  btn.style.display = hasSave() ? 'block' : 'none';
  const save = loadSave();
  document.getElementById('start-sub').textContent = save
    ? `Continue — $${save.cash.toLocaleString('en-US')}, mission ${save.mission + 1}/${MISSIONS.length}`
    : 'Six jobs. One city. No rules but Rico\u2019s.';
}

// --- menu buttons -----------------------------------------------------------
function wireButtons() {
  const buttons = [
    ['btn-new', () => { if (G.audio) G.audio.unlock(); G.startNewGame(); }],
    ['btn-continue', () => { if (G.audio) G.audio.unlock(); G.continueGame(); }],
    ['btn-resume', () => { G.state = 'playing'; G.hud.showScreen(null); }],
    ['btn-quit', () => { saveGame(G); G.state = 'menu'; G.hud.showScreen('start'); refreshStartScreen(); }],
    ['btn-respawn', () => G.respawnAfterBusted()],
    ['btn-freeroam', () => G.continueFreeRoam()],
    ['btn-playagain', () => G.startNewGame()],
  ];
  for (const [id, handler] of buttons) {
    document.getElementById(id).addEventListener('click', handler);
  }
}

wireButtons();

// E is handled on keydown for a snappy feel (enter/exit car, vault hold uses keys set).
window.addEventListener('keydown', (ev) => {
  if (ev.code === 'KeyE' && !ev.repeat && G.state === 'playing') tryEnterExitCar(G);
});

refreshStartScreen();
G.hud.showScreen('start');

// --- main loop --------------------------------------------------------------
const clock = new THREE.Clock();

function tickMenu(dt) {
  // Slow orbit around the plaza while the menu is up.
  const t = G.elapsed * 0.08;
  camera.position.set(20 + Math.cos(t) * 42, 26, 20 + Math.sin(t) * 42);
  camera.lookAt(20, 2, 20);
  updateTraffic(G, dt);
  updatePedestrians(G, dt);
}

// The per-frame updaters, in order. updatePlayerCar only runs while driving.
const PLAY_UPDATERS = [
  updatePlayer,
  (G, dt) => { if (G.player.inCar) updatePlayerCar(G, dt); },
  updateTraffic,
  updatePedestrians,
  updatePolice,
  updateEnemies,
  updateMissions,
  updateEffects,
  updateCamera,
  updateHud,
];

function tickPlaying(dt) {
  for (const step of PLAY_UPDATERS) step(G, dt);
  G.minimap.draw(G);
  if (G.audio) G.audio.tick(dt, G.wanted);
  // Autosave every 20 s.
  G.saveTimer += dt;
  if (G.saveTimer > 20) {
    G.saveTimer = 0;
    saveGame(G);
  }
}

function tickIdle(dt) {
  // World idles behind the end screens.
  updateTraffic(G, dt);
  updatePedestrians(G, dt);
  updateEffects(G, dt);
  updateCamera(G, dt);
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.1);
  G.elapsed += dt;

  if (G.state === 'menu') tickMenu(dt);
  else if (G.state === 'playing') tickPlaying(dt);
  else if (G.state === 'busted' || G.state === 'won') tickIdle(dt);
  // Paused: render the frozen frame, run nothing.

  renderer.render(scene, camera);
}
animate();
