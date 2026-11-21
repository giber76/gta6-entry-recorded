// missions.js — the six story missions M1–M6, exact coordinates and rewards.
// mission = index of the NEXT mission (0 = M1 not started ... 5 = M6 in
// progress, 6 = all done). Cash is cumulative: 500 / 1300 / 2500 / 4000 /
// 7000 / 12000.
import { spawnViper, enemiesAlive } from './combat.js';
import { setBeacon } from './city.js';
import { writeSave } from './save.js';
import { dist2 } from './util.js';

const GARAGE = { x: -118, z: 116 };
const COUPE = { x: 24, z: 26 };
const PIER = { x: 158, z: -40 };
const CORAL = { x: 78, z: 116 };
const MARINA = { x: 100, z: 36 };
const VAULT = { x: -40, z: -80 };
const GETAWAY = { x: -46, z: 8 };
const SAFEHOUSE = { x: 138, z: 76 };
const BOSS = { x: 126, z: 48 };

export function initMissions(G) {
  G.mission = 0;
  G.stage = 0;
  G.cash = 0;
  G.wanted = 0;
  G.m2Edges = { s: false, w: false, n: false, e: false };
  G.m4Spawned = false;
  G.vaultHold = 0;
  G.toastTimer = 0;
  setBeacon(G, COUPE.x, COUPE.z);
}

export function missionText(G) {
  switch (G.mission) {
    case 0:
      return G.stage === 0
        ? ['M1 — THE FIRST COUPE', 'Steal the coupe at the corner. Press E to get in.']
        : ['M1 — THE FIRST COUPE', 'Drive the coupe to Rico\'s Garage.'];
    case 1:
      return ['M2 — LOSE THE HEAT', 'Wanted: 2 stars. Drive the rectangle at the city edge to lose them.'];
    case 2:
      return G.stage === 0
        ? ['M3 — THE PACKAGE', 'On foot to the pier. Pick up the package.']
        : ['M3 — THE PACKAGE', 'Deliver the package to Coral Junction.'];
    case 3:
      return ['M4 — MARINA SHOWDOWN', 'Take down the 3 Vipers at Marina East.'];
    case 4:
      return G.stage === 0
        ? ['M5 — THE BANK JOB', 'Get to the bank vault. Hold E to crack it.']
        : ['M5 — THE BANK JOB', 'Steal the getaway car and reach the safehouse.'];
    case 5:
      return G.stage === 0
        ? ['M6 — THE LAST JOB', 'Steal the boss\'s black coupe at the marina.']
        : ['M6 — THE LAST JOB', 'Drive the boss coupe to Rico\'s Garage.'];
    default:
      return ['SOLARA BAY', 'All jobs done. The city is yours — free roam.'];
  }
}

function completeMission(G, nextMission, cash, wanted) {
  G.mission = nextMission;
  G.cash = cash;
  if (wanted !== undefined) G.wanted = wanted;
  G.stage = 0;
  G.toast = `+$${cash.toLocaleString()}`;
  G.toastTimer = 3;
  writeSave(G);
}

function despawnAmbush(G) {
  for (let i = G.enemies.length - 1; i >= 0; i--) {
    const e = G.enemies[i];
    if (e.kind === 'ambush') {
      G.scene.remove(e.mesh);
      G.enemies.splice(i, 1);
    }
  }
}

export function updateMissions(G, dt, input) {
  const p = G.player;
  switch (G.mission) {
    case 0: {
      // M1: enter the coupe -> stage 1; drive it to the garage.
      if (G.stage === 0 && p.inCar && p.car && p.car.name === 'm1-coupe') {
        G.stage = 1;
        setBeacon(G, GARAGE.x, GARAGE.z);
      }
      if (G.stage === 1 && p.inCar && p.car && p.car.name === 'm1-coupe'
        && dist2(p.x, p.z, GARAGE.x, GARAGE.z) < 10) {
        completeMission(G, 1, 500, 2);
        setBeacon(G, 160, 160);
      }
      break;
    }
    case 1: {
      // M2: drive the rectangle at |coord| = 160. Each edge is marked when
      // the player travels along it to the far end.
      const e = G.m2Edges;
      if (Math.abs(p.z - 160) < 18 && p.x < -140) e.s = true;
      if (Math.abs(p.x + 160) < 18 && p.z < -140) e.w = true;
      if (Math.abs(p.z + 160) < 18 && p.x > 140) e.n = true;
      if (Math.abs(p.x - 160) < 18 && p.z > 140) e.e = true;
      if (e.s && e.w && e.n && e.e) {
        completeMission(G, 2, 1300, 0);
        setBeacon(G, PIER.x, PIER.z);
      }
      break;
    }
    case 2: {
      // M3: reach the pier -> ambush (2 Vipers); deliver to Coral Junction.
      if (G.stage === 0 && dist2(p.x, p.z, PIER.x, PIER.z) < 8) {
        G.stage = 1;
        spawnViper(G, PIER.x - 6, PIER.z - 4, 'ambush');
        spawnViper(G, PIER.x + 4, PIER.z + 6, 'ambush');
        setBeacon(G, CORAL.x, CORAL.z);
      }
      if (G.stage === 1 && dist2(p.x, p.z, CORAL.x, CORAL.z) < 10) {
        despawnAmbush(G);
        completeMission(G, 3, 2500, 0);
        // M4 begins: pistol issued, 3 Vipers wait at Marina East.
        p.hasPistol = true;
        p.weapon = 'pistol';
        spawnViper(G, MARINA.x - 8, MARINA.z - 6, 'viper');
        spawnViper(G, MARINA.x + 6, MARINA.z + 4, 'viper');
        spawnViper(G, MARINA.x + 2, MARINA.z - 10, 'viper');
        G.m4Spawned = true;
        setBeacon(G, MARINA.x, MARINA.z);
      }
      break;
    }
    case 3: {
      // M4: all 3 Vipers down -> M5.
      if (G.m4Spawned && enemiesAlive(G) === 0) {
        completeMission(G, 4, 4000, 0);
        setBeacon(G, VAULT.x, VAULT.z);
      }
      break;
    }
    case 4: {
      // M5: hold E within 6 m of the vault for 4 game-s (strictly under 6 m:
      // exactly 6.0 m must NOT trigger). Then steal the getaway car and
      // escape to the safehouse.
      if (G.stage === 0) {
        const d = dist2(p.x, p.z, VAULT.x, VAULT.z);
        if (d < 6.0 && input.e) {
          G.vaultHold += dt;
          if (G.vaultHold >= 4) {
            G.stage = 1;
            G.wanted = 3;
            G.vaultHold = 0;
            setBeacon(G, GETAWAY.x, GETAWAY.z);
          }
        } else {
          G.vaultHold = 0;
        }
      } else if (p.inCar && p.car && p.car.name === 'getaway'
        && dist2(p.x, p.z, SAFEHOUSE.x, SAFEHOUSE.z) < 10) {
        completeMission(G, 5, 7000, 0);
        // M6 begins: two Viper guards at Marina East.
        spawnViper(G, 118, 40, 'guard');
        spawnViper(G, 132, 56, 'guard');
        setBeacon(G, BOSS.x, BOSS.z);
      }
      break;
    }
    case 5: {
      // M6: steal the boss coupe -> stage 1; drive it to the garage -> win.
      if (G.stage === 0 && p.inCar && p.car && p.car.name === 'boss-coupe') {
        G.stage = 1;
        setBeacon(G, GARAGE.x, GARAGE.z);
      }
      if (G.stage === 1 && p.inCar && p.car && p.car.name === 'boss-coupe'
        && dist2(p.x, p.z, GARAGE.x, GARAGE.z) < 10) {
        G.mission = 6;
        G.cash = 12000;
        G.stage = 0;
        G.state = 'won';
        writeSave(G);
      }
      break;
    }
    default:
      break;
  }
  if (G.toastTimer > 0) G.toastTimer -= dt;
}
