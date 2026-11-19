// missions.js — Marlo Vance's six-job story chain, run for his fixer
// Rico Salas. A beacon marks the current objective; dialogue moves on
// ENTER or after 8 s on its own. Every job carries its own setup and
// its own finish rule. Six jobs, $12,000 in total.

import { LOCATIONS } from './city.js';
import { setWanted } from './police.js';
import { spawnEnemy, livingEnemies } from './combat.js';
import { createCar } from './vehicles.js';

// [name, reward, briefing line 1, briefing line 2]
const JOB_ROWS = [
  ['Wheels for Rico', 500,
    'RICO: Marlo. I need wheels, clean ones. There is an orange coupe by the plaza.',
    'RICO: Take it and bring it to my garage on Harbor Road. Try not to get seen.'],
  ['Lose the Heat', 800,
    'RICO: That coupe was hot, Marlo. Cops are all over the bay now.',
    'RICO: Lay low. Stay out of sight until the stars die down.'],
  ['The Package', 1200,
    'RICO: A package is waiting at the end of the boardwalk pier. Walk in, grab it.',
    'RICO: No car on the pier, Marlo. Feet only. Then run it to Coral Junction.'],
  ['Viper Nest', 1500,
    'RICO: The Crimson Vipers took my corner on Marina East. Time to take it back.',
    'RICO: I left a pistol in your jacket. Put all three of them down.'],
  ['The Big Score', 3000,
    'RICO: Meridian Bank. In, grab the cash, out. Four seconds at the vault, no more.',
    'RICO: The whole bay will come down on you. Lose them at the boardwalk safehouse.'],
  ['The Last Job', 5000,
    'RICO: One more, Marlo. The Viper boss keeps his black coupe on Marina East.',
    'RICO: Two guards on it. Take the coupe and bring it home. That is twelve grand total, Marlo.'],
];
export const MISSIONS = JOB_ROWS.map(([name, reward, line1, line2]) => ({
  name,
  reward,
  brief: [line1, line2],
}));

// One beacon (column + ground ring + spinning diamond) reused by every
// mission.
function buildBeacon(game) {
  const THREE = window.THREE;
  if (game.marker) game.scene.remove(game.marker.group);
  const glow = new THREE.MeshBasicMaterial({ color: 0xffd23c, transparent: true, opacity: 0.55 });
  const column = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 30, 20, 1, true), glow);
  column.position.y = 15;
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.2, 3, 28),
    new THREE.MeshBasicMaterial({ color: 0xffd23c, transparent: true, opacity: 0.85, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.25;
  const diamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.1),
    new THREE.MeshBasicMaterial({ color: 0xffd23c })
  );
  diamond.position.y = 8;
  const group = new THREE.Group();
  group.add(column);
  group.add(ring);
  group.add(diamond);
  group.visible = false;
  game.scene.add(group);
  return { group, diamond, ring, beaconMat: glow };
}

export function initMissions(game) {
  game.marker = buildBeacon(game);
  game.mission = {
    index: 0,
    stage: 0,
    target: null,
    objective: '',
    holdT: 0,
    done: false,
  };
  game.dialogue = { lines: [], index: 0, timer: 0, active: false };
  startMission(game, 0);
}

export function showDialogue(game, lines) {
  game.dialogue.lines = lines;
  game.dialogue.index = 0;
  game.dialogue.timer = 0;
  game.dialogue.active = true;
  if (game.hud) game.hud.setDialogue(lines[0]);
}

export function advanceDialogue(game) {
  const d = game.dialogue;
  if (!d.active) return;
  d.index += 1;
  d.timer = 0;
  if (d.index >= d.lines.length) {
    d.active = false;
    if (game.hud) game.hud.setDialogue('');
  } else if (game.hud) {
    game.hud.setDialogue(d.lines[d.index]);
  }
}

function setBeacon(game, x, z, objective) {
  game.mission.target = { x, z };
  game.mission.objective = objective;
  game.marker.group.position.set(x, 0, z);
  game.marker.group.visible = true;
}

function clearBeacon(game, objective) {
  game.mission.target = null;
  game.mission.objective = objective;
  game.marker.group.visible = false;
}

function distanceTo(p, x, z) {
  return Math.hypot(p.pos.x - x, p.pos.z - z);
}

// Spawn a Viper at each [x, z] offset pair, tagged for one mission.
function spawnVipers(game, spots, tag) {
  for (const [x, z] of spots) spawnEnemy(game, x, z, tag);
}

// The Viper boss's black coupe, parked on Marina East. A fresh one is
// dealt whenever the current one is wrecked, so the job stays winnable.
function dealBossCoupe(game) {
  const L = LOCATIONS;
  if (game.bossCoupe) {
    game.scene.remove(game.bossCoupe.group);
    game.parkedCars = (game.parkedCars || []).filter((c) => c !== game.bossCoupe);
  }
  const coupe = createCar(game, {
    x: L.bossCoupe.x,
    z: L.bossCoupe.z,
    heading: Math.PI / 2,
    color: 0x0a0a0a,
    parked: true,
  });
  coupe.mission = true;
  coupe.bossCoupe = true;
  game.bossCoupe = coupe;
  game.parkedCars.push(coupe);
  return coupe;
}

// --- one setup per job -------------------------------------------------------
// Each setup is a function taking game; the array index is the mission index.
const SETUPS = [
  // 1 — Wheels for Rico: steal the orange coupe by the plaza.
  (game) => {
    const L = LOCATIONS;
    setBeacon(game, L.coupe.x, L.coupe.z, 'Steal the orange coupe by the plaza');
  },
  // 2 — Lose the Heat: the coupe was hot; wanted jumps to 2.
  (game) => {
    setWanted(game, 2);
    clearBeacon(game, 'Lose the heat — stay out of sight until the stars clear');
  },
  // 3 — The Package: walk the pier on foot, pick it up, deliver to Coral Junction.
  (game) => {
    const L = LOCATIONS;
    setBeacon(game, L.pier.x, L.pier.z, 'Walk to the boardwalk pier and pick up the package');
  },
  // 4 — Viper Nest: pistol issued, three Vipers on Marina East.
  (game) => {
    const L = LOCATIONS;
    game.player.hasPistol = true;
    game.player.weapon = 'pistol';
    const nests = [
      [L.marina.x - 6, L.marina.z - 4],
      [L.marina.x + 5, L.marina.z + 3],
      [L.marina.x + 2, L.marina.z - 9],
    ];
    spawnVipers(game, nests, 3);
    setBeacon(game, L.marina.x, L.marina.z, 'Eliminate the 3 Crimson Vipers on Marina East');
  },
  // 5 — The Big Score: Meridian Bank vault, then run.
  (game) => {
    const L = LOCATIONS;
    setBeacon(game, L.bank.x, L.bank.z, 'Get to Meridian Bank and hold E at the vault');
  },
  // 6 — The Last Job: steal the boss's black coupe, two guards on it.
  (game) => {
    const L = LOCATIONS;
    dealBossCoupe(game);
    const guards = [
      [L.bossCoupe.x - 5, L.bossCoupe.z - 3],
      [L.bossCoupe.x + 4, L.bossCoupe.z + 5],
    ];
    spawnVipers(game, guards, 5);
    setBeacon(game, L.bossCoupe.x, L.bossCoupe.z, 'Steal the Viper boss\u2019s black coupe on Marina East');
  },
];

export function startMission(game, index) {
  const m = game.mission;
  m.index = index;
  m.stage = 0;
  m.holdT = 0;
  m.done = false;
  const def = MISSIONS[index];
  if (!def) return;
  showDialogue(game, def.brief);
  if (game.audio) game.audio.missionStart();
  SETUPS[index](game);
  if (game.hud) game.hud.setMission(def.name, index + 1, MISSIONS.length);
}

// The Package ambush stands down when the job is done: the pier Vipers
// leave instead of hunting Marlo for the rest of the game.
function clearAmbush(game) {
  for (const e of [...game.enemies]) {
    if (e.missionTag === 2 && !e.dead) {
      game.scene.remove(e.group);
      game.enemies = game.enemies.filter((x) => x !== e);
    }
  }
}

export function completeMission(game) {
  const def = MISSIONS[game.mission.index];
  game.player.cash += def.reward;
  if (game.audio) game.audio.cash();
  if (game.hud) {
    game.hud.toast(`${def.name} complete — $${def.reward.toLocaleString('en-US')}`);
    game.hud.setCash(game.player.cash);
  }
  if (game.saveGame) game.saveGame();
  if (game.mission.index === 2) clearAmbush(game);
  game.mission.done = true;
  const next = game.mission.index + 1;
  if (next >= MISSIONS.length) {
    game.state = 'won';
    if (game.audio) game.audio.win();
    if (game.onWin) game.onWin();
    return;
  }
  startMission(game, next);
}

// --- one finish rule per job -------------------------------------------------
// Each rule returns true when its job is done. Rules receive (game, dt).
const RULES = [
  // 1 — Wheels for Rico. Stage 0: steal the coupe (any mission coupe
  // will do). Stage 1: drive it to Rico's garage.
  (game) => {
    const m = game.mission;
    const p = game.player;
    const L = LOCATIONS;
    if (m.stage === 1) return distanceTo(p, L.garage.x, L.garage.z) < 9 && p.inCar;
    if (p.inCar && p.car && p.car.mission) {
      m.stage = 1;
      setBeacon(game, L.garage.x, L.garage.z, 'Drive the coupe to Rico\u2019s Garage on Harbor Road');
      showDialogue(game, ['RICO: Good. Now bring it home, nice and easy.']);
    }
    return false;
  },

  // 2 — Lose the Heat: done when the wanted level hits zero.
  (game) => game.wanted === 0,

  // 3 — The Package. Stage 0: walk onto the pier (on foot) to grab it —
  // two Vipers ambush. Stage 1: deliver to Coral Junction.
  (game) => {
    const m = game.mission;
    const p = game.player;
    const L = LOCATIONS;
    if (m.stage === 1) return distanceTo(p, L.coral.x, L.coral.z) < 9;
    const d = distanceTo(p, L.pier.x, L.pier.z);
    if (d < 6 && !p.inCar) {
      m.stage = 1;
      const ambush = [
        [L.pier.x - 8, L.pier.z + 5],
        [L.pier.x - 4, L.pier.z - 7],
      ];
      spawnVipers(game, ambush, 2);
      showDialogue(game, ['RICO: Ambush! Vipers on the pier — get that package out of there!']);
      if (game.hud) game.hud.toast('Package picked up — Vipers ambushed you!');
      if (game.audio) game.audio.pickup();
      setBeacon(game, L.coral.x, L.coral.z, 'Deliver the package to Coral Junction');
    } else if (d < 10 && p.inCar) {
      game.mission.objective = 'Park the car and walk onto the pier';
    } else {
      game.mission.objective = 'Walk to the boardwalk pier and pick up the package';
    }
    return false;
  },

  // 4 — Viper Nest: done when no living missionTag==3 enemy remains. The
  // pier ambush may still be alive; it does not count.
  (game) => livingEnemies(game).filter((e) => e.missionTag === 3).length === 0,

  // 5 — The Big Score. Stage 0: hold E for 4 s at the vault, on foot.
  // Stage 1: escape to the safehouse with wanted 3.
  (game, dt) => {
    const m = game.mission;
    const p = game.player;
    const L = LOCATIONS;
    if (m.stage === 1) return distanceTo(p, L.safehouse.x, L.safehouse.z) < 9;
    const d = distanceTo(p, L.bank.x, L.bank.z);
    if (d >= 6 || p.inCar) {
      game.mission.objective = 'Get to Meridian Bank and hold E at the vault';
      return false;
    }
    if (game.keys.has('KeyE')) {
      m.holdT += dt;
      game.mission.objective = `Grabbing the cash… ${Math.ceil(4 - m.holdT)}s — keep holding E`;
      if (m.holdT >= 4) {
        m.stage = 1;
        m.holdT = 0;
        setWanted(game, 3);
        showDialogue(game, ['RICO: You got it! Now run — every cop in the bay is coming!']);
        setBeacon(game, L.safehouse.x, L.safehouse.z, 'Escape to the boardwalk safehouse');
      }
    } else {
      m.holdT = Math.max(0, m.holdT - dt * 2);
      game.mission.objective = 'Hold E at the bank vault to grab the cash';
    }
    return false;
  },

  // 6 — The Last Job. Stage 0: steal the boss's black coupe. Stage 1:
  // drive it to Rico's garage. A wrecked coupe is re-dealt, so the job
  // can always be finished.
  (game) => {
    const m = game.mission;
    const p = game.player;
    const L = LOCATIONS;
    if (m.stage === 1) return distanceTo(p, L.garage.x, L.garage.z) < 9 && p.inCar;
    if (game.bossCoupe && game.bossCoupe.wrecked) {
      dealBossCoupe(game);
      if (game.hud) game.hud.toast('The boss coupe was wrecked — Rico got you another one');
      setBeacon(game, L.bossCoupe.x, L.bossCoupe.z, 'Steal the Viper boss\u2019s black coupe on Marina East');
      return false;
    }
    if (p.inCar && p.car && p.car.bossCoupe) {
      m.stage = 1;
      setBeacon(game, L.garage.x, L.garage.z, 'Drive the black coupe to Rico\u2019s Garage on Harbor Road');
      showDialogue(game, ['RICO: That is the boss\u2019s own ride. Bring it home, Marlo.']);
    }
    return false;
  },
];

function jobFinished(game, dt) {
  return RULES[game.mission.index](game, dt);
}

export function updateMissions(game, dt) {
  const m = game.mission;
  if (game.state !== 'playing' || m.done) return;

  // Dialogue auto-advances after 8 s.
  if (game.dialogue.active) {
    game.dialogue.timer += dt;
    if (game.dialogue.timer > 8) advanceDialogue(game);
  }

  // Beacon pulse.
  if (game.marker.group.visible) {
    const t = (game.elapsed ?? 0) * 2.2;
    game.marker.diamond.position.y = 8 + Math.sin(t) * 0.7;
    game.marker.diamond.rotation.y += dt * 1.5;
    const s = 1 + Math.sin(t) * 0.12;
    game.marker.ring.scale.set(s, s, 1);
  }

  if (jobFinished(game, dt)) completeMission(game);
}
