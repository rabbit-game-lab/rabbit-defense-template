---
name: phaser-gamedev
description: Phaser 3 (npm + Vite + TypeScript) game development patterns. Use when writing or modifying Phaser code in this template — scenes, sprites, Arcade Physics, input, tweens, or procedural textures.
---

# Phaser 3 Gamedev (Arcade Physics, ESM)

Source of truth: https://docs.phaser.io and https://newdocs.phaser.io (Phaser 3.90). This template uses the **npm workflow**: `npm install phaser`, scenes as ES module classes, bundled by Vite. No CDN builds, no Phaser Editor.

## The rules that matter most

- **Scenes are classes registered in `src/scenes/index.ts`** — never passed to `new Phaser.Game()` directly (main.ts is DO NOT EDIT and reads the registry).
- **This template uses Arcade Physics.** Do not enable Matter or add physics libraries; if a feature seems to need Matter-style physics, approximate it with Arcade (velocity, bounce, overlap callbacks).
- Gravity is set to `{x: 0, y: 0}` globally — platformers set per-body gravity (`body.setGravityY(...)`) or scene-level via config in `game.config.ts` values applied to bodies.

## Scene lifecycle

```ts
export default class GameScene extends Phaser.Scene {
  constructor() { super('GameScene') }   // the key used by scene.start/launch/get

  preload(): void {}   // only BootScene preloads; other scenes assume textures exist
  create(): void {}    // build the world; runs once per scene start
  update(time: number, delta: number): void {}  // per frame; delta in ms
}
```

- `this.scene.start('Key')` stops the current scene and starts another; `this.scene.launch('Key')` runs one **in parallel** (how UIScene overlays GameScene); `this.scene.get('Key')` returns a live scene instance.
- Scene `create()` runs again after `scene.start()` — never leak listeners: use `this.events.once(Phaser.Scenes.Events.SHUTDOWN, ...)` to clean up manual listeners.

## Arcade Physics recipes

```ts
// A physics sprite
const player = this.physics.add.sprite(x, y, 'player')
player.setCollideWorldBounds(true)
player.setVelocityX(CONFIG.player.speed)
player.setBounce(0.2)

// Static world
const platforms = this.physics.add.staticGroup()
platforms.create(400, 460, 'ground')

// Collisions and overlaps
this.physics.add.collider(player, platforms)
this.physics.add.overlap(player, coins, (_p, coin) => collect(coin), undefined, this)

// Grounded check (platformers)
const onGround = player.body.blocked.down
```

- `collider` separates bodies; `overlap` only fires the callback. Choose accordingly.
- Group pools: `this.physics.add.group({ maxSize: N })` + `group.get(x, y)` + `setActive(false).setVisible(false)` to recycle. Never create/destroy sprites per frame.

## Textures without art (procedural)

```ts
// The 'pixel' 1×1 white texture ships in BootScene — tint and scale it:
this.add.image(x, y, 'pixel').setTint(0xff5533).setDisplaySize(40, 8)

// Generate a texture once from Graphics:
const gfx = this.add.graphics()
gfx.fillStyle(0x53e0ae, 1).fillCircle(16, 16, 16)
gfx.generateTexture('ball', 32, 32)
gfx.destroy()
```

## Input

Use `systems/input.ts` (`createInput(scene)` → `getSnapshot()`) for held-key movement. For one-shot events prefer Phaser events:

```ts
this.input.keyboard!.on('keydown-SPACE', () => jump())
this.input.on('pointerdown', (p: Phaser.Input.Pointer) => shoot(p.worldX, p.worldY))
```

Touch and mouse are unified in `pointer`. The canvas is 800×480 logical pixels regardless of device (Scale.FIT) — always position in that space.

## Tweens, timers, camera

```ts
this.tweens.add({ targets: sprite, alpha: 0, duration: 300, onComplete: () => sprite.destroy() })
this.time.delayedCall(500, () => spawn(), [], this)
this.time.addEvent({ delay: 1000, loop: true, callback: tick })
this.cameras.main.startFollow(player, true, 0.1, 0.1)
this.cameras.main.shake(150, 0.01)
```

## Common hallucinations to avoid

- `this.game.add...` / `game.physics.arcade...` → Phaser **2** APIs. Everything hangs off the scene: `this.add`, `this.physics.add`.
- `sprite.body.velocity.x = v` works but prefer `sprite.setVelocityX(v)`; body may be `undefined` on plain images — only physics sprites have bodies.
- `this.load.image()` outside BootScene → textures must be declared in `data/assets.ts` and loaded by BootScene.
- `new Phaser.Sound(...)` → does not exist; this template synthesizes audio in `systems/audioManager.ts` (WebAudio), not via `this.sound.add` with files.
- `scene.restart()` resets the scene but not module-level state — keep run state in a resettable module (`src/state/`), not in globals.
- If `npm run check` reports a missing API, trust the compiler over your memory: consult https://newdocs.phaser.io.
