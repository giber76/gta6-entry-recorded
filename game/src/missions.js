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
function buildBeacon(G) {
  const THREE = window.THREE;
  if (G.marker) G.scene.remove(G.marker.group);
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
  G.scene.add(group);
  return { group, diamond, ring, beaconMat: glow };
}

export function initMissions(G) {
  G.marker = buildBeacon(G);
  G.mission = {
    index: 0,
    stage: 0,
    target: null,
    objective: '',
    holdT: 0,
    done: false,
  };
  G.dialogue = { lines: [], index: 0, timer: 0, active: false };
  startMission(G, 0);
}

export function showDialogue(G, lines) {
  G.dialogue.lines = lines;
  G.dialogue.index = 0;
  G.dialogue.timer = 0;
  G.dialogue.active = true;
  if (G.hud) G.hud.setDialogue(lines[0]);
}

export function advanceDialogue(G) {
  const d = G.dialogue;
  if (!d.active) return;
  d.index += 1;
  d.timer = 0;
  if (d.index >= d.lines.length) {
    d.active = false;
    if (G.hud) G.hud.setDialogue('');
  } else if (G.hud) {
    G.hud.setDialogue(d.lines[d.index]);
  }
}

function pointBeacon(G, x, z, objective) {
  G.mission.target = { x, z };
  G.mission.objective = objective;
  G.marker.group.position.set(x, 0, z);
  G.marker.group.visible = true;
}

function hideBeacon(G, objective) {
  G.mission.target = null;
  G.mission.objective = objective;
  G.marker.group.visible = false;
}

function howFar(p, x, z) {
  return Math.hypot(p.pos.x - x, p.pos.z - z);
}

// The Viper boss's black coupe, parked on Marina East. A fresh one is
// dealt whenever the current one is wrecked, so the job stays winnable.
function dealBossCoupe(G) {
  const L = LOCATIONS;
  if (G.bossCoupe) {
    G.scene.remove(G.bossCoupe.group);
    G.parkedCars = (G.parkedCars || []).filter((c) => c !== G.bossCoupe);
  }
  const coupe = createCar(G, {
    x: L.bossCoupe.x,
    z: L.bossCoupe.z,
    heading: Math.PI / 2,
    color: 0x0a0a0a,
    parked: true,
  });
  coupe.mission = true;
  coupe.bossCoupe = true;
  G.bossCoupe = coupe;
  G.parkedCars.push(coupe);
  return coupe;
}

// --- one setup per job -------------------------------------------------------
const SETUPS = {
  // 1 — Wheels for Rico: steal the orange coupe by the plaza.
  0(G) {
    const L = LOCATIONS;
    pointBeacon(G, L.coupe.x, L.coupe.z, 'Steal the orange coupe by the plaza');
  },
  // 2 — Lose the Heat: the coupe was hot; wanted jumps to 2.
  1(G) {
    setWanted(G, 2);
    hideBeacon(G, 'Lose the heat — stay out of sight until the stars clear');
  },
  // 3 — The Package: walk the pier on foot, pick it up, deliver to Coral Junction.
  2(G) {
    const L = LOCATIONS;
    pointBeacon(G, L.pier.x, L.pier.z, 'Walk to the boardwalk pier and pick up the package');
  },
  // 4 — Viper Nest: pistol issued, three Vipers on Marina East.
  3(G) {
    const L = LOCATIONS;
    G.player.hasPistol = true;
    G.player.weapon = 'pistol';
    const nests = [
      [L.marina.x - 6, L.marina.z - 4],
      [L.marina.x + 5, L.marina.z + 3],
      [L.marina.x + 2, L.marina.z - 9],
    ];
    for (const [x, z] of nests) spawnEnemy(G, x, z, 3);
    pointBeacon(G, L.marina.x, L.marina.z, 'Eliminate the 3 Crimson Vipers on Marina East');
  },
  // 5 — The Big Score: Meridian Bank vault, then run.
  4(G) {
    const L = LOCATIONS;
    pointBeacon(G, L.bank.x, L.bank.z, 'Get to Meridian Bank and hold E at the vault');
  },
  // 6 — The Last Job: steal the boss's black coupe, two guards on it.
  5(G) {
    const L = LOCATIONS;
    dealBossCoupe(G);
    const guards = [
      [L.bossCoupe.x - 5, L.bossCoupe.z - 3],
      [L.bossCoupe.x + 4, L.bossCoupe.z + 5],
    ];
    for (const [x, z] of guards) spawnEnemy(G, x, z, 5);
    pointBeacon(G, L.bossCoupe.x, L.bossCoupe.z, 'Steal the Viper boss\u2019s black coupe on Marina East');
  },
};

export function startMission(G, index) {
  const m = G.mission;
  m.index = index;
  m.stage = 0;
  m.holdT = 0;
  m.done = false;
  const def = MISSIONS[index];
  if (!def) return;
  showDialogue(G, def.brief);
  if (G.audio) G.audio.missionStart();
  SETUPS[index](G);
  if (G.hud) G.hud.setMission(def.name, index + 1, MISSIONS.length);
}

export function completeMission(G) {
  const def = MISSIONS[G.mission.index];
  G.player.cash += def.reward;
  if (G.audio) G.audio.cash();
  if (G.hud) {
    G.hud.toast(`${def.name} complete — $${def.reward.toLocaleString('en-US')}`);
    G.hud.setCash(G.player.cash);
  }
  if (G.saveGame) G.saveGame();
  // The Package ambush stands down when the job is done: the pier
  // Vipers leave instead of hunting Marlo for the rest of the game.
  if (G.mission.index === 2) {
    for (const e of [...G.enemies]) {
      if (e.missionTag === 2 && !e.dead) {
        G.scene.remove(e.group);
        G.enemies = G.enemies.filter((x) => x !== e);
      }
    }
  }
  G.mission.done = true;
  const next = G.mission.index + 1;
  if (next >= MISSIONS.length) {
    G.state = 'won';
    if (G.audio) G.audio.win();
    if (G.onWin) G.onWin();
    return;
  }
  startMission(G, next);
}

// --- one finish rule per job -------------------------------------------------
const RULES = {
  // 1 — Wheels for Rico. Stage 0: steal the coupe (any mission coupe
  // will do). Stage 1: drive it to Rico's garage.
  0(G) {
    const m = G.mission;
    const p = G.player;
    const L = LOCATIONS;
    if (m.stage === 1) return howFar(p, L.garage.x, L.garage.z) < 9 && p.inCar;
    if (p.inCar && p.car && p.car.mission) {
      m.stage = 1;
      pointBeacon(G, L.garage.x, L.garage.z, 'Drive the coupe to Rico\u2019s Garage on Harbor Road');
      showDialogue(G, ['RICO: Good. Now bring it home, nice and easy.']);
    }
    return false;
  },

  // 2 — Lose the Heat: done when the wanted level hits zero.
  1(G) {
    return G.wanted === 0;
  },

  // 3 — The Package. Stage 0: walk onto the pier (on foot) to grab it —
  // two Vipers ambush. Stage 1: deliver to Coral Junction.
  2(G) {
    const m = G.mission;
    const p = G.player;
    const L = LOCATIONS;
    if (m.stage === 1) return howFar(p, L.coral.x, L.coral.z) < 9;
    const d = howFar(p, L.pier.x, L.pier.z);
    if (d < 6 && !p.inCar) {
      m.stage = 1;
      const ambush = [
        [L.pier.x - 8, L.pier.z + 5],
        [L.pier.x - 4, L.pier.z - 7],
      ];
      for (const [x, z] of ambush) spawnEnemy(G, x, z, 2);
      showDialogue(G, ['RICO: Ambush! Vipers on the pier — get that package out of there!']);
      if (G.hud) G.hud.toast('Package picked up — Vipers ambushed you!');
      if (G.audio) G.audio.pickup();
      pointBeacon(G, L.coral.x, L.coral.z, 'Deliver the package to Coral Junction');
    } else if (d < 10 && p.inCar) {
      G.mission.objective = 'Park the car and walk onto the pier';
    } else {
      G.mission.objective = 'Walk to the boardwalk pier and pick up the package';
    }
    return false;
  },

  // 4 — Viper Nest: done when no living missionTag==3 enemy remains. The
  // pier ambush may still be alive; it does not count.
  3(G) {
    return livingEnemies(G).filter((e) => e.missionTag === 3).length === 0;
  },

  // 5 — The Big Score. Stage 0: hold E for 4 s at the vault, on foot.
  // Stage 1: escape to the safehouse with wanted 3.
  4(G, dt) {
    const m = G.mission;
    const p = G.player;
    const L = LOCATIONS;
    if (m.stage === 1) return howFar(p, L.safehouse.x, L.safehouse.z) < 9;
    const d = howFar(p, L.bank.x, L.bank.z);
    if (d >= 6 || p.inCar) {
      G.mission.objective = 'Get to Meridian Bank and hold E at the vault';
      return false;
    }
    if (G.keys.has('KeyE')) {
      m.holdT += dt;
      G.mission.objective = `Grabbing the cash… ${Math.ceil(4 - m.holdT)}s — keep holding E`;
      if (m.holdT >= 4) {
        m.stage = 1;
        m.holdT = 0;
        setWanted(G, 3);
        showDialogue(G, ['RICO: You got it! Now run — every cop in the bay is coming!']);
        pointBeacon(G, L.safehouse.x, L.safehouse.z, 'Escape to the boardwalk safehouse');
      }
    } else {
      m.holdT = Math.max(0, m.holdT - dt * 2);
      G.mission.objective = 'Hold E at the bank vault to grab the cash';
    }
    return false;
  },

  // 6 — The Last Job. Stage 0: steal the boss's black coupe. Stage 1:
  // drive it to Rico's garage. A wrecked coupe is re-dealt, so the job
  // can always be finished.
  5(G) {
    const m = G.mission;
    const p = G.player;
    const L = LOCATIONS;
    if (m.stage === 1) return howFar(p, L.garage.x, L.garage.z) < 9 && p.inCar;
    if (G.bossCoupe && G.bossCoupe.wrecked) {
      dealBossCoupe(G);
      if (G.hud) G.hud.toast('The boss coupe was wrecked — Rico got you another one');
      pointBeacon(G, L.bossCoupe.x, L.bossCoupe.z, 'Steal the Viper boss\u2019s black coupe on Marina East');
      return false;
    }
    if (p.inCar && p.car && p.car.bossCoupe) {
      m.stage = 1;
      pointBeacon(G, L.garage.x, L.garage.z, 'Drive the black coupe to Rico\u2019s Garage on Harbor Road');
      showDialogue(G, ['RICO: That is the boss\u2019s own ride. Bring it home, Marlo.']);
    }
    return false;
  },
};

function jobFinished(G, dt) {
  return RULES[G.mission.index](G, dt);
}

export function updateMissions(G, dt) {
  const m = G.mission;
  if (G.state !== 'playing' || m.done) return;

  // Dialogue auto-advances after 8 s.
  if (G.dialogue.active) {
    G.dialogue.timer += dt;
    if (G.dialogue.timer > 8) advanceDialogue(G);
  }

  // Beacon pulse.
  if (G.marker.group.visible) {
    const t = (G.elapsed ?? 0) * 2.2;
    G.marker.diamond.position.y = 8 + Math.sin(t) * 0.7;
    G.marker.diamond.rotation.y += dt * 1.5;
    const s = 1 + Math.sin(t) * 0.12;
    G.marker.ring.scale.set(s, s, 1);
  }

  if (jobFinished(G, dt)) completeMission(G);
}
