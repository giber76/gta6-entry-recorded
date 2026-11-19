// main.js — Solara Bay: game loop, state machine and wiring.
// States: menu → playing ⇄ paused, busted (respawn), won (free roam).

import { initCity } from './city.js';
import { createPlayer, updatePlayer, updateCamera, damagePlayer } from './player.js';
import { spawnParkedCars, updatePlayerCar, tryEnterExitCar } from './vehicles.js';
import { spawnTraffic, updateTraffic } from './traffic.js';
import { spawnPedestrians, updatePedestrians } from './pedestrians.js';
import { initPolice, updatePolice, raiseWanted, theftWitnessed } from './police.js';
import { initCombat, updateEnemies, playerAttack } from './combat.js';
import { initMissions, updateMissions, advanceDialogue, startMission } from './missions.js';
import { createHud, updateHud } from './hud.js';
import { createMinimap } from './minimap.js';
import { createAudio } from './audio.js';
import { initInput } from './input.js';
import { saveGame, loadSave, hasSave, clearSave } from './save.js';
import { initDebug } from './debug.js';

const THREE = window.THREE;

const G = {
  state: 'menu',
  elapsed: 0,
  camYaw: Math.PI,
  camPitch: 0.32,
  saveTimer: 0,
};

// --- renderer / scene -------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('game-container').appendChild(renderer.domElement);
G.renderer = renderer;

const scene = new THREE.Scene();
G.scene = scene;
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
camera.position.set(0, 30, 60);
G.camera = camera;

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- modules ----------------------------------------------------------------
G.audio = createAudio();
initInput(G);
initCity(G);
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
G.onEnter = () => {
  if (G.state === 'playing') advanceDialogue(G);
};

G.onPauseKey = () => {
  if (G.state === 'playing') {
    G.state = 'paused';
    G.hud.showScreen('pause');
    saveGame(G);
  } else if (G.state === 'paused') {
    G.state = 'playing';
    G.hud.showScreen(null);
  }
};

G.onMissionKey = () => {
  if (G.state !== 'playing') return;
  const names = ['Wheels for Rico', 'Lose the Heat', 'The Package', 'Viper Nest', 'The Big Score'];
  const m = G.mission;
  G.hud.toast(`Mission ${m.index + 1}/5: ${names[m.index]} — ${m.objective}`);
};

G.onWeaponKey = () => {
  const p = G.player;
  if (G.state !== 'playing' || p.inCar) return;
  if (!p.hasPistol) {
    p.weapon = 'fists';
    return;
  }
  p.weapon = p.weapon === 'fists' ? 'pistol' : 'fists';
  G.hud.toast(p.weapon === 'pistol' ? 'Pistol out' : 'Fists out');
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
G.startNewGame = () => {
  const p = G.player;
  clearSave();
  p.cash = 0;
  p.health = 100;
  p.hasPistol = false;
  p.weapon = 'fists';
  p.inCar = false;
  p.car = null;
  p.group.visible = true;
  p.pos.x = G.city.locations.start.x;
  p.pos.z = G.city.locations.start.z;
  p.group.position.set(p.pos.x, 0, p.pos.z);
  G.wanted = 0;
  // Clear any leftover enemies from a previous run.
  for (const e of G.enemies) G.scene.remove(e.group);
  G.enemies = [];
  initMissions(G);
  G.state = 'playing';
  G.hud.showScreen(null);
  G.hud.toast('Welcome to Solara Bay — steal the orange coupe');
};

G.continueGame = () => {
  const data = loadSave();
  const p = G.player;
  if (data) {
    p.cash = data.cash;
    p.health = data.health;
    p.hasPistol = !!data.hasPistol;
    p.weapon = p.hasPistol ? 'pistol' : 'fists';
    p.pos.x = data.x;
    p.pos.z = data.z;
    p.group.position.set(p.pos.x, 0, p.pos.z);
    p.inCar = false;
    p.car = null;
    p.group.visible = true;
    for (const e of G.enemies) G.scene.remove(e.group);
    G.enemies = [];
    initMissions(G);
    // Restore the saved mission directly (earlier jobs are already paid).
    if (data.mission > 0) startMission(G, data.mission);
    G.state = 'playing';
    G.hud.showScreen(null);
    G.hud.toast('Save loaded — welcome back to Solara Bay');
  }
};

G.respawnAfterBusted = () => {
  const p = G.player;
  p.cash = Math.max(0, p.cash - 100);
  p.health = 100;
  G.wanted = 0;
  if (p.inCar && p.car) {
    p.car.isPlayer = false;
    p.inCar = false;
    p.car = null;
  }
  p.group.visible = true;
  p.pos.x = G.city.locations.start.x;
  p.pos.z = G.city.locations.start.z;
  p.group.position.set(p.pos.x, 0, p.pos.z);
  G.state = 'playing';
  G.hud.showScreen(null);
  G.hud.toast('You were busted — $100 fine, back on the plaza');
};

G.continueFreeRoam = () => {
  G.state = 'playing';
  G.hud.showScreen(null);
  G.hud.toast('Free roam — Solara Bay is yours');
};

// --- menu buttons -----------------------------------------------------------
document.getElementById('btn-new').addEventListener('click', () => {
  if (G.audio) G.audio.unlock();
  G.startNewGame();
});
document.getElementById('btn-continue').addEventListener('click', () => {
  if (G.audio) G.audio.unlock();
  G.continueGame();
});
document.getElementById('btn-resume').addEventListener('click', () => {
  G.state = 'playing';
  G.hud.showScreen(null);
});
document.getElementById('btn-quit').addEventListener('click', () => {
  saveGame(G);
  G.state = 'menu';
  G.hud.showScreen('start');
  refreshStartScreen();
});
document.getElementById('btn-respawn').addEventListener('click', () => G.respawnAfterBusted());
document.getElementById('btn-freeroam').addEventListener('click', () => G.continueFreeRoam());
document.getElementById('btn-playagain').addEventListener('click', () => G.startNewGame());

// E is handled on keydown for a snappy feel (enter/exit car, vault hold uses keys set).
window.addEventListener('keydown', (ev) => {
  if (ev.code === 'KeyE' && !ev.repeat && G.state === 'playing') tryEnterExitCar(G);
});

function refreshStartScreen() {
  const btn = document.getElementById('btn-continue');
  btn.style.display = hasSave() ? 'block' : 'none';
  const save = loadSave();
  document.getElementById('start-sub').textContent = save
    ? `Continue — $${save.cash.toLocaleString('en-US')}, mission ${save.mission + 1}/5`
    : 'Five jobs. One city. No rules but Rico\u2019s.';
}
refreshStartScreen();
G.hud.showScreen('start');

// --- main loop --------------------------------------------------------------
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.1);
  G.elapsed += dt;

  if (G.state === 'menu') {
    // Slow orbit around the plaza while the menu is up.
    const t = G.elapsed * 0.08;
    camera.position.set(20 + Math.cos(t) * 42, 26, 20 + Math.sin(t) * 42);
    camera.lookAt(20, 2, 20);
    updateTraffic(G, dt);
    updatePedestrians(G, dt);
  } else if (G.state === 'playing') {
    updatePlayer(G, dt);
    if (G.player.inCar) updatePlayerCar(G, dt);
    updateTraffic(G, dt);
    updatePedestrians(G, dt);
    updatePolice(G, dt);
    updateEnemies(G, dt);
    updateMissions(G, dt);
    updateCamera(G, dt);
    updateHud(G, dt);
    G.minimap.draw(G);
    if (G.audio) G.audio.tick(dt, G.wanted);
    // Autosave every 20 s.
    G.saveTimer += dt;
    if (G.saveTimer > 20) {
      G.saveTimer = 0;
      saveGame(G);
    }
  } else if (G.state === 'busted' || G.state === 'won') {
    // World idles behind the end screens.
    updateTraffic(G, dt);
    updatePedestrians(G, dt);
    updateCamera(G, dt);
  }
  // Paused: render the frozen frame, run nothing.

  renderer.render(scene, camera);
}
animate();
