// main.js — Solara Bay boot, game loop, camera, and the state machine.
// Owns the world object every other module reads: player, traffic,
// police, vipers, missions, effects, radio, hud, minimap.
import * as THREE from 'three';
import { buildCity, collideCircle, clampToLand } from './city.js';
import { Player } from './player.js';
import { Traffic } from './traffic.js';
import { Pedestrians } from './pedestrians.js';
import { Police } from './police.js';
import { Vipers, Pistol } from './combat.js';
import { Effects } from './effects.js';
import { Radio } from './audio.js';
import { HUD } from './hud.js';
import { Minimap } from './minimap.js';
import { Missions } from './missions.js';
import { Input } from './input.js';
import { installDebug } from './debug.js';
import { writeSave } from './save.js';
import { clamp, forwardOf } from './util.js';

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
renderer.setPixelRatio(1);
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
// Warm sunset: hazy peach sky, matching fog.
scene.background = new THREE.Color(0xe8a06a);
scene.fog = new THREE.Fog(0xe8a06a, 90, 320);

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);

// Sunset lighting: warm sun low in the west, soft sky fill.
const sun = new THREE.DirectionalLight(0xffc98a, 1.6);
sun.position.set(-120, 90, -60);
scene.add(sun);
const sky = new THREE.HemisphereLight(0xffd9b0, 0x3a4a5a, 0.85);
scene.add(sky);

const city = buildCity(scene);
const colliders = city.colliders;
const effects = new Effects(scene);
const radio = new Radio();
const hud = new HUD();
const minimap = new Minimap(document.getElementById('minimap'));
const player = new Player(scene);
const traffic = new Traffic(scene, colliders);
const peds = new Pedestrians(scene, colliders);
const police = new Police(scene, colliders);
const vipers = new Vipers(scene);
const pistol = new Pistol();

const world = {
  gameState: 'menu',
  elapsed: 0,
  player,
  traffic,
  police,
  vipers,
  missions: null, // set below (needs world)
  effects,
  radio,
  hud,
  minimap,
  camera,
  teleport(x, z, heading) {
    player.teleport(x, z, heading);
    camYaw = heading;
    camPitch = 0.12;
  },
  setHeading(h) {
    if (player.inCar && player.car) {
      player.car.heading = h;
      player.car.sync();
    } else {
      player.heading = h;
      player.sync();
    }
    camYaw = h;
  },
  shoot() {
    if (world.gameState !== 'playing') return;
    if (!player.hasPistol || !pistol.ready) return;
    const origin = new THREE.Vector3();
    camera.getWorldPosition(origin);
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const allCars = [
      ...traffic.parked,
      ...traffic.cars.map((t) => t.car),
      ...police.cars,
      ...world.missions.missionCars,
    ];
    const res = pistol.fire(origin, dir, {
      vipers,
      cars: allCars,
      skipCar: player.inCar ? player.car : null,
      effects,
      player,
    });
    if (res) {
      radio.shot();
      if (res.kind === 'car' && res.wrecked) {
        peds.scatterAt(res.target.x, res.target.z, 20);
      }
      if (res.kind === 'viper' && res.killed) {
        peds.scatterAt(res.target.x, res.target.z, 14);
      }
    }
  },
};

const missions = new Missions(scene, {
  player,
  traffic,
  vipers,
  police,
  effects,
  radio,
  hooks: {
    onWin() {
      world.gameState = 'won';
      hud.showWin(true, missions.cash);
      writeSave({ mission: 6, cash: missions.cash, x: player.x, z: player.z });
    },
    onBusted() {
      if (world.gameState !== 'playing') return;
      world.gameState = 'busted';
      hud.showBusted(true);
    },
  },
});
world.missions = missions;

const input = new Input(canvas, (code, isDown) => {
  if (!isDown) return;
  if (world.gameState === 'menu') return;
  if (code === 'KeyR') {
    radio.cycle();
  } else if (code === 'KeyZ') {
    minimap.cycleIn();
  } else if (code === 'KeyX') {
    minimap.cycleOut();
  } else if (code === 'KeyE') {
    onPressE();
  } else if (code === 'Escape') {
    if (world.gameState === 'playing') {
      world.gameState = 'paused';
    } else if (world.gameState === 'paused') {
      world.gameState = 'playing';
    }
  }
});

// Click (mouse down on the canvas) fires the pistol.
canvas.addEventListener('pointerdown', (ev) => {
  if (ev.button === 0 && world.gameState === 'playing' && player.hasPistol) {
    world.shoot();
  }
});

function nearestEnterableCar(x, z, maxDist = 4.5) {
  const all = [
    ...traffic.parked,
    ...traffic.cars.map((t) => t.car),
    ...police.cars,
    ...missions.missionCars,
  ];
  let best = null;
  let bestD = maxDist;
  for (const c of all) {
    if (c.wrecked) continue;
    const d = Math.hypot(c.x - x, c.z - z);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

function onPressE() {
  if (world.gameState !== 'playing') return;
  if (player.inCar) {
    player.exitCar();
    return;
  }
  // M5 vault hold takes priority over entering a car near the bank.
  const dVault = Math.hypot(player.x - -40, player.z - -80);
  if (missions.mission === 4 && missions.stage === 0 && dVault < 6) return;
  const car = nearestEnterableCar(player.x, player.z);
  if (car) {
    player.enterCar(car);
    missions.onEnterCar(car);
  }
}

// Menu buttons.
document.getElementById('btn-new').addEventListener('click', () => {
  startNewGame();
});
document.getElementById('btn-freeroam').addEventListener('click', () => {
  if (world.gameState === 'won') {
    world.gameState = 'playing';
    hud.showWin(false);
    writeSave({ mission: 6, cash: missions.cash, x: player.x, z: player.z });
  }
});
document.getElementById('btn-retry').addEventListener('click', () => {
  hud.showBusted(false);
  startNewGame();
});

function startNewGame() {
  // Fresh run: reset everything the missions own, put Marlo at spawn.
  missions.mission = 0;
  missions.stage = 0;
  missions.cash = 0;
  missions.wanted = 0;
  missions.legs = { l1: false, l2: false, l3: false, l4: false };
  missions.holdTime = 0;
  missions.m4Active = false;
  missions.m6GuardsSpawned = false;
  vipers.clear();
  missions.m1Coupe.respawn(24, 26, Math.PI / 2);
  missions.getawayCar.respawn(-46, 8, 0);
  missions.bossCoupe.respawn(126, 48, Math.PI / 2);
  for (const c of traffic.parked) c.repair();
  for (const t of traffic.cars) t.car.repair();
  for (const c of police.cars) c.repair();
  player.health = 100;
  player.hasPistol = false;
  player.weapon = null;
  if (player.inCar) {
    player.inCar = false;
    player.car = null;
    player.mesh.visible = true;
  }
  player.teleport(0, 120, 0);
  world.elapsed = 0;
  world.gameState = 'playing';
  hud.showMenu(false);
  hud.showWin(false);
  hud.showBusted(false);
}

// Camera follows behind the heading, smoothed; mouse drag orbits it.
let camYaw = 0;
let camPitch = 0.12;
let camDist = 8.5;

function updateCamera(dt) {
  const target = player.inCar && player.car ? player.car : player;
  const heading = target.heading;
  // Ease the camera yaw toward the heading (fast when driving).
  let diff = heading - camYaw;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  camYaw += diff * Math.min(1, dt * (player.inCar ? 5 : 8));
  const mouse = input.consumeMouse();
  camYaw -= mouse.dx * 0.004;
  camPitch = clamp(camPitch + mouse.dy * 0.002, -0.05, 0.55);
  const dist = player.inCar ? 10.5 : 7;
  const h = player.inCar ? 4.2 : 3.1;
  const cx = target.x - Math.sin(camYaw) * dist;
  const cz = target.z - Math.cos(camYaw) * dist;
  const shake = effects.shakeOffset();
  camera.position.set(cx + shake.x, h + shake.y, cz);
  camera.lookAt(target.x + Math.sin(camYaw) * 4, 1.4, target.z + Math.cos(camYaw) * 4);
  camDist = dist;
}

function pushOutCircle(x, z, r, collidersList) {
  const fixed = collideCircle(x, z, r, collidersList);
  if (fixed) return fixed;
  const clamped = clampToLand(x, z);
  return clamped;
}

// One fixed substep of game logic (dt <= 0.033).
function step(dt) {
  input.update(dt);
  city.update(dt);
  effects.update(dt);
  pistol.update(dt);
  player.update(dt);

  if (world.gameState !== 'playing') return;
  world.elapsed += dt;

  const drive = input.drive();
  const walk = input.walk();

  // Player / car movement.
  if (player.inCar && player.car) {
    const car = player.car;
    car.damageCooldown = Math.max(0, car.damageCooldown - dt);
    // Substep the drive so fast cars cannot tunnel through buildings.
    const sub = Math.max(1, Math.ceil((Math.abs(car.speed) * dt) / 1.5));
    const sdt = dt / sub;
    for (let i = 0; i < sub; i++) {
      car.drive(drive, sdt);
      const fixed = collideCircle(car.x, car.z, 2.1, colliders);
      if (fixed) {
        // Building hit: stop into it, take a little damage.
        const hitSpeed = Math.abs(car.speed);
        car.x = fixed.x;
        car.z = fixed.z;
        if (hitSpeed > 6) {
          car.damage(5, effects);
          effects.shake(0.25, 0.5);
          car.speed *= 0.35;
        } else {
          car.speed *= 0.6;
        }
        car.sync();
      }
      const cl = clampToLand(car.x, car.z);
      car.x = cl.x;
      car.z = cl.z;
      car.sync();
    }
    // Collisions with other cars.
    const others = [
      ...traffic.parked,
      ...traffic.cars.map((t) => t.car),
      ...police.cars,
      ...missions.missionCars,
    ];
    for (const o of others) {
      if (o === car || o.wrecked) continue;
      if (Math.hypot(o.x - car.x, o.z - car.z) < 3.6) {
        // Push the two cars apart (inlined; avoids a second import cycle).
        const dx = o.x - car.x;
        const dz = o.z - car.z;
        const d = Math.hypot(dx, dz) || 0.01;
        const push = (3.6 - d) / 2;
        const nx = dx / d;
        const nz = dz / d;
        car.x -= nx * push;
        car.z -= nz * push;
        o.x += nx * push;
        o.z += nz * push;
        car.sync();
        o.sync();
        car.speed *= 0.97;
      }
    }
    if (car.wrecked) {
      // Ejected by the explosion: Marlo is thrown clear on foot.
      const f = forwardOf(car.heading);
      player.x = car.x - f.x * 3;
      player.z = car.z - f.z * 3;
      player.heading = car.heading;
      player.inCar = false;
      player.car = null;
      player.mesh.visible = true;
      player.sync();
      peds.scatterAt(car.x, car.z, 20);
      effects.shake(0.7, 1.0);
      radio.explosion();
    }
    // Smoke / fire while damaged.
    if (car.burning && Math.random() < dt * 8) effects.smokePuff(car.x, 1.2, car.z);
    else if (car.smoking && Math.random() < dt * 4) effects.smokePuff(car.x, 1.0, car.z);
  } else {
    player.walk(walk, dt, colliders, (x, z, r) => pushOutCircle(x, z, r, colliders));
    const cl = clampToLand(player.x, player.z);
    player.x = cl.x;
    player.z = cl.z;
    player.sync();
  }

  traffic.update(dt, player.inCar ? player.car : null, effects);
  peds.update(dt, player.x, player.z);
  police.update(dt, missions.wanted, player, effects, () => {
    missions.world.hooks.onBusted();
  });
  vipers.update(dt, player, effects, (dmg) => {
    if (world.gameState !== 'playing') return;
    const dead = player.damage(dmg);
    effects.setVignette(0.55);
    setTimeout(() => effects.setVignette(player.health < 30 ? 0.45 : 0), 250);
    if (dead) {
      world.gameState = 'busted';
      hud.showBusted(true);
    }
  });
  missions.update(dt, input.eHeld);

  // Low-health vignette.
  if (player.health < 30) effects.setVignette(0.45);
  else if (player.health < 60) effects.setVignette(0.18);

  // HUD + minimap.
  const s = {
    cash: missions.cash,
    wanted: missions.wanted,
    health: player.health,
    radio: radio.station,
    speedKmh: player.inCar && player.car ? player.car.speedKmh : 0,
    inCar: player.inCar,
    mission: missions.mission,
    objective: missions.objective(),
    x: player.inCar && player.car ? player.car.x : player.x,
    z: player.inCar && player.car ? player.car.z : player.z,
    heading: player.inCar && player.car ? player.car.heading : player.heading,
    beacon: missions.beaconTarget,
    police: police.cars.filter((c) => !c.wrecked).map((c) => ({ x: c.x, z: c.z })),
    enemiesPos: vipers.alive.map((v) => ({ x: v.x, z: v.z })),
  };
  hud.update(s);
  minimap.draw(s);
}

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  // Fixed substeps so physics stays stable at low frame rates.
  const steps = Math.max(1, Math.ceil(dt / 0.033));
  const sdt = dt / steps;
  for (let i = 0; i < steps; i++) step(sdt);
  updateCamera(dt);
  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

installDebug(world);
hud.showMenu(true);
requestAnimationFrame(frame);
