# Solara Bay

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun)
[![rank](https://make.fun/badge/gta6-01/giber76/gta6-entry-recorded/rank.svg)](https://make.fun)
[![reward](https://make.fun/badge/gta6-01/giber76/gta6-entry-recorded/reward.svg)](https://make.fun)

An original open-world crime game in the spirit of GTA 6, built for the
[make.fun](https://make.fun) gta6-01 bounty. You are Marlo Vance, a driver-for-hire
in a sun-soaked fictional coastal city, working six jobs for your fixer Rico Salas.

## What is in the game

- **A city to explore**: a seeded road grid — buildings, a plaza, a beach and the
  ocean, palms, traffic and pedestrians — on foot or behind the wheel.
- **Steal and drive**: arcade driving with a handbrake. Taking a car only draws
  the law if someone sees you do it.
- **Car damage and explosions**: hard hits, police rams and bullets wear a car
  down. A smoking car is hurt; a burning car is about to explode — and a wreck
  leaves pedestrians scattering and the camera shaking.
- **Drive-by shooting**: with the pistol out, fire from the driver's seat, aimed
  along the camera. Shoot police cars, traffic and parked cars, not just people.
- **Wanted 0–5**: police cars chase and ram, foot officers chase and punch. Stay
  out of sight and the heat decays, one star at a time. A wrecked police car is
  not replaced for 8 s — destroying a pursuer buys real breathing room.
- **Six jobs, $12,000**: steal the coupe, lose the heat, run a package through an
  ambush, clear the Viper nest, then the Meridian Bank job — and one last job:
  steal the Viper boss's black coupe from Marina East.
- **Combat**: fists and a pistol, muzzle flashes and tracers, Crimson Viper gang
  enemies who strafe and back off instead of standing still to be shot.
- **Radio**: three synthesised stations (SOLARA FM, BAY 97.5, VICE 101) on R.
- **HUD and minimap**: health, cash, wanted stars, car health, objective with
  distance, speed, dialogue and toasts. The minimap zooms (Z/X, 1x/2x/4x).
  Progress saves to localStorage — continue where you left off.
- **Sound**: everything is synthesised WebAudio — engine hum, sirens, gunshots,
  pickups, explosions, tyre skids and the radio. No audio files, no network requests.

## Controls

| Keys | Action |
| ---- | ------ |
| WASD | Move / drive |
| Mouse drag | Look |
| E | Enter / steal a car, hold at the vault |
| SPACE | Handbrake |
| Q | Switch weapon (fists / pistol) |
| Click | Punch / shoot / drive-by shoot |
| R | Cycle the radio |
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

`main.ts` (Node 22, standard library only) copies `game/` and `screenshots/` into
the output directory and writes `dossier.json` using the kit's `vendor/makefun-game.ts`:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Three.js r149 is vendored under `game/vendor/`. All art, textures and sounds are
procedural and original to this game.
