# Solara Bay — Make GTA 6

[![Make GTA 6](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/giber76/gta6-entry-recorded/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/giber76/gta6-entry-recorded/reward.svg)](https://make.fun/bounty/gta6-01)

An open-world crime game in the spirit of GTA 6, built from scratch for the
[make.fun gta6-01 bounty](https://make.fun/bounty/gta6-01). Marlo, a driver
with nothing to lose, takes six jobs across Solara Bay — a sun-soaked coastal
city of lit-window towers, palms, a marina, a pier, and an ocean that never
stops moving.

## Play

Open `game/index.html` from any static server (`node serve.ts`, then
http://localhost:8080). No network, no build step — every file the game loads
lives under `game/`, with Three.js r160 vendored at
`game/vendor/three.module.min.js`.

- **W A S D** — drive / walk (E to enter a car, E again to get out)
- **Mouse click** — shoot the pistol (issued in M4, or any time via the story)
- **R** — radio: SOLARA FM / BAY 97.5 / VICE 101 (generated WebAudio loops)
- **Z / X** — minimap zoom in / out (1x / 2x / 4x)
- **Esc** — pause

## The story — six jobs, $12,000

1. **The First Coupe ($500)** — steal the coupe, drive it to Rico's Garage.
2. **Lose the Heat ($1,300)** — wanted level 2: drive the rectangle at the
   city edge until the heat drops off.
3. **The Package ($2,500)** — walk the pier (mind the ambush), deliver to
   Coral Junction.
4. **Marina Showdown ($4,000)** — a pistol, three Vipers, one marina.
5. **The Bank Job ($7,000)** — hold E at the vault, steal the getaway car,
   reach the safehouse with three stars on you.
6. **The Last Job ($12,000)** — steal the boss's black coupe past his two
   guards and bring it home to Rico's.

After the win, free roam opens and the save lands in localStorage
(`solara-bay-save-v1`).

## Systems

- **City** — a 360 m grid of roads, sidewalks, crosswalks, parks, a beach,
  a marina with moored boats, and a pier over the sea; buildings wear
  procedurally lit windows.
- **Driving** — arcade physics (top speed ~155 km/h), building and traffic
  collisions, car damage with smoke, fire, and explosions.
- **Wanted** — three stars, police cruisers with flashing light bars that
  chase, intercept, and ram; get pinned down and you're busted.
- **Combat** — pistol with raycast shooting and drive-by from the car.
- **Life** — traffic looping the blocks, pedestrians on the sidewalks who
  scatter when something blows up, a living radio, and a minimap that shows
  the ocean, the police, and your next job's beacon.

## Structure

- `game/index.html` — page shell, canvas, HUD, menus.
- `game/src/main.js` — game loop, state machine, chase camera.
- `game/src/` — one module per system: `city`, `vehicles`, `traffic`,
  `pedestrians`, `police`, `combat`, `missions`, `player`, `effects`,
  `audio`, `hud`, `minimap`, `input`, `save`, `debug`, `util`.
- `main.ts` — the entry program: copies `game/` + `screenshots/` to
  `/output` and writes `dossier.json` with the vendored make.fun library.
- `screenshots/` — four real renders of the game, taken in-session.

## License

MIT — see `LICENSE`.
