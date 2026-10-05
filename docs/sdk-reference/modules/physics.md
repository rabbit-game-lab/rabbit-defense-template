<!-- Generated from @rabbit-game-lab/sdk@1.0.0 by `rabbit-kit sync-docs`. Do not edit: rabbit-check compares it with the installed package. -->

# `physics`

Import path: `@rabbit-game-lab/sdk/phaser-2d/physics`  
Source when installed: `node_modules/@rabbit-game-lab/sdk/sdk/phaser-2d/physics.ts` (read-only)

```ts
import { body, applyPhysicsPreset, addBody, addStatic, onCollide, onOverlap, isOnGround, type PhysicsPreset, type PresetOptions, type BodyOptions } from '@rabbit-game-lab/sdk/phaser-2d/physics'
```

## Guide

```text
SDK MODULE: physics — Arcade Physics presets and collision helpers.
Part of the Rabbit SDK (vendored via `rabbit-kit sync-sdk`).
⛔ AGENTS MUST NOT EDIT THIS FILE. The tuning surface is the preset and the
options your game code passes; if the module falls short, that is a kit change.
Kind: phaser-2d — Phaser Arcade Physics.

WHAT
  The three-line setup every 2D game repeats, as named presets, plus the
  collision helpers whose argument order is easy to get wrong:

    applyPhysicsPreset(this, 'platformer')        // gravity + world bounds
    const player = addBody(this, sprite, { bounce: 0.1, collideWorldBounds: true })
    const ground = addStatic(this, this.add.rectangle(400, 560, 800, 40, 0x2d6a4f))
    this.physics.add.collider(player, ground)
    onOverlap(this, player, coins, (_p, coin) => coin.destroy())

PRESETS
  'platformer' — gravity down, world bounds on. Side view, things fall.
  'topdown'    — no gravity, world bounds on. Zelda-style movement.
  'space'      — no gravity, no bounds, drag 0. Asteroids-style drifting.

TYPICAL REQUESTS → WHAT TO TOUCH
  "que caiga más rápido"      → applyPhysicsPreset gravityY (or CONFIG).
  "que rebote"                → bounce in addBody (0 = no bounce, 1 = full).
  "que atraviese las paredes" → collideWorldBounds: false.
  "que no se resbale"         → drag (higher = stops sooner).
  "que empuje las cajas"      → collider() between two dynamic bodies; a
                                heavier body needs a bigger mass.

NOTES
  - Arcade Physics must be enabled in main.ts (it already is in the base
    template: physics.default = 'arcade'). This module tunes it, never boots it.
  - body() returns the typed Arcade body of a game object, which is the part
    TypeScript makes noisy: use it instead of casting by hand.
```

## Public API

Declarations shipped with the package (`dist/phaser-2d/physics.d.ts`).

```ts
import Phaser from 'phaser';
export type PhysicsPreset = 'platformer' | 'topdown' | 'space';
export interface PresetOptions {
    /** Downward gravity in px/s². Default: 1200 platformer, 0 otherwise. */
    gravityY?: number;
    /** Keep bodies inside the camera bounds. Default: true except 'space'. */
    worldBounds?: boolean;
    /** Draw body outlines to debug collisions. Default false. */
    debug?: boolean;
}
export interface BodyOptions {
    /** 0 = no bounce, 1 = keeps all its energy. Default 0. */
    bounce?: number;
    /** Deceleration in px/s² when nothing pushes the body. Default 0. */
    drag?: number;
    /** Per-body gravity in px/s², added to the world's. */
    gravityY?: number;
    collideWorldBounds?: boolean;
    /** Body size override in px (defaults to the sprite size). */
    size?: {
        width: number;
        height: number;
    };
    /** Body offset in px inside the sprite (art with padding). */
    offset?: {
        x: number;
        y: number;
    };
    /** Heavier bodies are pushed less in collisions. Default 1. */
    mass?: number;
    /** Never moved by collisions (moving platforms, doors). Default false. */
    immovable?: boolean;
}
/** Any game object Arcade Physics can own. */
type PhysicsObject = Phaser.GameObjects.GameObject & {
    x: number;
    y: number;
};
/** The Arcade body of a game object, typed. Returns null if it has none. */
export declare function body(object: Phaser.GameObjects.GameObject): Phaser.Physics.Arcade.Body | null;
/** World-level setup: gravity, bounds and debug. Call once from create(). */
export declare function applyPhysicsPreset(scene: Phaser.Scene, preset: PhysicsPreset, options?: PresetOptions): void;
/** Give a game object a dynamic body and tune it in one call. */
export declare function addBody<T extends PhysicsObject>(scene: Phaser.Scene, object: T, options?: BodyOptions): T;
/** Give a game object a static body (ground, walls, platforms that never move). */
export declare function addStatic<T extends PhysicsObject>(scene: Phaser.Scene, object: T): T;
type CollisionTarget = Phaser.GameObjects.GameObject | Phaser.GameObjects.Group | Phaser.Physics.Arcade.Group | Phaser.Physics.Arcade.StaticGroup | Phaser.GameObjects.GameObject[];
/**
 * Solid collision: the bodies push each other. Returns the collider so you can
 * remove it later (scene.physics.world.removeCollider).
 */
export declare function onCollide(scene: Phaser.Scene, first: CollisionTarget, second: CollisionTarget, callback?: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback): Phaser.Physics.Arcade.Collider;
/**
 * Overlap: they pass through each other but you get told. This is the one for
 * coins, checkpoints, damage zones and "cuando toque X que pase Y".
 */
export declare function onOverlap(scene: Phaser.Scene, first: CollisionTarget, second: CollisionTarget, callback: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback): Phaser.Physics.Arcade.Collider;
/** True while the body is standing on something (ground or a platform). */
export declare function isOnGround(object: Phaser.GameObjects.GameObject): boolean;
export {};
```
