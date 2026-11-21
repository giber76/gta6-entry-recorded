// missions.js — the M1–M6 story for Solara Bay.
// Coordinates and rewards are exact (the play-test asserts them). Cash is
// cumulative; `mission` is the index of the NEXT mission.
import { Viper } from './combat.js';
import { dist2 } from './util.js';

export const MISSION_NAMES = [
  'The First Coupe',
  'Lose the Heat',
  'The Package',
  'Marina Showdown',
  'The Bank Job',
  'The Last Job',
];

export const MISSION_CASH = [500, 1300, 2500, 4000, 7000, 12000];

export const MISSION_HINTS = [
  'Steal the coupe at (24, 26) and bring it to Rico\'s Garage.',
  'Lose the heat: drive the rectangle at |coord| = 160.',
  'Walk to the pier (158, -40), then deliver to Coral Junction (78, 116).',
  'Clear the 3 Vipers at Marina East.',
  'Hold E at the bank vault, steal the getaway car, reach the safehouse.',
  'Steal the boss coupe at (126, 48) and bring it to Rico\'s Garage.',
];

export class Missions {
  constructor(game) {
    this.game = game;
    this.mission = 0;
    this.stage = 0;
    this.holdTime = 0;
    this.m2Edges = { south: false, west: false, north: false, east: false };
    this.m2Driven = 0;
    this.m2Announced = false;
  }

  reset() {
    this.mission = 0;
    this.stage = 0;
    this.holdTime = 0;
    this.m2Edges = { south: false, west: false, north: false, east: false };
    this.m2Driven = 0;
    this.m2Announced = false;
  }

  // Called when the player enters a car.
  onEnterCar(car) {
    const g = this.game;
    if (this.mission === 0 && car === g.m1Coupe) this.stage = 1;
    if (this.mission === 5 && car === g.bossCoupe) this.stage = 1;
  }

  // Called when a Viper dies.
  onViperKilled() {
    const g = this.game;
    if (this.mission === 3) {
      const alive = g.vipers.filter((v) => v.alive).length;
      if (alive === 0) {
        this._complete(4, 4000);
        g.hud.toast('Marina Showdown complete — $4,000');
      }
    }
  }

  _complete(nextMission, cash) {
    const g = this.game;
    this.mission = nextMission;
    this.stage = 0;
    this.holdTime = 0;
    g.player.cash = cash;
    if (nextMission === 1) {
      g.wanted = 2;
      g.hud.toast('M1 complete — $500. Lose the heat!');
    } else if (nextMission === 2) {
      g.wanted = 0;
      g.hud.toast('M2 complete — $1,300. The heat is off.');
    } else if (nextMission === 3) {
      // clear the M3 ambush vipers, start M4: pistol + 3 Vipers at Marina
      g.clearVipers();
      g.player.givePistol();
      g.spawnVipers([
        { x: 95, z: 30 },
        { x: 105, z: 42 },
        { x: 100, z: 48 },
      ], { health: 45, shoots: true });
      g.hud.toast('M3 complete — $2,500. Pistol issued: Marina Showdown.');
    } else if (nextMission === 4) {
      g.hud.toast('M4 complete — $4,000. The Bank Job: hold E at the vault.');
    } else if (nextMission === 5) {
      // start M6: two guards at Marina East
      g.spawnVipers([
        { x: 98, z: 34 },
        { x: 104, z: 44 },
      ], { health: 45, shoots: false });
      g.hud.toast('M5 complete — $7,000. The Last Job: steal the boss coupe.');
    }
  }

  update(dt) {
    const g = this.game;
    const p = g.player;
    if (g.state !== 'playing') return;

    if (this.mission === 0) {
      // M1: deliver the coupe to Rico's Garage.
      if (p.inCar && p.car === g.m1Coupe && dist2(p.x, p.z, -118, 116) < 12) {
        this._complete(1, 500);
      }
    } else if (this.mission === 1) {
      // M2: drive the rectangle at |coord| = 160, then the heat drops.
      if (p.inCar && p.car) this.m2Driven += Math.abs(p.car.speed) * dt;
      if (Math.abs(p.z - 160) < 15) this.m2Edges.south = true;
      if (Math.abs(p.x + 160) < 15) this.m2Edges.west = true;
      if (Math.abs(p.z + 160) < 15) this.m2Edges.north = true;
      if (Math.abs(p.x - 160) < 15) this.m2Edges.east = true;
      const all = this.m2Edges.south && this.m2Edges.west && this.m2Edges.north && this.m2Edges.east;
      if (all && this.m2Driven > 500) {
        this._complete(2, 1300);
      }
    } else if (this.mission === 2) {
      // M3: on foot at the pier -> ambush; deliver to Coral Junction.
      if (this.stage === 0 && !p.inCar && dist2(p.x, p.z, 158, -40) < 10) {
        this.stage = 1;
        g.spawnVipers([
          { x: 150, z: -34 },
          { x: 164, z: -48 },
        ], { health: 45, shoots: true });
        g.hud.toast('Ambush! Two Vipers at the pier.');
      }
      if (dist2(p.x, p.z, 78, 116) < 12) {
        this._complete(3, 2500);
      }
    } else if (this.mission === 3) {
      // M4: handled by onViperKilled (all 3 down).
    } else if (this.mission === 4) {
      // M5: hold E within 6 m of the vault (strictly under 6.0).
      if (this.stage === 0 && !p.inCar && dist2(p.x, p.z, -40, -80) < 6.0 && g.input.held('e')) {
        this.holdTime += dt;
        if (this.holdTime >= 4) {
          this.stage = 1;
          g.wanted = 3;
          g.hud.toast('Vault cracked — wanted level 3! Grab the getaway car.');
        }
      } else if (this.stage === 0) {
        this.holdTime = Math.max(0, this.holdTime - dt * 2);
      }
      if (this.stage === 1 && p.inCar && p.car === g.getawayCar && dist2(p.x, p.z, 138, 76) < 12) {
        this._complete(5, 7000);
      }
    } else if (this.mission === 5) {
      // M6: deliver the boss coupe to Rico's Garage.
      if (p.inCar && p.car === g.bossCoupe && dist2(p.x, p.z, -118, 116) < 12) {
        this.mission = 6;
        this.stage = 0;
        p.cash = 12000;
        g.winGame();
      }
    }
  }
}
