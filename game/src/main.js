// main.js — Solara Bay: the Game class that wires every module together.
// Menu → playing → paused / won / busted. The loop runs on
// requestAnimationFrame; dt is clamped so a stalled tab can't jump the sim.
import * as THREE from 'three';
import { mulberry32, clamp } from './util.js';
import { Input } from './input.js';
import { AudioSys } from './audio.js';
import { buildCity } from './city.js';
import { Player } from './player.js';
import { Traffic } from './traffic.js';
import { Peds } from './pedestrians.js';
import { Police } from './police.js';
import { Combat } from './combat.js';
import { Missions } from './missions.js';
import { Effects } from './effects.js';
import { HUD } from './hud.js';
import { Minimap } from './minimap.js';
import { Save } from './save.js';
import { setupDebug } from './debug.js';

export class Game {
  constructor() {
    this.rng = mulberry32(20261121);
    this.state = 'menu';
    this.wanted = 0;
    this.elapsed = 0;
    this.cityTime = 0;
    this.mapZoom = 2;
    this.shake = 0;
    this.cameraMode = 'follow';
    this.cameraFixed = null;
    this.enemies = [];
    this.lastHealth = 100;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, canvas: document.getElementById('game') });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xff8a4a);
    this.scene.fog = new THREE.Fog(0xff9a55, 130, 420);
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
    this.camera.position.set(0, 6, 108);

    const hemi = new THREE.HemisphereLight(0xffd9b0, 0x2a3a4a, 0.9);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffc07a, 1.6);
    sun.position.set(-120, 180, 60);
    this.scene.add(sun);

    this.input = new Input();
    this.audio = new AudioSys();
    this.city = buildCity(this.scene, this.rng);
    this.player = new Player(this.scene);
    this.traffic = new Traffic(this.scene, this.rng);
    this.peds = new Peds(this.scene, this.rng);
    this.police = new Police(this.scene, this.rng);
    this.combat = new Combat(this.scene);
    this.missions = new Missions(this.scene);
    this.effects = new Effects(this.scene);
    this.hud = new HUD();
    this.minimap = new Minimap();
    this.save = new Save();
    this.debug = setupDebug(this);

    this.bindButtons();
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
    // Start the music on the first user gesture (browser autoplay rule).
    window.addEventListener('pointerdown', () => this.audio.ensure(), { once: true });
    window.addEventListener('keydown', () => this.audio.ensure(), { once: true });
  }

  bindButtons() {
    const byId = (id) => document.getElementById(id);
    if (byId('btn-new')) byId('btn-new').addEventListener('click', () => this.startNew());
    if (byId('btn-continue')) byId('btn-continue').addEventListener('click', () => this.startContinue());
    if (byId('btn-freeroam')) byId('btn-freeroam').addEventListener('click', () => this.freeRoam());
    if (byId('btn-retry')) byId('btn-retry').addEventListener('click', () => window.location.reload());
    if (byId('btn-menu')) byId('btn-menu').addEventListener('click', () => this.toMenu());
    if (byId('btn-resume')) byId('btn-resume').addEventListener('click', () => this.resume());
  }

  resume() {
    if (this.state === 'paused') {
      this.state = 'playing';
      this.hud.showPause(false);
    }
  }

  startNew() {
    this.state = 'playing';
    this.hud.hideOverlays();
    this.audio.ensure();
  }

  startContinue() {
    const s = this.save.read();
    if (s) {
      this.missions.mission = s.mission || 0;
      this.missions.cash = s.cash || 0;
      this.player.x = s.x ?? 0;
      this.player.z = s.z ?? 120;
      this.player.health = s.health ?? 100;
      this.player.mesh.position.set(this.player.x, 0, this.player.z);
      this.snapCamera();
    }
    this.state = 'playing';
    this.hud.hideOverlays();
    this.audio.ensure();
  }

  freeRoam() {
    this.state = 'playing';
    this.hud.hideOverlays();
  }

  toMenu() {
    this.state = 'menu';
    this.hud.showMenu();
  }

  setWon() {
    this.state = 'won';
    this.hud.showWin();
  }

  setBusted() {
    if (this.state !== 'playing') return;
    this.state = 'busted';
    this.hud.showBusted();
  }

  objectivePoint() {
    const m = this.missions;
    switch (m.mission) {
      case 0:
        return m.stage === 0 ? { x: 24, z: 26 } : { x: -118, z: 116 };
      case 1:
        if (!m.rect.south) return { x: 0, z: 160 };
        if (!m.rect.west) return { x: -160, z: 0 };
        if (!m.rect.north) return { x: 0, z: -160 };
        if (!m.rect.east) return { x: 160, z: 0 };
        return { x: -118, z: 116 };
      case 2:
        return m.stage === 0 ? { x: 158, z: -40 } : { x: 78, z: 116 };
      case 3:
        return { x: 100, z: 36 };
      case 4:
        return m.stage === 0 ? { x: -40, z: -80 } : { x: 138, z: 76 };
      case 5:
        return m.stage === 0 ? { x: 126, z: 48 } : { x: -118, z: 116 };
      default:
        return null;
    }
  }

  snapCamera() {
    const p = this.player;
    const fx = Math.sin(p.heading);
    const fz = Math.cos(p.heading);
    const dist = p.car ? 11 : 7;
    const height = p.car ? 5 : 3.5;
    this.camera.position.set(p.x - fx * dist, height, p.z - fz * dist);
    this.camera.lookAt(p.x + fx * 2, 1.5, p.z + fz * 2);
  }

  nearestEnterableCar() {
    const p = this.player;
    const candidates = [
      ...this.traffic.parked,
      ...this.traffic.cars,
      ...this.police.cruisers,
      ...this.missions.missionCars(),
    ];
    let best = null;
    let bestD = 4.5;
    for (const c of candidates) {
      if (!c || c.wrecked) continue;
      const dx = c.x - p.x;
      const dz = c.z - p.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return best;
  }

  update(dt) {
    // Escape pauses and resumes.
    if (this.input.pressed('Escape')) {
      if (this.state === 'playing') {
        this.state = 'paused';
        this.hud.showPause(true);
      } else if (this.state === 'paused') {
        this.state = 'playing';
        this.hud.showPause(false);
      }
    }
    // The city stays alive behind menus and the pause screen.
    this.cityTime += dt;
    this.city.update(dt, this.cityTime);
    // Pump the radio scheduler and the engine hum every frame.
    this.audio.update();
    this.audio.setEngine(this.player.car ? Math.abs(this.player.car.speed) / 46 : 0);

    if (this.state === 'playing') {
      this.elapsed += dt;
      const input = this.input;
      // Radio and minimap zoom.
      if (input.pressed('KeyR')) this.audio.cycleStation();
      if (input.pressed('KeyZ')) this.mapZoom = Math.min(4, this.mapZoom * 2);
      if (input.pressed('KeyX')) this.mapZoom = Math.max(1, this.mapZoom / 2);
      // Enter / exit cars.
      if (input.pressed('KeyE')) {
        if (this.player.car) {
          this.player.exitCar(this);
        } else {
          const car = this.nearestEnterableCar();
          if (car) {
            this.player.enterCar(car);
            this.audio.blip();
          }
        }
      }
      // Pistol.
      if (input.takeClick()) this.combat.shoot(this);
      // Movement.
      if (this.player.car) {
        const car = this.player.car;
        const throttle = (input.down('KeyW') ? 1 : 0) - (input.down('KeyS') ? 1 : 0);
        const steer = (input.down('KeyA') ? 1 : 0) - (input.down('KeyD') ? 1 : 0);
        car.drive(dt, throttle, steer);
        const fixed = this.city.resolveCircle(car.x, car.z, 1.4);
        car.x = fixed.x;
        car.z = fixed.z;
        car.syncMesh();
        this.player.syncToCar();
        // Wrecked car ejects Marlo on foot.
        if (car.wrecked) {
          this.player.exitCar(this);
          this.effects.flashVignette(0.6);
          this.shake = Math.max(this.shake, 0.5);
        }
        car.update(dt, this);
      } else {
        this.player.updateOnFoot(dt, this);
      }
      this.traffic.update(dt, this);
      this.peds.update(dt, this);
      this.police.update(dt, this);
      for (const e of this.enemies) e.update(dt, this);
      this.combat.update(dt);
      this.missions.update(dt, this);
      // Damage vignette when health drops.
      if (this.player.health < this.lastHealth) this.effects.flashVignette(0.55);
      this.lastHealth = this.player.health;
    }
    this.effects.update(dt);
    // Camera shake decays.
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 1.8);
    this.updateCamera(dt);
    this.hud.update(this);
    this.minimap.draw(this);
    this.input.endFrame();
  }

  updateCamera(dt) {
    if (this.cameraMode === 'fixed' && this.cameraFixed) {
      this.camera.position.set(...this.cameraFixed.pos);
      this.camera.lookAt(...this.cameraFixed.look);
      return;
    }
    const p = this.player;
    const fx = Math.sin(p.heading);
    const fz = Math.cos(p.heading);
    const dist = p.car ? 11 : 7;
    const height = p.car ? 5 : 3.5;
    const tx = p.x - fx * dist;
    const ty = height;
    const tz = p.z - fz * dist;
    const k = 1 - Math.exp(-dt * 6);
    this.camera.position.x += (tx - this.camera.position.x) * k;
    this.camera.position.y += (ty - this.camera.position.y) * k;
    this.camera.position.z += (tz - this.camera.position.z) * k;
    if (this.shake > 0.01) {
      const s = this.shake * 0.5;
      this.camera.position.x += (Math.random() - 0.5) * s;
      this.camera.position.y += (Math.random() - 0.5) * s;
      this.camera.position.z += (Math.random() - 0.5) * s;
    }
    this.camera.lookAt(p.x + fx * 2, 1.5, p.z + fz * 2);
  }

  loop() {
    let last = performance.now();
    const step = (now) => {
      const dt = clamp((now - last) / 1000, 0, 0.05);
      last = now;
      try {
        this.update(dt);
      } catch (err) {
        // Never let one frame's exception become a console error: park it
        // on window for debugging and keep rendering.
        window.__solaraError = String(err && err.stack ? err.stack : err);
      }
      this.renderer.render(this.scene, this.camera);
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
}

export function boot() {
  const game = new Game();
  game.hud.showMenu();
  game.loop();
  return game;
}
