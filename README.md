# Solara Bay

[![gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=badge&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/giber76/gta6-entry-recorded/rank.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=badge&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/giber76/gta6-entry-recorded/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=badge&utm_campaign=gta6-01)

A GTA-style 3D open-world game built on Three.js (vendored in `game/vendor/`).
You are Marlo, a driver in the coastal city of Solara Bay. Six story missions
stand between you and the $12,000 take — then free roam.

## The story

1. **M1 — The First Coupe ($500).** Steal the coupe at (24, 26) and deliver
   it to Rico's Garage.
2. **M2 — Lose the Heat ($1,300).** Wanted level 2. Drive the outer ring
   (|coord| = 160) until the heat drops.
3. **M3 — The Package ($2,500).** Walk to the pier, survive the Viper
   ambush, deliver to Coral Junction.
4. **M4 — Marina Showdown ($4,000).** Pistol issued. Clear the 3 Vipers
   holding Marina East.
5. **M5 — The Bank Job ($7,000).** Hold E at the bank vault, steal the
   getaway car, escape to the safehouse.
6. **M6 — The Last Job ($12,000).** Lift the boss's black coupe from Marina
   East, past its two guards, and bring it home to Rico's Garage.

## Controls

- **W A S D** — walk / drive (W accelerates, S brakes, A/D steer)
- **E** — enter / exit a car; hold E at the bank vault to crack it
- **Mouse click** — fire the pistol (drive-by from the driver's seat)
- **R** — cycle radio: SOLARA FM → BAY 97.5 → VICE 101
- **Z / X** — minimap zoom in / out (1x / 2x / 4x)
- **Esc** — pause / resume

## Systems

- **Cars** — 100 health each; smoke under 50, burn under 25, wreck with a
  full explosion (fireball, smoke, sparks, light flash, camera shake) at 0.
  Wrecked traffic respawns after 8 s; the boss coupe re-deals if wrecked.
- **Police** — patrol cars chase while wanted > 0, ram for damage, and bust
  Marlo only if they pin him down while he is barely moving.
- **Radio** — three generated WebAudio stations, 16-step bass + lead + hats,
  no audio files.
- **Minimap** — sea, city, roads, buildings, cars, police, Vipers and the
  mission beacon, centred on Marlo.
- **Determinism** — a seeded RNG drives world generation, so two runs build
  the same city.

## Run it

```sh
# serve the game/ directory (any static server works)
npx tsx serve.ts 8080
# then open http://localhost:8080/
```

## Play-test

The acceptance test drives the whole game through the `window.__solara`
debug API and must pass 32/32:

```sh
~/workspace/makefun/pw-venv/bin/python ~/workspace/makefun/playtest_solara.py http://localhost:8080/ /tmp/playtest_solara_v4.json
```

## Layout

- `game/index.html` — page shell, canvas, HUD, menu / win / busted overlays
- `game/src/main.js` — bootstrap + game loop + follow camera
- `game/src/city.js` — world geometry (ground texture, ocean, buildings)
- `game/src/player.js` — Marlo on foot
- `game/src/vehicles.js` — car physics, damage, wrecks
- `game/src/traffic.js` — road traffic + parked cars
- `game/src/pedestrians.js` — sidewalk walkers
- `game/src/police.js` — pursuit, rams, busts
- `game/src/combat.js` — pistol raycast + Viper enemies
- `game/src/missions.js` — M1–M6 logic
- `game/src/effects.js` — explosions, smoke, muzzle flash, shake
- `game/src/audio.js` — generated radio + sound effects
- `game/src/hud.js` — HUD (cash, wanted, health, radio, objective)
- `game/src/minimap.js` — corner minimap
- `game/src/save.js` — localStorage saves (`solara-bay-save-v1`)
- `game/src/debug.js` — `window.__solara` debug API
- `game/src/input.js` — keyboard / mouse state
- `game/src/util.js` — seeded RNG + math helpers
- `game/vendor/three.min.js` — vendored Three.js
- `main.ts` — typed entrypoint · `serve.ts` — dev server

## License

MIT — see `LICENSE`.
