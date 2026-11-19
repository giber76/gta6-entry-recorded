# Solara Bay

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun)
[![rank](https://make.fun/badge/gta6-01/giber76/gta6-entry-recorded/rank.svg)](https://make.fun)
[![reward](https://make.fun/badge/gta6-01/giber76/gta6-entry-recorded/reward.svg)](https://make.fun)

An original open-world crime game in the spirit of GTA 6, built for the
[make.fun](https://make.fun) gta6-01 bounty. You are Marlo Vance, a driver-for-hire
in a sun-soaked fictional coastal city, working five jobs for your fixer Rico Salas.

## What is in the game

- **A city to explore**: a seeded road grid — buildings, a plaza, a beach and the
  ocean, palms, traffic and pedestrians — on foot or behind the wheel.
- **Steal and drive**: arcade driving with a handbrake. Taking a car only draws
  the law if someone sees you do it.
- **Wanted 0–5**: police cars chase and ram, foot officers chase and punch. Stay
  out of sight and the heat decays, one star at a time.
- **Five jobs, $7,000**: steal the coupe, lose the heat, run a package through an
  ambush, clear the Viper nest, then the Meridian Bank job.
- **Combat**: fists and a pistol, muzzle flashes and tracers, Crimson Viper gang
  enemies who shoot back.
- **HUD and minimap**: health, cash, wanted stars, objective with distance, speed,
  dialogue and toasts. Progress saves to localStorage — continue where you left off.
- **Sound**: everything is synthesised WebAudio — engine hum, sirens, gunshots,
  pickups. No audio files, no network requests.

## Controls

| Keys | Action |
| ---- | ------ |
| WASD | Move / drive |
| Mouse drag | Look |
| E | Enter / steal a car, hold at the vault |
| SPACE | Handbrake |
| Q | Switch weapon (fists / pistol) |
| Click | Punch / shoot |
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
