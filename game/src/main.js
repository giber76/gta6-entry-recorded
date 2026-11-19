// main.js — Solara Bay: the game loop, the state machine and the wiring
// between every module. States: menu → playing ⇄ paused, busted
// (respawn), won (free roam). Per-frame updaters run in a fixed order:
// player, car, traffic, pedestrians, police, enemies, missions, effects,
// camera, HUD.

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
const MISSION_NAMES = MISSIONS.map((job) => job.name);
const ZOOM_LEVELS = [1, 2, 4];

// The shared game object every module reads and writes.
const game = {
  state: 'menu',
  elapsed: 0,
  camYaw: Math.PI,
  camPitch: 0.32,
  saveTimer: 0,
  minimapZoom: 1,
};

// --- renderer / scene -------------------------------------------------------
function makeRenderer() {
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

// --- world setup ------------------------------------------------------------
function wireWorld() {
  const { renderer, scene, camera } = makeRenderer();
  game.renderer = renderer;
  game.scene = scene;
  game.camera = camera;
  game.audio = createAudio();
  initInput(game);
  initCity(game);
  initEffects(game);
  createPlayer(game);
  spawnParkedCars(game);
  spawnTraffic(game);
  spawnPedestrians(game);
  initPolice(game);
  initCombat(game);
  createHud(game);
  game.minimap = createMinimap(game);
  initMissions(game);
  initDebug(game);
  game.saveGame = () => saveGame(game);
}

wireWorld();

// --- game events ------------------------------------------------------------
// ENTER advances dialogue; P/ESC pauses; M shows the mission; Q swaps weapon.
// R cycles the radio station; Z/X zoom the minimap in and out.
game.onEnter = () => {
  if (game.state === 'playing') advanceDialogue(game);
};

game.onPauseKey = () => {
  const playing = game.state === 'playing';
  const paused = game.state === 'paused';
  if (!playing && !paused) return;
  game.state = playing ? 'paused' : 'playing';
  game.hud.showScreen(playing ? 'pause' : null);
  if (playing) saveGame(game);
};

game.onMissionKey = () => {
  if (game.state !== 'playing') return;
  const m = game.mission;
  game.hud.toast(`Mission ${m.index + 1}/${MISSIONS.length}: ${MISSION_NAMES[m.index]} — ${m.objective}`);
};

game.onWeaponKey = () => {
  const p = game.player;
  if (game.state !== 'playing' || p.inCar || !p.hasPistol) {
    if (game.state === 'playing' && !p.inCar) p.weapon = 'fists';
    return;
  }
  p.weapon = p.weapon === 'fists' ? 'pistol' : 'fists';
  game.hud.toast(p.weapon === 'pistol' ? 'Pistol out' : 'Fists out');
};

game.onRadioKey = () => {
  if (game.state !== 'playing' || !game.audio) return;
  const name = game.audio.nextStation();
  game.hud.toast(`Radio — ${name}`);
};

function cycleZoom(dir) {
  if (game.state !== 'playing') return;
  const i = ZOOM_LEVELS.indexOf(game.minimapZoom ?? 1);
  const n = ZOOM_LEVELS.length;
  game.minimapZoom = ZOOM_LEVELS[((i + dir) % n + n) % n];
  game.hud.toast(`Minimap ${game.minimapZoom}x`);
}

game.onZoomIn = () => cycleZoom(1);
game.onZoomOut = () => cycleZoom(-1);

game.onClick = () => {
  if (game.state === 'playing') playerAttack(game);
};

game.onCarStolen = (car) => {
  if (theftWitnessed(game)) {
    raiseWanted(game, 1, 'car theft witnessed');
  } else {
    game.hud.toast('Car stolen — nobody saw');
  }
};

game.onPedHit = () => {
  raiseWanted(game, 1, 'pedestrian hit');
};

game.onPlayerHitByTraffic = () => {
  damagePlayer(game, 12, 'hit by traffic');
  const p = game.player;
  p.pos.x += (Math.random() - 0.5) * 4;
  p.pos.z += (Math.random() - 0.5) * 4;
};

game.onEnemyKilled = (enemy) => {
  // Count the kill and say so: a running tally of Vipers taken down,
  // shown in the debug snapshot for play-tests.
  game.kills = (game.kills || 0) + 1;
  game.hud.toast(`Viper down — ${game.kills} taken out`);
  if (game.audio) game.audio.pickup();
};

game.onBusted = () => {
  game.hud.bustedCash.textContent = `$${game.player.cash.toLocaleString('en-US')}`;
  game.hud.showScreen('busted');
};

game.onWin = () => {
  game.hud.winCash.textContent = `$${game.player.cash.toLocaleString('en-US')}`;
  game.hud.showScreen('win');
};

// --- start / continue / respawn --------------------------------------------
// Shared reset used by new game, continue and respawn: put Marlo back on
// his feet at the plaza steps with a clean slate.
function resetMarlo(game, cash, health) {
  const p = game.player;
  p.cash = cash;
  p.health = health;
  p.hasPistol = false;
  p.weapon = 'fists';
  p.inCar = false;
  p.car = null;
  p.group.visible = true;
  p.pos.x = game.city.locations.start.x;
  p.pos.z = game.city.locations.start.z;
  p.group.position.set(p.pos.x, 0, p.pos.z);
  game.wanted = 0;
  for (const e of game.enemies) game.scene.remove(e.group);
  game.enemies = [];
}

// Enter play from a menu button: reset, show the game, toast a greeting.
function enterPlay(toast) {
  game.state = 'playing';
  game.hud.showScreen(null);
  if (toast) game.hud.toast(toast);
}

game.startNewGame = () => {
  clearSave();
  resetMarlo(game, 0, 100);
  initMissions(game);
  enterPlay('Welcome to Solara Bay — steal the orange coupe');
};

game.continueGame = () => {
  const data = loadSave();
  if (!data) return;
  const p = game.player;
  resetMarlo(game, data.cash, data.health);
  p.hasPistol = !!data.hasPistol;
  p.weapon = p.hasPistol ? 'pistol' : 'fists';
  p.pos.x = data.x;
  p.pos.z = data.z;
  p.group.position.set(p.pos.x, 0, p.pos.z);
  if (game.audio) game.audio.setStation(data.station ?? 0);
  // Restore the saved minimap zoom as well.
  if (data.minimapZoom) game.minimapZoom = data.minimapZoom;
  initMissions(game);
  // Restore the saved mission directly (earlier jobs are already paid).
  if (data.mission > 0) startMission(game, data.mission);
  enterPlay('Save loaded — welcome back to Solara Bay');
};

game.respawnAfterBusted = () => {
  const p = game.player;
  const cash = Math.max(0, p.cash - 100);
  if (p.inCar && p.car) {
    p.car.isPlayer = false;
  }
  resetMarlo(game, cash, 100);
  enterPlay('You were busted — $100 fine, back on the plaza');
};

game.continueFreeRoam = () => {
  enterPlay('Free roam — Solara Bay is yours');
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
    ['btn-new', () => { if (game.audio) game.audio.unlock(); game.startNewGame(); }],
    ['btn-continue', () => { if (game.audio) game.audio.unlock(); game.continueGame(); }],
    ['btn-resume', () => { game.state = 'playing'; game.hud.showScreen(null); }],
    ['btn-quit', () => { saveGame(game); game.state = 'menu'; game.hud.showScreen('start'); refreshStartScreen(); }],
    ['btn-respawn', () => game.respawnAfterBusted()],
    ['btn-freeroam', () => game.continueFreeRoam()],
    ['btn-playagain', () => game.startNewGame()],
  ];
  for (const [id, handler] of buttons) {
    document.getElementById(id).addEventListener('click', handler);
  }
}

wireButtons();

// E is handled on keydown for a snappy feel (enter/exit car, vault hold uses keys set).
window.addEventListener('keydown', (ev) => {
  if (ev.code === 'KeyE' && !ev.repeat && game.state === 'playing') tryEnterExitCar(game);
});

refreshStartScreen();
game.hud.showScreen('start');

// --- main loop --------------------------------------------------------------
const clock = new THREE.Clock();

function tickMenu(dt) {
  // Slow orbit around the plaza while the menu is up.
  const t = game.elapsed * 0.08;
  game.camera.position.set(20 + Math.cos(t) * 42, 26, 20 + Math.sin(t) * 42);
  game.camera.lookAt(20, 2, 20);
  updateTraffic(game, dt);
  updatePedestrians(game, dt);
}

// The per-frame updaters, in order. updatePlayerCar only runs while driving.
const PLAY_UPDATERS = [
  updatePlayer,
  (game, dt) => { if (game.player.inCar) updatePlayerCar(game, dt); },
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
  for (const step of PLAY_UPDATERS) step(game, dt);
  game.minimap.draw(game);
  if (game.audio) game.audio.tick(dt, game.wanted);
  // Autosave every 20 s.
  game.saveTimer += dt;
  if (game.saveTimer > 20) {
    game.saveTimer = 0;
    saveGame(game);
  }
}

function tickIdle(dt) {
  // World idles behind the end screens.
  updateTraffic(game, dt);
  updatePedestrians(game, dt);
  updateEffects(game, dt);
  updateCamera(game, dt);
}

// One tick per state; paused renders the frozen frame and runs nothing.
const STATE_TICKS = {
  menu: tickMenu,
  playing: tickPlaying,
  busted: tickIdle,
  won: tickIdle,
};

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.1);
  game.elapsed += dt;

  const tick = STATE_TICKS[game.state];
  if (tick) tick(dt);

  game.renderer.render(game.scene, game.camera);
}
animate();
