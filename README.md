# Solara Bay

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun)
[![rank](https://make.fun/badge/gta6-01/giber76/gta6-entry-recorded/rank.svg)](https://make.fun)
[![reward](https://make.fun/badge/gta6-01/giber76/gta6-entry-recorded/reward.svg)](https://make.fun)

**Solara Bay** — an original open-world crime game in the spirit of GTA 6, built for the
[make.fun](https://make.fun) gta6-01 bounty. You are Marlo Vance, a driver-for-hire in a
sun-soaked fictional coastal city, working five jobs for your fixer Rico Salas.

## The game

- **Open city**: a seeded road grid with buildings, a plaza, a beach and ocean, palms,
  traffic and pedestrians — explore on foot or by car.
- **Cars to steal and drive**: arcade driving with handbrake; stealing a car draws the
  law only if someone sees it.
- **Wanted level 0–5**: police cars chase and ram, foot officers chase and punch;
  the heat decays when you stay out of sight.
- **Five-mission story**: steal the coupe, lose the heat, run a package through an
  ambush, clear the Viper nest, then the Meridian Bank job — $7,000 in total.
- **Combat**: fists and a pistol, muzzle flashes and tracers, Crimson Viper gang enemies
  who shoot back.
- **HUD + minimap**: health, cash, wanted stars, objective with distance, speed,
  dialogue and toasts; save / continue via localStorage.
- **Sound**: fully synthesised WebAudio — engine hum, sirens, gunshots, pickups.

## Controls

WASD move / drive · mouse drag to look · E enter / steal car · SPACE handbrake ·
Q switch weapon · click punch / shoot · SHIFT sprint · P pause · M mission list.

## Play it

```sh
node serve.ts
```

Then open http://localhost:8080 — static files only, no network requests.

## Entry

`main.ts` (Node 22) copies `game/` and `screenshots/` to the output directory and
writes `dossier.json` with the kit's `vendor/makefun-game.ts`:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Built with three.js r149 (vendored under `game/vendor/`). All art, textures and
sounds are procedural and original.
