// main.js — Solara Bay: game loop, state machine, chase camera.
// Boots the world, wires every module, and drives the frame loop.
import * as THREE from 'three';
import { mulberry32, headingVec, clamp } from './util.js';
import { buildCity, updateCity } from './city.js';
import { initAudio, updateAudio, cycleRadio } from './audio.js';
import { initTraffic, updateTraffic } from './traffic.js';
import { initPeds, updatePeds } from './pedestrians.js';
import { initPolice, updatePolice } from './police.js';
import { updateEnemies, firePistol } from './combat.js';
import { updateEffects } from './effects.js';
import { initPlayer, updatePlayer, enterCar, exitCar, nearestEnterableCar } from './player.js';
import { initMissions, updateMissions } from './missions.js';
import { drawMinimap } from './minimap.js';
import { initHud, updateHud } from './hud.js';
import { initInput, endFrameInput } from './input.js';
import { initDebug } from './debug.js';
import { repairCarObj, updateWrecks } from './vehicles.js';
import { writeSave } from './save.js';

const G = {
  state: 'menu',
  mission: 0,
  stage: 0,
  cash: 0,
  wanted: 0,
  elapsed: 0,
  mapZoom: 1,
  radio: 'OFF',
  pistolCooldown: 0,
  muzzleTimer: 0,
  damageFlash: 0,
  cameraShake: 0,
  aimTarget: null,
  aimLockedUntil: 0,
  cameraSnap: false,
  cars: [],
  parked: [],
  traffic: [],
  police: [],
  peds: [],
  enemies: [],
  effects: [],
  toast: null,
  toastTimer: 0,
  rng: mulberry32(1337),
};

function resetWorld() {
  // Repair and re-home every car.
  for (const car of G.cars) {
    repairCarObj(G, car);
    car.x = car.home.x;
    car.z = car.home.z;
    car.heading = car.home.heading;
    car.speed = 0;
    car.parked = car.name ? ['m1-coupe', 'parked-44-124', 'parked-86--46', 'getaway', 'boss-coupe', 'parked--80-40'].includes(car.name) : false;
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
    car.mesh.rotation.z = 0;
  }
  // Remove every enemy.
  for (const e of G.enemies) G.scene.remove(e.mesh);
  G.enemies = [];
  // Reset the player.
  const p = G.player;
  p.x = 0;
  p.z = 90;
  p.heading = Math.PI;
  p.health = 100;
  p.inCar = false;
  p.car = null;
  p.hasPistol = false;
  p.weapon = null;
  p.speed = 0;
  p.vx = 0;
  p.vz = 0;
  p.mesh.visible = true;
  p.mesh.position.set(p.x, 0, p.z);
  p.mesh.rotation.y = p.heading;
  G.mission = 0;
  G.stage = 0;
  G.cash = 0;
  G.wanted = 0;
  G.elapsed = 0;
  G.mapZoom = 1;
  G.radio = 'OFF';
  G.pistolCooldown = 0;
  G.m2Edges = { s: false, w: false, n: false, e: false };
  G.m4Spawned = false;
  G.vaultHold = 0;
  G.toast = null;
  G.toastTimer = 0;
  G.aimTarget = null;
  G.aimLockedUntil = 0;
  // The beacon goes back to the first coupe.
  if (G.beacon) {
    G.beacon.position.set(24, 30, 26);
    G.beaconBase.position.set(24, 0.15, 26);
  }
  // Police back on patrol.
  for (const car of G.police) car.caughtTimer = 0;
}

G.startNewGame = () => {
  resetWorld();
  G.state = 'playing';
};

G.enterFreeRoam = () => {
  if (G.state !== 'won') return;
  G.state = 'playing';
  writeSave(G);
};

function boot() {
  const canvas = document.getElementById('game-canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'default' });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(1);
  G.renderer = renderer;

  const scene = new THREE.Scene();
  // Sunset sky: warm haze.
  scene.background = new THREE.Color(0xff9a5c);
  scene.fog = new THREE.Fog(0xff9a5c, 120, 420);
  G.scene = scene;

  const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.1, 900);
  camera.position.set(0, 30, 160);
  G.camera = camera;

  // Lighting: a low warm sun + soft sky fill.
  const hemi = new THREE.HemisphereLight(0xffd9b0, 0x3a2a4a, 0.85);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffb36b, 1.6);
  sun.position.set(-120, 60, 140);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0x8ab4ff, 0.35);
  fill.position.set(100, 80, -100);
  scene.add(fill);

  initAudio(G);
  buildCity(G);
  initTraffic(G);
  initPeds(G);
  initPolice(G);
  initPlayer(G);
  initMissions(G);
  initInput(G);
  initHud(G);
  initDebug(G);
  G.pistolCooldown = 0;

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  const clock = new THREE.Clock();
  let prevMouse = false;
  let menuAngle = 0;

  function frame() {
    requestAnimationFrame(frame);
    const rawDt = clock.getDelta();
    const dt = Math.min(rawDt, 0.33);
    const input = G.input;

    // One-frame key edges (work in every state where they apply).
    if (input.rPressed && (G.state === 'playing')) cycleRadio(G);
    if (input.zPressed && G.state === 'playing') {
      G.mapZoom = G.mapZoom === 1 ? 2 : 4;
    }
    if (input.xPressed && G.state === 'playing') {
      G.mapZoom = G.mapZoom === 4 ? 2 : 1;
    }
    if (input.escPressed) {
      if (G.state === 'playing') G.state = 'paused';
      else if (G.state === 'paused') G.state = 'playing';
    }
    // E: enter / exit a car (edge). The vault hold reads input.e in missions.
    if (input.ePressed && G.state === 'playing') {
      const p = G.player;
      if (p.inCar) {
        exitCar(G);
      } else {
        const { car } = nearestEnterableCar(G, 4.5);
        if (car) enterCar(G, car);
      }
    }
    // Mouse click: fire the pistol (edge).
    if (input.mouseDown && !prevMouse && G.state === 'playing') firePistol(G);
    prevMouse = input.mouseDown;

    if (G.state === 'playing') {
      G.elapsed += dt;
      if (G.pistolCooldown > 0) G.pistolCooldown -= dt;
      // Physics in fixed 1/60 substeps so a slow frame stays stable.
      const steps = Math.max(1, Math.min(20, Math.ceil(dt / (1 / 60))));
      const sdt = dt / steps;
      for (let i = 0; i < steps; i++) {
        updatePlayer(G, sdt, input);
        updateTraffic(G, sdt);
        updatePolice(G, sdt);
      }
      updatePeds(G, dt);
      updateEnemies(G, dt);
      updateMissions(G, dt, input);
      updateWrecks(G, dt);
      updateEffects(G, dt);
      updateAudio(G, dt);
      updateCity(G, dt);
    }

    updateCamera(dt, menuAngle);
    if (G.state === 'menu') menuAngle += dt * 0.05;
    updateHud(G);
    if (G.state === 'playing') drawMinimap(G);
    renderer.render(scene, camera);
    endFrameInput(G);
  }

  function updateCamera(dt, menuAngle) {
    const p = G.player;
    if (G.state === 'menu') {
      // Slow cinematic orbit over the city for the menu backdrop.
      const a = menuAngle;
      camera.position.set(Math.sin(a) * 130, 46, Math.cos(a) * 130);
      camera.lookAt(0, 4, 0);
      return;
    }
    const fwd = headingVec(p.heading);
    const inCar = p.inCar && p.car;
    const dist = inCar ? 11 : 7.5;
    const height = inCar ? 4.4 : 3.4;
    const tx = p.x - fwd.x * dist;
    const tz = p.z - fwd.z * dist;
    const ty = height;
    if (G.cameraSnap) {
      camera.position.set(tx, ty, tz);
      G.cameraSnap = false;
    } else {
      const k = Math.min(1, dt * 9);
      camera.position.x += (tx - camera.position.x) * k;
      camera.position.y += (ty - camera.position.y) * k;
      camera.position.z += (tz - camera.position.z) * k;
    }
    // Look at the aim point (locked by faceNearest*) or ahead of the player.
    let look;
    if (G.aimTarget && G.elapsed < G.aimLockedUntil) {
      look = G.aimTarget;
    } else {
      look = new THREE.Vector3(p.x + fwd.x * 8, 1.2, p.z + fwd.z * 8);
    }
    camera.lookAt(look);
    // Explosion shake.
    if (G.cameraShake > 0) {
      const s = G.cameraShake * 0.55;
      camera.position.x += (Math.random() - 0.5) * s;
      camera.position.y += (Math.random() - 0.5) * s;
      camera.position.z += (Math.random() - 0.5) * s;
    }
    // Muzzle flash: a brief warm point light at the gun.
    if (G.muzzleTimer > 0) {
      if (!G.muzzleLight) {
        G.muzzleLight = new THREE.PointLight(0xffcc66, 20, 12);
        G.scene.add(G.muzzleLight);
      }
      G.muzzleLight.visible = true;
      G.muzzleLight.position.set(p.x + fwd.x * 1.2, 1.4, p.z + fwd.z * 1.2);
      G.muzzleLight.intensity = 20 * (G.muzzleTimer / 0.06);
    } else if (G.muzzleLight) {
      G.muzzleLight.visible = false;
    }
  }

  frame();
}

boot();
