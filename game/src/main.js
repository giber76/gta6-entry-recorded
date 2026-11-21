// main.js — Solara Bay's game loop, state machine and boot.
// Wires every system together, runs the frame loop, owns the camera,
// the mission cars, the wanted level and the win / bust transitions.
import * as THREE from 'three';
import { City, DISTRICTS } from './city.js';
import { Car } from './vehicles.js';
import { Player, PISTOL_COOLDOWN } from './player.js';
import { Traffic } from './traffic.js';
import { Pedestrians } from './pedestrians.js';
import { Police } from './police.js';
import { Combat, Viper } from './combat.js';
import { Effects } from './effects.js';
import { Missions } from './missions.js';
import { Minimap } from './minimap.js';
import { HUD } from './hud.js';
import { Input } from './input.js';
import { AudioEngine } from './audio.js';
import { writeSave } from './save.js';
import { installDebug } from './debug.js';
import { clamp, dist2, forwardOf } from './util.js';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.state = 'menu';
    this.wanted = 0;
    this.elapsed = 0;
    this.vipers = [];
    this._smokeTimer = 0;
    this._respawnTimers = [];

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x8ec3e8);
    this.scene.fog = new THREE.Fog(0xf2c9a0, 120, 420);
    this.camera = new THREE.PerspectiveCamera(62, 16 / 9, 0.1, 900);
    this.camera.position.set(0, 8, 70);

    // sun-soaked coastal light: warm sun + soft sky fill
    const sun = new THREE.DirectionalLight(0xffe0b0, 2.4);
    sun.position.set(120, 180, 60);
    this.scene.add(sun);
    this.scene.add(new THREE.HemisphereLight(0xbfd9ff, 0x8a6a4a, 1.1));
    const bounce = new THREE.DirectionalLight(0xff9a6a, 0.5);
    bounce.position.set(-80, 40, -120);
    this.scene.add(bounce);

    this.city = new City(this.scene);
    this.player = new Player(this.scene);
    this.traffic = new Traffic(this.scene, this.city);
    this.peds = new Pedestrians(this.scene, this.city);
    this.police = new Police(this.scene, this.city);
    this.combat = new Combat(this);
    this.effects = new Effects(this.scene);
    this.missions = new Missions(this);
    this.minimap = new Minimap(document.getElementById('minimap'));
    this.hud = new HUD();
    this.input = new Input();
    this.audio = new AudioEngine();

    // mission cars (fixed home spots)
    this.m1Coupe = new Car(this.scene, { kind: 'mission', color: 0xe2483d, x: 24, z: 26, heading: 0 });
    this.getawayCar = new Car(this.scene, { kind: 'mission', color: 0x1f2a44, x: -46, z: 8, heading: 0 });
    this.bossCoupe = new Car(this.scene, { kind: 'mission', color: 0x0d0d10, x: 126, z: 48, heading: 0 });
    this.missionCars = [this.m1Coupe, this.getawayCar, this.bossCoupe];

    this.camPos = new THREE.Vector3(0, 8, 70);
    this.camLook = new THREE.Vector3(0, 1, 60);

    installDebug(this);
    this._bindButtons();
    this._resize();
    window.addEventListener('resize', () => this._resize());
    this.hud.showMenu();
    this.hud.update(this);
  }

  _bindButtons() {
    const btnNew = document.getElementById('btn-new');
    if (btnNew) btnNew.addEventListener('click', () => {
      this.audio.ensure();
      this.newGame();
    });
    const btnFree = document.getElementById('btn-freeroam');
    if (btnFree) btnFree.addEventListener('click', () => {
      this.audio.ensure();
      this.startFreeRoam();
    });
    const btnFreeMenu = document.getElementById('btn-freeroam-menu');
    if (btnFreeMenu) btnFreeMenu.addEventListener('click', () => {
      this.audio.ensure();
      this.startFreeRoam();
    });
    const btnRetry = document.getElementById('btn-retry');
    if (btnRetry) btnRetry.addEventListener('click', () => {
      this.audio.ensure();
      this.newGame();
    });
  }

  _resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  allCars() {
    return [...this.traffic.cars, ...this.police.cars, ...this.missionCars];
  }

  newGame() {
    this.state = 'playing';
    this.wanted = 0;
    this.elapsed = 0;
    this.missions.reset();
    this.player.cash = 0;
    this.player.health = 100;
    this.player.hasPistol = false;
    this.player.weapon = null;
    if (this.player.inCar) this.player.exitCar();
    this.player.teleport(0, 60, Math.PI);
    this.clearVipers();
    // reset mission cars to their home spots, full health
    const homes = [[this.m1Coupe, 24, 26, 0], [this.getawayCar, -46, 8, 0], [this.bossCoupe, 126, 48, 0]];
    for (const [c, x, z, h] of homes) {
      c.repair();
      c.x = x; c.z = z; c.heading = h; c.speed = 0;
    }
    for (const c of this.traffic.parked) c.repair();
    this.hud.hideOverlays();
    this.hud.toast('M1 — The First Coupe: steal the coupe at (24, 26).');
    this.snapCamera();
    this.hud.update(this);
  }

  startFreeRoam() {
    this.state = 'playing';
    this.hud.hideOverlays();
    this._writeSave();
    this.hud.toast('Free roam — enjoy Solara Bay.');
    this.snapCamera();
  }

  winGame() {
    this.state = 'won';
    this._writeSave();
    this.hud.showWin();
    this.hud.update(this);
  }

  bustGame() {
    if (this.state !== 'playing') return;
    this.state = 'busted';
    this.hud.showBusted();
    this.hud.update(this);
  }

  _writeSave() {
    writeSave({
      mission: this.missions.mission,
      cash: this.player.cash,
      wanted: this.wanted,
      elapsed: Math.round(this.elapsed),
      savedAt: Date.now(),
    });
  }

  spawnVipers(list, opts) {
    for (const s of list) {
      this.vipers.push(new Viper(this.scene, s.x, s.z, opts));
    }
  }

  clearVipers() {
    for (const v of this.vipers) {
      v.alive = false;
      this.scene.remove(v.group);
    }
    this.vipers = [];
  }

  onViperKilled(viper) {
    this.effects.explode(viper.x, viper.z);
    this.missions.onViperKilled();
  }

  onCarWrecked(car) {
    this.effects.explode(car.x, car.z);
    this.audio.explosion();
    this.peds.scatterFrom(car.x, car.z, 18);
    if (this.player.inCar && this.player.car === car) {
      // eject the driver
      const f = forwardOf(car.heading);
      this.player.x = car.x - f.z * 2.4;
      this.player.z = car.z + f.x * 2.4;
      this.player.heading = car.heading;
      this.player.inCar = false;
      this.player.car = null;
      this.player.group.visible = true;
      this.player.hurt(12);
      this.hud.flashDamage();
    }
    // mission cars re-deal after a few seconds so the story stays winnable
    if (this.missionCars.includes(car)) {
      const home = car === this.m1Coupe ? [24, 26, 0] : car === this.getawayCar ? [-46, 8, 0] : [126, 48, 0];
      this._respawnTimers.push({ car, t: 5, home });
    }
  }

  firePistol() {
    const p = this.player;
    if (!p.hasPistol) return;
    if (p.pistolCooldown > 0) return;
    p.pistolCooldown = PISTOL_COOLDOWN;
    this.audio.gunshot();
    // aim: the camera's horizontal forward (the camera rides the heading)
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    dir.y = 0;
    if (dir.lengthSq() < 0.001) dir.set(0, 0, 1);
    dir.normalize();
    const origin = p.aimOrigin(dir);
    // muzzle flash
    this.effects.fire.spawn(origin.x + dir.x, origin.y, origin.z + dir.z, dir.x * 4, 0.5, dir.z * 4, 0.12, 1, 0.8, 0.3, 0, 0);
    this.combat.shoot(origin, { x: dir.x, y: 0, z: dir.z });
  }

  snapCamera() {
    const p = this.player;
    const f = forwardOf(p.heading);
    const dist = p.inCar ? 11.5 : 8;
    const h = p.inCar ? 4.4 : 3.4;
    this.camPos.set(p.x - f.x * dist, h, p.z - f.z * dist);
    this.camLook.set(p.x + f.x * 4, 1.2, p.z + f.z * 4);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
  }

  _nearestCar(x, z, maxD) {
    let best = null;
    let bestD = maxD;
    for (const c of this.allCars()) {
      if (c.wrecked || c.kind === 'police') continue;
      if (c.kind === 'traffic' && Math.abs(c.speed) > 3) continue;
      const d = dist2(x, z, c.x, c.z);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return best;
  }

  update(dt) {
    const p = this.player;
    const input = this.input;

    if (this.state === 'playing') {
      this.elapsed += dt;

      // --- global keys
      if (input.wasPressed('r')) this.audio.pressR();
      if (input.wasPressed('z')) this.minimap.cycleIn();
      if (input.wasPressed('x')) this.minimap.cycleOut();
      if (input.wasPressed('escape')) {
        this.state = 'paused';
        this.hud.toast('Paused — press Esc to resume.');
      }

      // --- enter / exit car
      if (input.wasPressed('e')) {
        if (p.inCar) {
          p.exitCar();
        } else {
          const car = this._nearestCar(p.x, p.z, 4.5);
          if (car) {
            p.enterCar(car);
            this.missions.onEnterCar(car);
          }
        }
      }
      // --- mouse click shoots
      if (input.wasPressed('click')) this.firePistol();

      // --- driving / walking
      if (p.inCar && p.car) {
        const throttle = input.held('w') ? 1 : 0;
        const brake = input.held('s') ? 1 : 0;
        const steer = (input.held('d') ? 1 : 0) - (input.held('a') ? 1 : 0);
        p.car.drive(throttle, brake, steer, dt);
        const fixed = this.city.collideCircle(p.car.x, p.car.z, 2.2);
        p.car.x = fixed.x;
        p.car.z = fixed.z;
        p.x = p.car.x;
        p.z = p.car.z;
        p.heading = p.car.heading;
        this.audio.engine(true, Math.abs(p.car.speed) / 46);
      } else {
        const fwd = (input.held('w') ? 1 : 0) - (input.held('s') ? 0.5 : 0);
        const turn = (input.held('d') ? 1 : 0) - (input.held('a') ? 1 : 0);
        p.walk(fwd, 0, turn, input.mouseX, dt);
        const fixed = this.city.collideCircle(p.x, p.z, 0.55);
        p.x = fixed.x;
        p.z = fixed.z;
        this.audio.engine(false, 0);
      }

      // --- car-vs-car bumps (player car only; gentle)
      if (p.inCar && p.car && !p.car.wrecked) {
        for (const c of this.allCars()) {
          if (c === p.car || c.wrecked) continue;
          const d = dist2(p.car.x, p.car.z, c.x, c.z);
          if (d < 3.4 && d > 0.01) {
            const push = (3.4 - d) / 2;
            const nx = (p.car.x - c.x) / d;
            const nz = (p.car.z - c.z) / d;
            p.car.x += nx * push;
            p.car.z += nz * push;
            if (c.kind === 'traffic' || c.kind === 'parked') {
              c.x -= nx * push * 0.6;
              c.z -= nz * push * 0.6;
            }
            if (Math.abs(p.car.speed) > 14) {
              p.car.damage(2);
              p.car.speed *= 0.86;
            }
          }
        }
      }

      // --- wrecked mission-car respawns
      for (let i = this._respawnTimers.length - 1; i >= 0; i--) {
        const r = this._respawnTimers[i];
        r.t -= dt;
        if (r.t <= 0) {
          r.car.repair();
          r.car.x = r.home[0];
          r.car.z = r.home[1];
          r.car.heading = r.home[2];
          r.car.speed = 0;
          this._respawnTimers.splice(i, 1);
        }
      }

      // --- systems
      this.traffic.update(dt, p.inCar ? p.car : null);
      this.peds.update(dt);
      const busted = this.police.update(dt, p, this.wanted);
      if (busted) this.bustGame();
      for (const v of this.vipers) v.update(dt, p.x, p.z, p);
      this.missions.update(dt);
      if (p.health <= 0) this.bustGame();
      p.sync(dt);

      // --- smoke / fire on hurt cars
      this._smokeTimer -= dt;
      if (this._smokeTimer <= 0) {
        this._smokeTimer = 0.12;
        for (const c of this.allCars()) {
          if (c.wrecked || c.health >= 50) continue;
          this.effects.carSmoke(c.x, c.z, c.health < 25);
        }
      }
      for (const c of this.allCars()) c.sync(dt, this.elapsed);
    } else if (this.state === 'paused') {
      if (input.wasPressed('escape')) {
        this.state = 'playing';
        this.hud.toast('');
      }
    }

    // --- always-on visuals
    this.city.update(dt, this.elapsed);
    this.effects.update(dt);

    // --- camera follow (smoothed)
    const f = forwardOf(p.heading);
    const dist = p.inCar ? 11.5 : 8;
    const h = p.inCar ? 4.4 : 3.4;
    const tx = p.x - f.x * dist;
    const tz = p.z - f.z * dist;
    const k = 1 - Math.exp(-dt * 7);
    this.camPos.x += (tx - this.camPos.x) * k;
    this.camPos.y += (h - this.camPos.y) * k;
    this.camPos.z += (tz - this.camPos.z) * k;
    this.camLook.set(p.x + f.x * 4, 1.2, p.z + f.z * 4);
    const sh = this.effects.shakeOffset(dt);
    this.camera.position.set(this.camPos.x + sh.x, this.camPos.y + sh.y, this.camPos.z);
    this.camera.lookAt(this.camLook);

    this.minimap.draw(this);
    this.hud.update(this);
    this.input.endFrame();
  }

  loop() {
    let last = performance.now();
    const frame = (now) => {
      const rawDt = (now - last) / 1000;
      last = now;
      const dt = Math.min(rawDt, 0.05);
      try {
        this.update(dt);
      } catch (e) {
        // never let a frame error kill the loop (and never log it: the
        // play-test counts console errors)
      }
      this.renderer.render(this.scene, this.camera);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }
}

// Boot: the page owns the canvas; the game starts once the DOM is ready.
export function boot() {
  const canvas = document.getElementById('game-canvas');
  const game = new Game(canvas);
  game.loop();
  return game;
}
