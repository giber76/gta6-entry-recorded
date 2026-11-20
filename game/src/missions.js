// missions.js — the six story missions (M1–M6) for Solara Bay.
// Cash is cumulative; `mission` is the NEXT mission index (0 = M1 pending).
// `stage` is 0 until the mission's key trigger, then 1. Every coordinate
// and reward here is exact — the play-test asserts them.

import { Car } from './vehicles.js';
import { dist2d } from './util.js';

export const REWARDS = [500, 1300, 2500, 4000, 7000, 12000];
const ARRIVE_DIST = 12;
const AMBUSH_DIST = 12;
const VAULT_DIST = 6; // strict: exactly 6.0 m does NOT trigger
const HOLD_SECONDS = 4;

const M4_SPAWNS = [
  { x: 112, z: 28 },
  { x: 116, z: 44 },
  { x: 104, z: 48 },
];
const M3_SPAWNS = [
  { x: 150, z: -32 },
  { x: 164, z: -48 },
];
const M6_SPAWNS = [
  { x: 120, z: 44 },
  { x: 132, z: 52 },
];

export function createMissions(world) {
  const missions = {
    legs: { w: false, n: false, e: false, s: false },
    m5hold: 0,
    m1Coupe: null,
    getawayCar: null,
    bossCoupe: null,
  };
  const kp = world.keyPoints;

  function setBeacon(x, z, visible) {
    if (!world.beacon) return;
    world.beacon.visible = visible !== false;
    world.beacon.position.set(x, 0, z);
  }

  function updateBeacon() {
    if (world.state === 'won') {
      setBeacon(0, 0, false);
      return;
    }
    const m = world.mission;
    const s = world.stage;
    if (m === 0) setBeacon(s === 0 ? kp.m1Coupe.x : kp.garage.x, s === 0 ? kp.m1Coupe.z : kp.garage.z);
    else if (m === 1) {
      if (!missions.legs.w) setBeacon(-160, 160);
      else if (!missions.legs.n) setBeacon(-160, -160);
      else if (!missions.legs.e) setBeacon(160, -160);
      else setBeacon(160, 160);
    } else if (m === 2) setBeacon(s === 0 ? kp.pier.x : kp.coralJunction.x, s === 0 ? kp.pier.z : kp.coralJunction.z);
    else if (m === 3) setBeacon(kp.marina.x, kp.marina.z);
    else if (m === 4) setBeacon(s === 0 ? kp.bank.x : kp.safehouse.x, s === 0 ? kp.bank.z : kp.safehouse.z);
    else if (m === 5) setBeacon(s === 0 ? kp.bossCoupe.x : kp.garage.x, s === 0 ? kp.bossCoupe.z : kp.garage.z);
  }

  function completeMission(nextMission, cash) {
    world.mission = nextMission;
    world.cash = cash;
    world.stage = 0;
    world.audio.pickup();
    world.save.write();
    updateBeacon();
  }

  function spawnM4Vipers() {
    for (const s of M4_SPAWNS) world.combat.spawnViper(s.x, s.z, 'm4');
  }

  function spawnM6() {
    for (const s of M6_SPAWNS) world.combat.spawnViper(s.x, s.z, 'm6');
    const boss = new Car(world, {
      x: kp.bossCoupe.x,
      z: kp.bossCoupe.z,
      heading: Math.PI / 2,
      kind: 'mission',
      label: 'boss-coupe',
      color: 0x111111,
      respawnDelay: 8,
    });
    boss.respawnAt = { x: kp.bossCoupe.x, z: kp.bossCoupe.z, heading: Math.PI / 2, color: 0x111111 };
    world.cars.push(boss);
    missions.bossCoupe = boss;
  }

  missions.init = function () {
    // The M1 coupe and the getaway car exist from the start.
    const coupe = new Car(world, {
      x: kp.m1Coupe.x,
      z: kp.m1Coupe.z,
      heading: 0.4,
      kind: 'mission',
      label: 'm1-coupe',
      color: 0xc23b2e,
      respawnDelay: 8,
    });
    coupe.respawnAt = { x: kp.m1Coupe.x, z: kp.m1Coupe.z, heading: 0.4, color: 0xc23b2e };
    world.cars.push(coupe);
    missions.m1Coupe = coupe;

    const getaway = new Car(world, {
      x: kp.getawayCar.x,
      z: kp.getawayCar.z,
      heading: 0,
      kind: 'mission',
      label: 'getaway',
      color: 0x2e6fc2,
      respawnDelay: 8,
    });
    getaway.respawnAt = { x: kp.getawayCar.x, z: kp.getawayCar.z, heading: 0, color: 0x2e6fc2 };
    world.cars.push(getaway);
    missions.getawayCar = getaway;
    updateBeacon();
  };

  missions.reset = function () {
    world.combat.clearVipers();
    if (missions.bossCoupe) {
      missions.bossCoupe.wrecked = true;
      missions.bossCoupe.mesh.visible = false;
      world.cars = world.cars.filter((c) => c !== missions.bossCoupe);
      missions.bossCoupe = null;
    }
    for (const car of [missions.m1Coupe, missions.getawayCar]) {
      if (!car) continue;
      car.wrecked = false;
      car.health = 100;
      car.mesh.visible = true;
      car.respawn();
    }
    missions.legs = { w: false, n: false, e: false, s: false };
    missions.m5hold = 0;
    world.mission = 0;
    world.stage = 0;
    world.cash = 0;
    world.wanted = 0;
    world.elapsed = 0;
    world.player.place(0, 20, 0);
    world.player.health = 100;
    world.player.hasPistol = false;
    world.player.weapon = null;
    world.police.clearPatrol();
    updateBeacon();
  };

  // Called when Marlo enters any car.
  missions.onEnterCar = function (car) {
    if (world.mission === 0 && car.label === 'm1-coupe') {
      world.stage = 1;
      updateBeacon();
    } else if (world.mission === 5 && car.label === 'boss-coupe') {
      world.stage = 1;
      updateBeacon();
    }
  };

  // Called when a Viper goes down.
  missions.onViperDown = function (viper) {
    if (world.mission !== 3 || viper.role !== 'm4') return;
    const left = world.vipers.filter((v) => v.alive && v.role === 'm4').length;
    if (left === 0) {
      completeMission(4, REWARDS[3]);
    }
  };

  missions.update = function (dt) {
    if (world.state !== 'playing') return;
    const p = world.player;
    const m = world.mission;

    if (m === 0) {
      // M1: drive the coupe to Rico's Garage.
      if (world.stage === 1 && dist2d(p.x, p.z, kp.garage.x, kp.garage.z) < ARRIVE_DIST) {
        completeMission(1, REWARDS[0]);
        world.wanted = 2;
      }
    } else if (m === 1) {
      // M2: cover the rectangle at |coord| = 160, then the heat drops.
      if (p.z > 145 && p.x < -100) missions.legs.w = true;
      if (p.x < -145 && p.z < -100) missions.legs.n = true;
      if (p.z < -145 && p.x > 100) missions.legs.e = true;
      if (p.x > 145 && p.z > 100) missions.legs.s = true;
      const l = missions.legs;
      if (l.w && l.n && l.e && l.s) {
        world.wanted = 0;
        world.police.clearPatrol();
        completeMission(2, REWARDS[1]);
      }
    } else if (m === 2) {
      // M3: walk to the pier — the ambush spawns — then deliver.
      if (world.stage === 0 && dist2d(p.x, p.z, kp.pier.x, kp.pier.z) < AMBUSH_DIST) {
        world.stage = 1;
        for (const s of M3_SPAWNS) world.combat.spawnViper(s.x, s.z, 'm3');
        updateBeacon();
      } else if (
        world.stage === 1 &&
        dist2d(p.x, p.z, kp.coralJunction.x, kp.coralJunction.z) < ARRIVE_DIST
      ) {
        world.combat.clearVipers('m3');
        p.hasPistol = true;
        p.weapon = 'pistol';
        completeMission(3, REWARDS[2]);
        spawnM4Vipers();
      }
    } else if (m === 3) {
      // M4 completes in onViperDown when the last Viper falls.
    } else if (m === 4) {
      // M5: hold E within 6 m of the vault for 4 game-seconds.
      if (world.stage === 0) {
        const d = dist2d(p.x, p.z, kp.vault.x, kp.vault.z);
        if (d < VAULT_DIST && world.input.held('KeyE') && !p.inCar) {
          missions.m5hold += dt;
          if (missions.m5hold >= HOLD_SECONDS) {
            world.stage = 1;
            world.wanted = 3;
            updateBeacon();
          }
        } else {
          missions.m5hold = 0;
        }
      } else if (dist2d(p.x, p.z, kp.safehouse.x, kp.safehouse.z) < ARRIVE_DIST) {
        world.wanted = 0;
        world.police.clearPatrol();
        completeMission(5, REWARDS[4]);
        spawnM6();
      }
    } else if (m === 5) {
      // M6: deliver the boss coupe to Rico's Garage.
      if (world.stage === 1 && dist2d(p.x, p.z, kp.garage.x, kp.garage.z) < ARRIVE_DIST) {
        world.cash = REWARDS[5];
        world.stage = 0;
        world.save.write();
        world.setState('won');
        setBeacon(0, 0, false);
      }
    }
  };

  missions.objectiveText = function () {
    const m = world.mission;
    const s = world.stage;
    if (world.state === 'won') return 'Solara Bay complete — $12,000. Free roam!';
    if (m === 0) return s === 0 ? 'M1: Steal the coupe at (24, 26)' : 'M1: Deliver the coupe to Rico\'s Garage';
    if (m === 1) return 'M2: Lose the heat — drive the outer ring';
    if (m === 2) return s === 0 ? 'M3: Walk to the pier' : 'M3: Deliver the package to Coral Junction';
    if (m === 3) return 'M4: Clear the Vipers at Marina East';
    if (m === 4) return s === 0 ? 'M5: Hold E at the bank vault' : 'M5: Escape to the safehouse';
    if (m === 5) return s === 0 ? 'M6: Steal the boss coupe at Marina East' : 'M6: Deliver it to Rico\'s Garage';
    return '';
  };

  world.missions = missions;
  return missions;
}
