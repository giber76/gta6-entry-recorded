# Solara Bay — Make GTA 6

[![Make GTA 6](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/giber76/gta6-entry-recorded/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/giber76/gta6-entry-recorded/reward.svg)](https://make.fun/bounty/gta6-01)

**Solara Bay** is a complete open-world crime game in the spirit of GTA 6,
built from scratch for the [gta6-01 bounty](https://make.fun/bounty/gta6-01).
Marlo, a driver in a sun-soaked coastal city, needs $12,000 and one last
clean getaway. Six story missions, then free roam.

## The game

- **A living city** — a 400 m coastal grid with lit-window towers, palm-lined
  beaches, a marina, a pier, streetlights and crosswalks, all under a warm
  sunset haze. Traffic drives the roads, pedestrians walk the sidewalks,
  and the ocean laps the east and south coasts.
- **Driving & stealing** — arcade handling (top speed ~166 km/h), enter any
  car with E, damage, smoke, fire and explosions, wrecks that eject the
  driver and scatter the crowd.
- **Wanted & police** — a 0–3 star heat system. Cruisers patrol, chase,
  ram, and flash their light bars; lose them by driving the city's outer
  ring, or get caught on foot and it's over.
- **Combat** — a pistol (issued in M4) with drive-by shooting from the car,
  raycast hits, muzzle flash, and Viper gunmen who hold a standoff, strafe,
  and shoot back.
- **Missions M1–M6** — steal the coupe, lose the heat, run the package,
  survive the Marina Showdown, rob the Solara Bank vault (hold E), and take
  the boss's black coupe home. Cash: $500 → $1,300 → $2,500 → $4,000 →
  $7,000 → $12,000.
- **HUD & minimap** — cash, wanted stars, health, mission objective, speed,
  a three-station generated radio (R: SOLARA FM, BAY 97.5, VICE 101), and a
  zoomable minimap (Z / X) that shows the ocean, the police, and the mission
  beacon.
- **Save** — progress is written to localStorage; after the win, free roam
  keeps the city open.

## Controls

| Key | Action |
| --- | --- |
| W A S D | Drive / walk (A/D steer, mouse drag orbits the camera) |
| E | Enter / exit a car · hold E at the bank vault |
| Click | Shoot the pistol |
| R | Cycle radio stations |
| Z / X | Minimap zoom in / out |
| Esc | Pause / resume |

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

The game is plain static files under `game/` (Three.js r160 vendored as
`game/vendor/three.module.min.js`) — no build step, no network requests.

## Tech

- `game/src/` — 17 modules, one job each: `city`, `vehicles`, `player`,
  `traffic`, `pedestrians`, `police`, `combat`, `effects`, `audio`, `hud`,
  `minimap`, `missions`, `input`, `save`, `debug`, `main`, `util`.
- `main.ts` — the entry program: copies `game/` + `screenshots/` to
  `/output` and writes `dossier.json` with the kit's `buildDossier`.
- Deterministic world generation from a fixed seed; an automated
  play-test (`playtest_solara.py`, 32 checks) drives the whole story
  through `window.__solara`.

## License

MIT — see [LICENSE](LICENSE).
