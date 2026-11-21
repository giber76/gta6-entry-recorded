# Solara Bay

[![gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/giber76/gta6-entry-recorded/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/giber76/gta6-entry-recorded/reward.svg)](https://make.fun/bounty/gta6-01)

An open-world crime game in the spirit of GTA 6, built for the make.fun
gta6-01 bounty. Marlo is a driver in the coastal city of Solara Bay: six
story missions stand between him and $12,000 — steal the coupe, lose the
heat, run the package, survive the marina, crack the bank, and take the
boss's car.

## What is in the game

- A sun-soaked coastal city on a road grid: Rico's Garage, Coral Junction,
  Marina East, the pier, the bank and a safehouse, with an ocean along the
  east and south shore, palms, streetlights and traffic.
- On foot and by car: steal cars with E, drive with W/A/S/D, walk with W.
- Wanted level 0–3 with police who chase, ram and bust.
- Combat: a pistol (issued in M4), drive-by shooting from the car, Viper
  enemies who hold a standoff and strafe.
- A HUD with cash, health, wanted stars, the mission objective, a radio
  (3 generated stations, R to cycle) and a minimap (Z/X to zoom).
- Six missions (M1–M6) with a win screen, free roam after the win, and a
  localStorage save (`solara-bay-save-v1`).
- Sound: generated WebAudio radio loops, engine hum, gunshots, explosions.

## Play

```sh
node serve.ts            # serves game/ at http://localhost:8080/
```

Open http://localhost:8080/ in a desktop browser, click **NEW GAME**, and
play with keyboard + mouse. No network request: every script, texture and
sound is a file under `game/` or generated at run time.

## Tech

- Three.js (vendored under `game/vendor/`) renders the city; the game code
  is plain ES modules under `game/src/` (17 modules, one job each).
- `main.ts` hands the entry in: it copies `game/` + `screenshots/` to the
  output directory and writes `dossier.json` with the kit's `buildDossier`.
- Deterministic: one seeded RNG drives world generation.

## License

MIT — see LICENSE.
