// main.js — Solara Bay bootstrap + game loop.
// Creates the renderer/scene/camera, instantiates every system, runs the
// frame loop, owns the menu/playing/paused/won/busted state machine and
// the third-person follow camera.

import { createAudio } from './audio.js';
import { buildCity } from './city.js';
import { createInput } from './input.js';
import { createPlayer } from './player.js';
import { createTraffic } from './traffic.js';
import { createPedestrians } from './pedestrians.js';
import { createPolice } from './police.js';
import { createCombat } from './combat.js';
import { createMissions } from './missions.js';
import { createEffects } from './effects.js';
import { createHud } from './hud.js';
import { createMinimap } from './minimap.js';
import { createSave } from './save.js';
import { createDebug } from './debug.js';
import { forwardOf } from './util.js';
import { drivePlayerCar } from './vehicles.js';

export function bootGame(canvas) {
  const THREE = window.THREE;
  if (!THREE) {
    throw new Error('Three.js failed to load');
  }

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  renderer.setPixelRatio(1);
  renderer.setSize(window.innerWidth, window.innerHeight);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87b5d6);
  scene.fog = new THREE.Fog(0x87b5d6, 130, 420);

  const camera = new THREE.PerspectiveCamera(
    62,
    window.innerWidth / window.innerHeight,
    0.1,
    900,
  );
  camera.position.set(0, 6, 12);

  const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x3a3a3a, 1.15);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2d8, 1.1);
  sun.position.set(80, 120, 40);
  scene.add(sun);

  // ---- shared world state ----
  const world = {
    state: 'menu',
    mission: 0,
    stage: 0,
    cash: 0,
    wanted: 0,
    elapsed: 0,
    cars: [],
    vipers: [],
    peds: [],
    radio: { station: -1 },
    mapZoom: 1,
    nextCarId: 1,
    cameraShake: 0,
    cameraSnap: true,
    scene,
    camera,
    renderer,
  };

  world.setState = function (next) {
    world.state = next;
    if (next === 'won') world.save.write();
  };

  // ---- systems (order matters: city before anything that spawns) ----
  createAudio(world);
  createInput(world, canvas);
  buildCity(world);
  createEffects(world);
  createSave(world);
  createPlayer(world);
  world.player.place(0, 20, 0);
  createTraffic(world);
  createPedestrians(world);
  createPolice(world);
  createCombat(world);
  createMissions(world);
  world.missions.init();
  createHud(world);
  createMinimap(world);
  createDebug(world);

  // ---- buttons ----
  const btnNew = document.getElementById('btn-new');
  const btnFree = document.getElementById('btn-freeroam');
  const btnRetry = document.getElementById('btn-retry');

  function newGame() {
    world.audio.ensure();
    world.audio.resume();
    world.missions.reset();
    world.cameraSnap = true;
    world.setState('playing');
  }

  if (btnNew) btnNew.addEventListener('click', newGame);
  if (btnFree) {
    btnFree.addEventListener('click', () => {
      world.setState('playing');
    });
  }
  if (btnRetry) btnRetry.addEventListener('click', newGame);

  // ---- per-frame key edges ----
  function handleKeys() {
    const input = world.input;
    if (input.wasPressed('KeyR')) world.audio.cycleStation();
    if (input.wasPressed('KeyZ')) world.minimap.zoomIn();
    if (input.wasPressed('KeyX')) world.minimap.zoomOut();
    if (input.wasPressed('Escape')) world.setState('paused');
  }

  // ---- third-person follow camera ----
  const camTarget = new THREE.Vector3();
  const camLook = new THREE.Vector3();

  function updateCamera(dt) {
    const p = world.player;
    const f = forwardOf(p.heading);
    const dist = p.inCar ? 11.5 : 8.5;
    const height = p.inCar ? 5.2 : 3.8;
    camTarget.set(p.x - f.x * dist, height, p.z - f.z * dist);
    if (world.cameraSnap) {
      camera.position.copy(camTarget);
      world.cameraSnap = false;
    } else {
      const k = Math.min(1, dt * 7);
      camera.position.lerp(camTarget, k);
    }
    camLook.set(p.x + f.x * 5, 1.4, p.z + f.z * 5);
    if (world.cameraShake > 0) {
      const s = world.cameraShake;
      const t = world.elapsed * 47;
      camLook.x += Math.sin(t * 1.3) * s * 0.6;
      camLook.y += Math.sin(t * 1.7) * s * 0.4;
    }
    camera.lookAt(camLook);
  }

  function resize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', resize);

  // ---- frame loop ----
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;

    if (world.state === 'playing') {
      world.elapsed += dt;
      handleKeys();
      world.player.update(dt);
      drivePlayerCar(world, dt);
      world.missions.update(dt);
      world.traffic.update(dt);
      world.police.update(dt);
      world.combat.update(dt);
      for (const car of world.cars) car.update(dt);
      world.pedestrians.update(dt);
      world.effects.update(dt);
      world.audio.update();
    } else if (world.state === 'paused') {
      if (world.input.wasPressed('Escape')) world.setState('playing');
    }

    updateCamera(dt);
    world.hud.update();
    world.minimap.draw();
    renderer.render(scene, camera);
    world.input.endFrame();
  }
  requestAnimationFrame(frame);

  world.booted = true;
  return world;
}
