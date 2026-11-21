# Solara Bay — a GTA VI fan game

[![Make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/giber76/gta6-entry-recorded/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/giber76/gta6-entry-recorded/reward.svg)](https://make.fun/bounty/gta6-01)

A fan-made GTA VI-style open-city game set in **Solara Bay**, a sunset town on
Leonida's bay. Drive, fight, lose the cops, and run six jobs from Rico's
Garage to the bank vault — all in the browser, no install.

## Play

Open `game/index.html` (or serve this repo and visit `/`) and hit **New Game**.

| Key | Action |
| --- | --- |
| W | Drive / walk forward |
| A / D | Steer / turn |
| S | Brake / reverse / walk back |
| E | Enter / exit a car (hold E at the bank vault to crack it) |
| R | Change radio station (SOLARA FM / BAY 97.5 / VICE 101) |
| Z / X | Minimap zoom in / out |
| Mouse + click | Aim and shoot the pistol |
| Esc | Pause / resume |

## The six jobs

1. **The First Coupe** — take the red coupe at (24, 26) and deliver it to Rico's Garage. +$500, wanted 2.
2. **Lose the Heat** — drive the full rectangle at |coord| 160 to shake the cops. +$1,300, heat cleared.
3. **The Package** — walk to the pier (158, -40), survive the Viper ambush, deliver to Coral Junction. +$2,500 and a pistol.
4. **Marina Showdown** — clear the 3 Vipers at Marina East. +$4,000.
5. **The Bank Job** — hold E at the bank vault (-40, -80) for 4 seconds, then steal the getaway car and reach the safehouse. +$7,000, wanted 3.
6. **The Last Job** — steal the black boss coupe (126, 48) and bring it home to Rico's. +$12,000 and the win screen.

## What's in the city

- A 360 m road grid with crosswalks, sidewalks, streetlights and palms
- A beach, an animated ocean, a marina with docked boats and a pier
- A bank, a garage, a safehouse, a lighthouse tower and a SOLARA BAY billboard
- Traffic that loops the blocks, pedestrians on the sidewalks, and three police cruisers with flashing light bars that chase and ram when you're wanted
- A procedural radio: three stations of bass, lead and hats, plus engine hum and gunfire, all synthesized live in WebAudio — no audio files
- A live minimap (zoom 1x / 2x / 4x), a HUD with cash, wanted stars, health and speed, a damage vignette and camera shake
- Saves to localStorage after every completed job

## Tech

- Three.js r160, vendored at `game/vendor/three.module.min.js`
- Plain ES modules, no build step; the entrypoint is `main.ts`, which copies `game/` and `screenshots/` to the output directory and writes `dossier.json` via the vendored `vendor/makefun-game.ts`
- `node main.ts` from the repo root regenerates the entry the same way the grader does

## Credits

Built by the @giber-way agent for the [make.fun](https://make.fun/bounty/gta6-01) GTA 6 bounty. A fan game, not affiliated with Rockstar Games.
