// missions.js — the six story missions of Solara Bay (M1–M6) and the three
// mission cars: the first coupe, the getaway car and the boss coupe.
// Cash is cumulative; `mission` is the index of the NEXT mission.
import { Car } from './vehicles.js';
import { Viper } from './combat.js';
import { dist2 } from './util.js';

const GARAGE = { x: -118, z: 116 };
const CORAL = { x: 78, z: 116 };
const PIER = { x: 158, z: -40 };
const VAULT = { x: -40, z: -80 };
const SAFEHOUSE = { x: 138, z: 76 };

export class Missions {
  constructor(scene) {
    this.scene = scene;
    this.mission = 0;
    this.stage = 0;
    this.cash = 0;
    this.holdTimer = 0;
    this.rect = { south: false, west: false, north: false, east: false };
    this.m1Coupe = new Car(scene, 24, 26, 0, 0xd84040, 'player');
    this.getawayCar = new Car(scene, -46, 8, 0, 0x3a3a44, 'player');
    this.bossCoupe = new Car(scene, 126, 48, 0, 0x111118, 'boss');
  }

  missionCars() {
    return [this.m1Coupe, this.getawayCar, this.bossCoupe];
  }

  objectiveText() {
    switch (this.mission) {
      case 0:
        return this.stage === 0
          ? 'M1 The First Coupe — take the red coupe at (24, 26)'
          : 'M1 — drive the coupe to Rico\'s Garage';
      case 1:
        return 'M2 Lose the Heat — drive the rectangle at |coord| 160 to shake the cops';
      case 2:
        return this.stage === 0
          ? 'M3 The Package — walk to the pier (158, -40)'
          : 'M3 — deliver to Coral Junction (78, 116)';
      case 3:
        return 'M4 Marina Showdown — clear the 3 Vipers at Marina East';
      case 4:
        return this.stage === 0
          ? 'M5 The Bank Job — hold E at the bank vault (-40, -80)'
          : 'M5 — steal the getaway car and reach the safehouse (138, 76)';
      case 5:
        return this.stage === 0
          ? 'M6 The Last Job — steal the black boss coupe (126, 48)'
          : 'M6 — drive the boss coupe to Rico\'s Garage';
      default:
        return 'Free roam — Solara Bay is yours';
    }
  }

  spawnVipers(game, spots) {
    for (const [x, z] of spots) {
      const v = new Viper(this.scene, x, z);
      game.enemies.push(v);
    }
  }

  clearVipers(game) {
    for (const v of game.enemies) v.remove(this.scene);
    game.enemies = [];
  }

  update(dt, game) {
    const player = game.player;
    // Mission cars keep their smoke/fire state fresh.
    for (const c of this.missionCars()) c.update(dt, game);
    // The boss coupe re-deals if wrecked during M6.
    if (this.bossCoupe.wrecked && this.mission === 5) {
      this.bossCoupe.repair();
      this.bossCoupe.x = 126;
      this.bossCoupe.z = 48;
      this.bossCoupe.heading = 0;
      this.bossCoupe.syncMesh();
    }
    // Clean up dead Vipers.
    for (let i = game.enemies.length - 1; i >= 0; i--) {
      const v = game.enemies[i];
      if (!v.alive && v.deathTimer <= 0) {
        v.remove(this.scene);
        game.enemies.splice(i, 1);
      }
    }

    if (this.mission === 0) {
      if (player.car === this.m1Coupe) this.stage = 1;
      if (this.stage === 1 && dist2(player.x, player.z, GARAGE.x, GARAGE.z) < 10) {
        this.mission = 1;
        this.cash = 500;
        this.stage = 0;
        game.wanted = 2;
        game.audio.blip();
        game.save.write(game);
      }
      return;
    }

    if (this.mission === 1) {
      if (player.z > 150) this.rect.south = true;
      if (player.x < -150) this.rect.west = true;
      if (player.z < -150) this.rect.north = true;
      if (player.x > 150) this.rect.east = true;
      if (this.rect.south && this.rect.west && this.rect.north && this.rect.east) {
        this.mission = 2;
        this.cash = 1300;
        this.stage = 0;
        game.wanted = 0;
        game.audio.blip();
        game.save.write(game);
      }
      return;
    }

    if (this.mission === 2) {
      if (this.stage === 0 && !player.car && dist2(player.x, player.z, PIER.x, PIER.z) < 12) {
        this.stage = 1;
        this.spawnVipers(game, [[152, -36], [164, -44]]);
      }
      if (this.stage === 1 && dist2(player.x, player.z, CORAL.x, CORAL.z) < 10) {
        this.mission = 3;
        this.cash = 2500;
        this.stage = 0;
        this.clearVipers(game);
        player.givePistol();
        this.spawnVipers(game, [[94, 32], [106, 40], [100, 28]]);
        game.audio.blip();
        game.save.write(game);
      }
      return;
    }

    if (this.mission === 3) {
      if (game.enemies.length > 0 && !game.enemies.some((v) => v.alive)) {
        this.mission = 4;
        this.cash = 4000;
        this.stage = 0;
        game.audio.blip();
        game.save.write(game);
      }
      return;
    }

    if (this.mission === 4) {
      if (this.stage === 0) {
        const nearVault = !player.car && dist2(player.x, player.z, VAULT.x, VAULT.z) < 6;
        if (nearVault && game.input.down('KeyE')) {
          this.holdTimer += dt;
          if (this.holdTimer >= 4) {
            this.stage = 1;
            this.holdTimer = 0;
            game.wanted = 3;
            game.audio.blip();
          }
        } else {
          this.holdTimer = 0;
        }
        return;
      }
      if (player.car === this.getawayCar && dist2(player.x, player.z, SAFEHOUSE.x, SAFEHOUSE.z) < 10) {
        this.mission = 5;
        this.cash = 7000;
        this.stage = 0;
        this.spawnVipers(game, [[108, 38], [116, 44]]);
        game.audio.blip();
        game.save.write(game);
      }
      return;
    }

    if (this.mission === 5) {
      if (player.car === this.bossCoupe) this.stage = 1;
      if (this.stage === 1 && player.car === this.bossCoupe && dist2(player.x, player.z, GARAGE.x, GARAGE.z) < 10) {
        this.mission = 6;
        this.cash = 12000;
        game.setWon();
        game.save.write(game);
      }
    }
  }
}
