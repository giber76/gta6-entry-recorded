// debug.js — window.__solara, the automation contract the play-test
// drives, plus a staging helper that sets up a scene for screenshots.
// state() returns exactly the keys the contract names.
import { DISTRICTS } from './city.js';

export function installDebug(world) {
  const api = {
    state() {
      const p = world.player;
      const m = world.missions;
      const car = p.inCar && p.car ? p.car : null;
      return {
        state: world.gameState,
        mission: m.mission,
        cash: m.cash,
        wanted: m.wanted,
        health: Math.round(p.health),
        inCar: p.inCar,
        stage: m.stage,
        carHealth: car ? Math.round(car.health) : null,
        speedKmh: car ? Math.round(car.speedKmh) : 0,
        x: car ? car.x : p.x,
        z: car ? car.z : p.z,
        radio: world.radio.station,
        mapZoom: world.minimap.zoom,
        enemies: world.vipers.count,
        parkedCars: world.traffic.parkedCount,
        hasPistol: p.hasPistol,
        weapon: p.weapon,
        elapsed: world.elapsed,
      };
    },
    teleport(x, z, heading) {
      world.teleport(x, z, heading);
    },
    damageCar(n) {
      const p = world.player;
      if (p.inCar && p.car) p.car.damage(n, world.effects);
    },
    repairCar() {
      const p = world.player;
      if (p.inCar && p.car) p.car.repair();
    },
    givePistol() {
      world.player.givePistol();
    },
    faceNearestParkedCar() {
      const p = world.player;
      const car = world.traffic.nearestParked(p.inCar && p.car ? p.car.x : p.x, p.inCar && p.car ? p.car.z : p.z, 200);
      if (!car) return;
      const ox = p.inCar && p.car ? p.car.x : p.x;
      const oz = p.inCar && p.car ? p.car.z : p.z;
      const h = Math.atan2(car.x - ox, car.z - oz);
      world.setHeading(h);
    },
    faceNearestEnemy() {
      const p = world.player;
      const v = world.vipers.nearest(p.x, p.z);
      if (!v) return;
      const h = Math.atan2(v.x - p.x, v.z - p.z);
      world.setHeading(h);
    },
    click() {
      world.shoot();
    },
    heal() {
      world.player.heal();
    },
    // Staging helper for screenshots: put the game in a photogenic state
    // for a named scene. Drives the same systems the player would use.
    stage(name) {
      const p = world.player;
      const m = world.missions;
      if (name === 'chase') {
        // M2 in progress: wanted 2, police chasing, player in the coupe.
        m.mission = 1;
        m.stage = 0;
        m.cash = 500;
        m.wanted = 2;
        m.m1Coupe.teleport(0, 60, Math.PI);
        if (!p.inCar) p.enterCar(m.m1Coupe);
        p.teleport(0, 60, Math.PI);
        m.m1Coupe.speed = 30;
        world.gameState = 'playing';
      } else if (name === 'driving') {
        // M1: clean start, no heat, no cash yet.
        m.mission = 0;
        m.stage = 1;
        m.cash = 0;
        m.wanted = 0;
        m.m1Coupe.teleport(0, 40, Math.PI);
        if (!p.inCar) p.enterCar(m.m1Coupe);
        p.teleport(0, 40, Math.PI);
        m.m1Coupe.speed = 32;
        world.gameState = 'playing';
      } else if (name === 'onfoot') {
        // Marlo on foot, on the road, city ahead.
        m.mission = 0;
        m.stage = 0;
        m.cash = 0;
        m.wanted = 0;
        if (p.inCar) p.exitCar();
        m.m1Coupe.teleport(24, 26, Math.PI / 2);
        p.teleport(0, 100, Math.PI);
        world.gameState = 'playing';
      } else if (name === 'combat') {
        // M6: Marlo ON FOOT with the pistol, both Viper guards, the boss
        // coupe, beacon, ocean behind. The M1 coupe is sent home so the
        // marina frame holds only the M6 scene.
        m.mission = 5;
        m.stage = 0;
        m.cash = 7000;
        m.wanted = 3;
        if (p.inCar) p.exitCar();
        m.m1Coupe.teleport(24, 26, Math.PI / 2);
        p.givePistol();
        p.teleport(104, 48, Math.PI / 2);
        world.vipers.clear();
        world.vipers.spawn(118, 40, 1, 3);
        world.vipers.spawn(122, 54, 1, 3);
        world.gameState = 'playing';
      }
      world.hud.showMenu(false);
      world.hud.showWin(false);
      world.hud.showBusted(false);
    },
  };
  window.__solara = api;
  return api;
}

export const DISTRICT_NAMES = DISTRICTS;
