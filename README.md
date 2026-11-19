# Solara Bay

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun)
[![rank](https://make.fun/badge/gta6-01/giber76/gta6-entry-recorded/rank.svg)](https://make.fun)
[![reward](https://make.fun/badge/gta6-01/giber76/gta6-entry-recorded/reward.svg)](https://make.fun)

An original open-world crime game in the spirit of GTA 6, built for the
[make.fun](https://make.fun) gta6-01 bounty. You play Marlo Vance, a
driver-for-hire in a sun-soaked fictional coastal city, running six jobs
for your fixer Rico Salas. Six jobs, $12,000 in total — the last one lifts
the Viper boss's own black coupe.

## What the game has

- **A city to explore**: a seeded road grid — buildings, a plaza, a beach
  and the ocean, palms, traffic and pedestrians — on foot or behind the
  wheel.
- **Steal and drive**: arcade driving with a handbrake. Taking a car only
  draws the law if someone sees you do it.
- **Car damage**: every car has 100 health. Building hits, traffic bumps
  and police rams deal damage; a hurt car smokes below half health and
  burns below a quarter, and a wrecked car explodes — fireball, smoke,
  sparks, camera shake — and throws its driver clear. Wrecked police cars
  stay out for 8 s; wrecked traffic respawns after 8 s.
- **Drive-by shooting**: the pistol fires from the driver's seat, aimed
  along the camera, and hits Vipers and car bodies alike. Vipers strafe
  in a standoff and back off when Marlo closes in.
- **Radio**: three stations — SOLARA FM, BAY 97.5, VICE 101 — on a 16-step
  sequencer. R cycles stations; the HUD shows the current one.
- **Minimap zoom**: 1x, 2x and 4x, centred on Marlo when zoomed in (Z/X).
- **Wanted 0–5**: police cars chase and ram, foot officers chase and punch.
  Stay out of sight and the heat decays, one star at a time.
- **Six jobs, $12,000**: steal the coupe, lose the heat, run a package
  through an ambush, clear the Viper nest, then the Meridian Bank job —
  and a sixth job, The Last Job: steal the Viper boss's black coupe from
  Marina East.
- **Combat**: fists and a pistol, muzzle flashes and tracers, Crimson Viper
  gang enemies who shoot back.
- **HUD and minimap**: health, cash, wanted stars, objective with distance,
  speed, the driven car's health, radio station, dialogue and toasts.
  Progress saves to localStorage — continue where you left off.
- **Sound**: everything is synthesised WebAudio — engine hum, sirens,
  gunshots, pickups, explosions, three radio stations. No audio files, no
  network requests.

## Controls

| Keys | Action |
| ---- | ------ |
| WASD | Move / drive |
| Mouse drag | Look |
| E | Enter / steal a car, hold at the vault |
| SPACE | Handbrake |
| Q | Switch weapon (fists / pistol) |
| Click | Punch / shoot (drive-by while driving) |
| R | Cycle radio station |
| Z / X | Minimap zoom in / out |
| SHIFT | Sprint |
| P | Pause |
| M | Mission list |

## Play it locally

```sh
node serve.ts
```

Then open http://localhost:8080. Static files only.

## Build the entry

`main.ts` (Node 22, standard library only) copies `game/` and
`screenshots/` into the output directory and writes `dossier.json` using
the kit's `vendor/makefun-game.ts`:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Three.js r149 is vendored under `game/vendor/`. All art, textures and
sounds are procedural and original to this game.
