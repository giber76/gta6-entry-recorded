// missions.js — the five-job story chain for Marlo Vance and his fixer Rico Salas.
// A beacon marks the current objective; dialogue advances on ENTER or after 8 s.

import { LOCATIONS } from './city.js';
import { setWanted } from './police.js';
import { spawnEnemy, livingEnemies } from './combat.js';

export const MISSIONS = [
  {
    name: 'Wheels for Rico',
    reward: 500,
    brief: [
      'RICO: Marlo. I need wheels, clean ones. There is an orange coupe by the plaza.',
      'RICO: Take it and bring it to my garage on Harbor Road. Try not to get seen.',
    ],
  },
  {
    name: 'Lose the Heat',
    reward: 800,
    brief: [
      'RICO: That coupe was hot, Marlo. Cops are all over the bay now.',
      'RICO: Lay low. Stay out of sight until the stars die down.',
    ],
  },
  {
    name: 'The Package',
    reward: 1200,
    brief: [
      'RICO: A package is waiting at the end of the boardwalk pier. Walk in, grab it.',
      'RICO: No car on the pier, Marlo. Feet only. Then run it to Coral Junction.',
    ],
  },
  {
    name: 'Viper Nest',
    reward: 1500,
    brief: [
      'RICO: The Crimson Vipers took my corner on Marina East. Time to take it back.',
      'RICO: I left a pistol in your jacket. Put all three of them down.',
    ],
  },
  {
    name: 'The Big Score',
    reward: 3000,
    brief: [
      'RICO: Meridian Bank. In, grab the cash, out. Four seconds at the vault, no more.',
      'RICO: The whole bay will come down on you. Lose them at the boardwalk safehouse.',
    ],
  },
];

export function initMissions(G) {
  const THREE = window.THREE;
  // A fresh start reuses one marker: drop the old beacon first.
  if (G.marker) G.scene.remove(G.marker.group);
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xffd23c, transparent: true, opacity: 0.55 });
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 30, 20, 1, true), beaconMat);
  beacon.position.y = 15;
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
  const marker = new THREE.Group();
  marker.add(beacon);
  marker.add(ring);
  marker.add(diamond);
  marker.visible = false;
  G.scene.add(marker);
  G.marker = { group: marker, diamond, ring, beaconMat };

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

function setTarget(G, x, z, objective) {
  G.mission.target = { x, z };
  G.mission.objective = objective;
  G.marker.group.position.set(x, 0, z);
  G.marker.group.visible = true;
}

function clearTarget(G, objective) {
  G.mission.target = null;
  G.mission.objective = objective;
  G.marker.group.visible = false;
}

export function startMission(G, index) {
  const m = G.mission;
  m.index = index;
  m.stage = 0;
  m.holdT = 0;
  m.done = false;
  const L = LOCATIONS;
  const def = MISSIONS[index];
  if (!def) return;
  showDialogue(G, def.brief);
  if (index === 0) {
    setTarget(G, L.coupe.x, L.coupe.z, 'Steal the orange coupe by the plaza');
  } else if (index === 1) {
    setWanted(G, 2);
    clearTarget(G, 'Lose the heat — stay out of sight until the stars clear');
  } else if (index === 2) {
    setTarget(G, L.pier.x, L.pier.z, 'Walk to the boardwalk pier and pick up the package');
  } else if (index === 3) {
    G.player.hasPistol = true;
    G.player.weapon = 'pistol';
    const spots = [
      [L.marina.x - 6, L.marina.z - 4],
      [L.marina.x + 5, L.marina.z + 3],
      [L.marina.x + 2, L.marina.z - 9],
    ];
    for (const [x, z] of spots) spawnEnemy(G, x, z, 3);
    setTarget(G, L.marina.x, L.marina.z, 'Eliminate the 3 Crimson Vipers on Marina East');
  } else if (index === 4) {
    setTarget(G, L.bank.x, L.bank.z, 'Get to Meridian Bank and hold E at the vault');
  }
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

export function updateMissions(G, dt) {
  const m = G.mission;
  const p = G.player;
  const L = LOCATIONS;
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

  const distTo = (x, z) => Math.hypot(p.pos.x - x, p.pos.z - z);

  if (m.index === 0) {
    if (m.stage === 0) {
      if (p.inCar && p.car && p.car.mission) {
        m.stage = 1;
        setTarget(G, L.garage.x, L.garage.z, 'Drive the coupe to Rico\u2019s Garage on Harbor Road');
        showDialogue(G, ['RICO: Good. Now bring it home, nice and easy.']);
      }
    } else if (distTo(L.garage.x, L.garage.z) < 9 && p.inCar) {
      completeMission(G);
    }
  } else if (m.index === 1) {
    if (G.wanted === 0) completeMission(G);
  } else if (m.index === 2) {
    if (m.stage === 0) {
      const d = distTo(L.pier.x, L.pier.z);
      if (d < 6 && !p.inCar) {
        m.stage = 1;
        const spots = [
          [L.pier.x - 8, L.pier.z + 5],
          [L.pier.x - 4, L.pier.z - 7],
        ];
        for (const [x, z] of spots) spawnEnemy(G, x, z, 2);
        showDialogue(G, ['RICO: Ambush! Vipers on the pier — get that package out of there!']);
        if (G.hud) G.hud.toast('Package picked up — Vipers ambushed you!');
        if (G.audio) G.audio.pickup();
        setTarget(G, L.coral.x, L.coral.z, 'Deliver the package to Coral Junction');
      } else if (d < 10 && p.inCar) {
        G.mission.objective = 'Park the car and walk onto the pier';
      } else {
        G.mission.objective = 'Walk to the boardwalk pier and pick up the package';
      }
    } else if (distTo(L.coral.x, L.coral.z) < 9) {
      completeMission(G);
    }
  } else if (m.index === 3) {
    // Only the three Marina East vipers count; the pier ambush may still be alive.
    if (livingEnemies(G).filter((e) => e.missionTag === 3).length === 0) completeMission(G);
  } else if (m.index === 4) {
    if (m.stage === 0) {
      const d = distTo(L.bank.x, L.bank.z);
      if (d < 6 && !p.inCar) {
        if (G.keys.has('KeyE')) {
          m.holdT += dt;
          G.mission.objective = `Grabbing the cash… ${Math.ceil(4 - m.holdT)}s — keep holding E`;
          if (m.holdT >= 4) {
            m.stage = 1;
            m.holdT = 0;
            setWanted(G, 3);
            showDialogue(G, ['RICO: You got it! Now run — every cop in the bay is coming!']);
            setTarget(G, L.safehouse.x, L.safehouse.z, 'Escape to the boardwalk safehouse');
          }
        } else {
          m.holdT = Math.max(0, m.holdT - dt * 2);
          G.mission.objective = 'Hold E at the bank vault to grab the cash';
        }
      } else {
        G.mission.objective = 'Get to Meridian Bank and hold E at the vault';
      }
    } else if (distTo(L.safehouse.x, L.safehouse.z) < 9) {
      completeMission(G);
    }
  }
}
