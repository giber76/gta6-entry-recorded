// missions.js — the six-mission story of Solara Bay. Cash is cumulative
// (500 / 1300 / 2500 / 4000 / 7000 / 12000), `mission` is the index of
// the NEXT mission, and a glowing beacon always marks the objective.
import * as THREE from 'three';
import { Car, CAR_COLORS } from './vehicles.js';
import { DISTRICTS } from './city.js';
import { writeSave } from './save.js';
import { dist2D } from './util.js';

const REWARDS = [500, 1300, 2500, 4000, 7000, 12000];
const NAMES = [
  'M1 · The First Coupe',
  'M2 · Lose the Heat',
  'M3 · The Package',
  'M4 · Marina Showdown',
  'M5 · The Bank Job',
  'M6 · The Last Job',
];

function makeBeacon(scene) {
  const g = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.1, 1.1, 34, 12, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xffd94a, transparent: true, opacity: 0.32,
      side: THREE.DoubleSide, depthWrite: false,
    }),
  );
  beam.position.y = 17;
  g.add(beam);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1.6, 2.6, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd94a, transparent: true, opacity: 0.85, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.15;
  g.add(ring);
  scene.add(g);
  return g;
}

export class Missions {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world; // { player, traffic, vipers, police, effects, radio, hooks }
    this.mission = 0;
    this.stage = 0;
    this.cash = 0;
    this.wanted = 0;
    this.legs = { l1: false, l2: false, l3: false, l4: false };
    this.holdTime = 0;
    this.m4Active = false;
    this.m6GuardsSpawned = false;
    this.beacon = makeBeacon(scene);
    this.beaconTarget = { x: DISTRICTS.coupe.x, z: DISTRICTS.coupe.z };
    // Mission cars.
    this.m1Coupe = new Car('coupe', CAR_COLORS.coupe, 24, 26, Math.PI / 2);
    this.getawayCar = new Car('sedan', CAR_COLORS.getaway, -46, 8, 0);
    this.bossCoupe = new Car('coupe', CAR_COLORS.boss, 126, 48, Math.PI / 2);
    for (const c of [this.m1Coupe, this.getawayCar, this.bossCoupe]) {
      scene.add(c.group);
    }
    this.missionCars = [this.m1Coupe, this.getawayCar, this.bossCoupe];
  }

  get state() {
    return {
      mission: this.mission,
      stage: this.stage,
      cash: this.cash,
      wanted: this.wanted,
      beacon: this.beaconTarget,
      objective: this.objective(),
    };
  }

  objective() {
    switch (this.mission) {
      case 0: return this.stage === 0 ? 'Steal the coupe at the lot (24, 26)' : "Drive the coupe to Rico's Garage";
      case 1: return 'Lose the heat — drive the rectangle at |160|';
      case 2: return this.stage === 0 ? 'Walk to the pier (158, -40)' : 'Deliver to Coral Junction (78, 116)';
      case 3: return 'Take out the 3 Vipers at Marina East';
      case 4: return this.stage === 0 ? 'Hold E at the bank vault (-40, -80)' : "Steal the getaway car, reach the safehouse";
      case 5: return this.stage === 0 ? 'Steal the boss coupe at the marina' : "Drive the boss coupe to Rico's Garage";
      default: return 'Free roam — Solara Bay is yours';
    }
  }

  beaconFor() {
    switch (this.mission) {
      case 0: return this.stage === 0 ? { x: 24, z: 26 } : { x: -118, z: 116 };
      case 1: {
        if (!this.legs.l1) return { x: 0, z: 160 };
        if (!this.legs.l2) return { x: -160, z: 0 };
        if (!this.legs.l3) return { x: 0, z: -160 };
        return { x: 160, z: 0 };
      }
      case 2: return this.stage === 0 ? { x: 158, z: -40 } : { x: 78, z: 116 };
      case 3: return { x: 100, z: 36 };
      case 4: return this.stage === 0 ? { x: -40, z: -80 } : { x: 138, z: 76 };
      case 5: return this.stage === 0 ? { x: 126, z: 48 } : { x: -118, z: 116 };
      default: return null;
    }
  }

  saveProgress() {
    writeSave({
      mission: this.mission,
      cash: this.cash,
      x: this.world.player.x,
      z: this.world.player.z,
    });
  }

  completeMission(idx) {
    this.mission = idx + 1;
    this.cash = REWARDS[idx];
    this.stage = 0;
    this.world.radio.cash();
    this.saveProgress();
  }

  // Called when Marlo enters a car.
  onEnterCar(car) {
    if (this.mission === 0 && car === this.m1Coupe) this.stage = 1;
    if (this.mission === 5 && car === this.bossCoupe) this.stage = 1;
  }

  update(dt, eHeld) {
    const p = this.world.player;
    const px = p.inCar && p.car ? p.car.x : p.x;
    const pz = p.inCar && p.car ? p.car.z : p.z;
    const here = (x, z, r) => dist2D(px, pz, x, z) < r;

    // Re-deal a wrecked mission car so its mission stays completable.
    if (this.mission === 0 && this.m1Coupe.wrecked) this.m1Coupe.respawn(24, 26, Math.PI / 2);
    if (this.mission === 4 && this.getawayCar.wrecked) this.getawayCar.respawn(-46, 8, 0);
    if (this.mission === 5 && this.bossCoupe.wrecked) this.bossCoupe.respawn(126, 48, Math.PI / 2);

    switch (this.mission) {
      case 0: {
        if (this.stage === 1 && p.inCar && p.car === this.m1Coupe && here(-118, 116, 10)) {
          this.completeMission(0);
          this.wanted = 2;
        }
        break;
      }
      case 1: {
        if (p.inCar) {
          if (Math.abs(pz - 160) < 15 && px < 0) this.legs.l1 = true;
          if (Math.abs(px + 160) < 15 && pz < 0) this.legs.l2 = true;
          if (Math.abs(pz + 160) < 15 && px > 0) this.legs.l3 = true;
          if (Math.abs(px - 160) < 15 && pz > 0) this.legs.l4 = true;
          if (this.legs.l1 && this.legs.l2 && this.legs.l3 && this.legs.l4) {
            this.wanted = 0;
            this.completeMission(1);
          }
        }
        break;
      }
      case 2: {
        if (this.stage === 0) {
          if (!p.inCar && here(158, -40, 10)) {
            this.stage = 1;
            this.world.vipers.spawn(150, -32, 1, 4);
            this.world.vipers.spawn(166, -48, 1, 4);
          }
        } else if (here(78, 116, 10)) {
          this.world.vipers.clear();
          p.givePistol();
          this.completeMission(2);
          // M4: three Vipers wait at Marina East.
          this.world.vipers.spawn(100, 36, 3, 8);
          this.m4Active = true;
        }
        break;
      }
      case 3: {
        if (this.m4Active && this.world.vipers.count === 0) {
          this.m4Active = false;
          this.completeMission(3);
        }
        break;
      }
      case 4: {
        if (this.stage === 0) {
          // Vault hold: strictly inside 6 m, E held for 4 game-seconds.
          const d = dist2D(px, pz, -40, -80);
          if (!p.inCar && d < 6 && eHeld) {
            this.holdTime += dt;
            if (this.holdTime >= 4) {
              this.stage = 1;
              this.wanted = 3;
              this.holdTime = 0;
            }
          } else {
            this.holdTime = 0;
          }
        } else if (p.inCar && p.car === this.getawayCar && here(138, 76, 10)) {
          this.completeMission(4);
          // M6: two Viper guards at Marina East.
          this.world.vipers.spawn(100, 36, 2, 8);
          this.m6GuardsSpawned = true;
        }
        break;
      }
      case 5: {
        if (this.stage === 1 && p.inCar && p.car === this.bossCoupe && here(-118, 116, 10)) {
          this.mission = 6;
          this.cash = REWARDS[5];
          this.stage = 0;
          this.world.radio.cash();
          this.saveProgress();
          this.world.hooks.onWin();
        }
        break;
      }
      default:
        break;
    }

    // Beacon follows the current objective.
    const target = this.beaconFor();
    if (target) {
      this.beaconTarget = target;
      this.beacon.visible = true;
      this.beacon.position.set(target.x, 0, target.z);
      this.beacon.rotation.y += dt * 0.8;
    } else {
      this.beacon.visible = false;
    }
  }
}
