# Rabbit 2D Base — Agent Guide

This is a **base template**: a fully wired but empty game. The platform plumbing already works — boot, iframe SDK handshake, input snapshot, procedural audio, config-first tuning, HUD overlay — and there is **no gameplay**. Your job is to build the game on top of this wiring, never to rewire it. Built with **Phaser 3 (Arcade Physics) + Vite + TypeScript**.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with HMR (`--host`, required by the platform) |
| `npm run check` | **Run after every change**: tsc + forbidden APIs + layout + file size |
| `npm run build` | Production build |

## File map

```text
rabbit.json               Platform manifest. DO NOT EDIT.
src/
  main.ts                 Boot + SDK wiring. DO NOT EDIT.
  game.config.ts          ⭐ ALL gameplay tuning. Every tunable value lands here.
  rabbit/sdk.ts           Platform iframe SDK (storage, audio unlock, handshake). DO NOT EDIT.
  scenes/
    index.ts              Scene registry: SCENES list + RESTART_SCENE_KEY. Register new scenes HERE.
    BootScene.ts          Loads data/assets.ts manifest, creates the 'pixel' texture, starts GameScene.
    GameScene.ts          Placeholder scene — replace its visuals with the real game.
    UIScene.ts            HUD overlay stub — polls GameScene.getHudState() every frame.
  systems/
    input.ts              Input snapshot (keyboard + pointer). Extend for swipe/virtual buttons.
    audioManager.ts       Procedural WebAudio SFX + mute. Copy playClickSfx for new sounds.
  data/
    assets.ts             Asset manifest (empty). All art is declared here, never hardcoded paths.
  entities/               (create when needed) Game objects: Arcade Physics sprites + their logic.
  state/                  (create when needed) Run-wide state as plain in-memory modules.
scripts/check.mjs         Local rabbit-check implementation. DO NOT EDIT.
public/assets/            Game art (PNGs). Only files actually used by the game.
```

## Where to add what

1. **Tuning values** → `src/game.config.ts`, always first. Every value a player might ask to change (speeds, colors, counts, durations) lives here, documented with the What/Feel/Range/Related/Units block format shown in the file header.
2. **New scenes** (menu, pause, game over...) → new file in `src/scenes/` + register it in `src/scenes/index.ts` (`SCENES`). Point `RESTART_SCENE_KEY` at the menu once one exists. Never edit `main.ts`.
3. **Game objects** (player, enemies, projectiles...) → `src/entities/`, one class per file, Arcade Physics sprites. Pool anything spawned repeatedly.
4. **Cross-cutting logic** (level building, spawning, scoring rules) → `src/systems/`.
5. **Content as data** (levels, enemy types, waves) → `src/data/`, typed arrays/objects with no logic. Prefer adding data over adding branches in systems.
6. **HUD / menus** → `UIScene` and scene files (Phaser UI, not DOM). Keep the pattern: gameplay exposes a state snapshot, UI polls it.
7. **Sounds** → `src/systems/audioManager.ts`: add a `playXxxSfx()` following `playClickSfx` (procedural WebAudio, no audio files). Scale by `CONFIG.audio.sfxVolume`.
8. **Art** → copy PNGs into `public/assets/` and declare them in `src/data/assets.ts`; BootScene loads the manifest automatically.

## Rules

- **DO NOT EDIT**: `src/main.ts`, `src/rabbit/sdk.ts`, `rabbit.json`, `scripts/check.mjs`, `vite.config.ts`, `package.json` dependencies.
- **Run `npm run check` after every change.** If the game breaks in the iframe, the console error is forwarded to you — fix and re-check.
- **Never use `localStorage`/`sessionStorage` directly** — use `sdk.storage` from `src/rabbit/sdk.ts` (safe in sandboxed iframes).
- Don't hardcode tunable values — add them to `CONFIG` in `game.config.ts`, documented, and import it.
- Keep files **≤ 400 lines** (enforced by `check`). Split into systems/entities before you hit the limit.
- The screen is a fixed 800×480 logical resolution (`Scale.FIT`). Don't change `CONFIG.screen.*`.
- `main.ts` depends on three game-owned exports — keep their names and shapes: `SCENES` and `RESTART_SCENE_KEY` in `scenes/index.ts`, `setMuted` in `systems/audioManager.ts`.
- Register animations once (a `registerAnimations()` module called from BootScene) — not inside entity constructors.

## Architecture

`main.ts` boots Phaser with the `SCENES` registry, wires the platform SDK (ready/error handshake, pause/restart/mute, container resize) and never changes. `BootScene` loads every texture declared in `data/assets.ts` and hands off to `GameScene`. `GameScene` owns gameplay and exposes `getHudState()`; `UIScene` runs in parallel and polls it every frame. `systems/input.ts` turns keyboard + pointer into one snapshot read per update. `systems/audioManager.ts` synthesizes SFX with WebAudio; the SDK unlocks the AudioContext on the first gesture and `main.ts` routes the platform mute to it. Persistent data (high scores, unlocks) goes through `sdk.storage`.

## How to grow this game

1. **First playable**: replace the placeholder visuals inside `GameScene` — a moving thing, an objective, a fail state. Read `this.controls.getSnapshot()` in `update()` for input. Keep it small.
2. **Extract early**: before `GameScene` reaches ~200 lines, move game objects to `src/entities/` and rules to `src/systems/`. GameScene should orchestrate, not implement.
3. **Content as data**: when a second level/enemy/wave appears, define it in `src/data/` and build it from data instead of duplicating code.
4. **Frame the run**: add `MainMenuScene` / `GameOverScene` in `scenes/`, register them in `scenes/index.ts`, update `RESTART_SCENE_KEY`.
5. **Config-first, always**: every new tunable goes to `game.config.ts` with its documented block at the moment you introduce it — not later.
