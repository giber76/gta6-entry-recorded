// debug.js — window.__solara, the debug API the play-test drives, plus a
// stageShot helper used only by the screenshot script to compose the four
// screenshots. The play-test calls only the eight functions of the contract.
import { headingTo, dist2 } from './util.js';

export function setupDebug(game) {
  const api = {
    state() {
      const p = game.player;
      return {
        state: game.state,
        mission: game.missions.mission,
        cash: game.missions.cash,
        wanted: game.wanted,
        health: p.health,
        inCar: p.inCar,
        stage: game.missions.stage,
        carHealth: p.car ? Math.round(p.car.health) : null,
        speedKmh: Math.round(p.speedKmh()),
        x: Math.round(p.x * 10) / 10,
        z: Math.round(p.z * 10) / 10,
        radio: game.audio.stationName(),
        mapZoom: game.mapZoom,
        enemies: game.enemies.filter((e) => e.alive).length,
        parkedCars: game.traffic.parkedCount(),
        hasPistol: p.hasPistol,
        weapon: p.weapon,
        elapsed: Math.round(game.elapsed * 10) / 10,
      };
    },

    teleport(x, z, heading) {
      const p = game.player;
      p.heading = heading;
      if (p.car) {
        p.car.x = x;
        p.car.z = z;
        p.car.heading = heading;
        p.car.syncMesh();
        p.x = x;
        p.z = z;
      } else {
        p.x = x;
        p.z = z;
        p.mesh.position.set(x, 0, z);
        p.mesh.rotation.y = heading;
      }
      game.snapCamera();
    },

    damageCar(n) {
      const car = game.player.car;
      if (car) car.damage(n, game);
    },

    repairCar() {
      const car = game.player.car;
      if (car) car.repair();
    },

    givePistol() {
      game.player.givePistol();
    },

    faceNearestParkedCar() {
      const p = game.player;
      const found = game.traffic.nearestParked(p.x, p.z);
      if (found) {
        p.heading = headingTo(p.x, p.z, found.car.x, found.car.z);
        if (p.car) {
          p.car.heading = p.heading;
          p.car.syncMesh();
        }
        p.mesh.rotation.y = p.heading;
        game.snapCamera();
      }
    },

    faceNearestEnemy() {
      const p = game.player;
      let best = null;
      let bestD = Infinity;
      for (const e of game.enemies) {
        if (!e.alive) continue;
        const d = dist2(p.x, p.z, e.x, e.z);
        if (d < bestD) {
          bestD = d;
          best = e;
        }
      }
      if (best) {
        p.heading = headingTo(p.x, p.z, best.x, best.z);
        if (p.car) {
          p.car.heading = p.heading;
          p.car.syncMesh();
        }
        p.mesh.rotation.y = p.heading;
        game.snapCamera();
      }
    },

    click() {
      game.combat.shoot(game);
    },

    heal() {
      game.player.heal();
    },

    // Screenshot staging only: puts the game into a photogenic state for
    // one of the four screenshots. Never called by the play-test.
    stageShot(name) {
      const p = game.player;
      const m = game.missions;
      if (name === 'chase') {
        game.state = 'playing';
        m.mission = 1;
        m.cash = 500;
        game.wanted = 2;
        p.givePistol();
        if (!p.car) p.enterCar(m.m1Coupe);
        api.teleport(40, 60, Math.PI / 2);
        const cruiser = game.police.cruisers[0];
        cruiser.x = 52;
        cruiser.z = 62;
        cruiser.heading = Math.PI / 2;
        cruiser.speed = 0;
        cruiser.syncMesh();
      } else if (name === 'driving') {
        game.state = 'playing';
        m.mission = 0;
        m.stage = 1;
        if (!p.car) p.enterCar(m.m1Coupe);
        api.teleport(0, 40, Math.PI);
        p.car.speed = 38;
      } else if (name === 'onfoot') {
        game.state = 'playing';
        m.mission = 2;
        m.stage = 0;
        game.wanted = 0;
        if (p.car) p.exitCar(game);
        api.teleport(78, 108, Math.PI * 0.75);
      } else if (name === 'combat') {
        game.state = 'playing';
        m.mission = 5;
        m.cash = 7000;
        game.wanted = 3;
        p.givePistol();
        if (p.car) p.exitCar(game);
        game.enemies = [];
        game.missions.spawnVipers(game, [[94, 32], [106, 40]]);
        api.teleport(100, 36, 0);
        api.faceNearestEnemy();
        game.cameraMode = 'follow';
        game.cameraFixed = null;
        game.snapCamera();
      }
      game.hud.update(game);
      game.minimap.draw(game);
    },
  };
  window.__solara = api;
  return api;
}
