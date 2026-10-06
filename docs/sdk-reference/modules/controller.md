<!-- Generated from @rabbit-game-lab/sdk@1.1.0 by `rabbit-kit sync-docs`. Do not edit: rabbit-check compares it with the installed package. -->

# `controller`

Import path: `@rabbit-game-lab/sdk/phaser-2d/controller`  
Source when installed: `node_modules/@rabbit-game-lab/sdk/sdk/phaser-2d/controller.ts` (read-only)

```ts
import { createController, type ControllerMode, type ControllerInput, type ControllerAnimations, type ControllerOptions, type ControllerHandle } from '@rabbit-game-lab/sdk/phaser-2d/controller'
```

## Guide

```text
SDK MODULE: controller — platformer / top-down character control (Phaser).
Part of the Rabbit SDK (vendored via `rabbit-kit sync-sdk`).
⛔ AGENTS MUST NOT EDIT THIS FILE. The tuning surface is the options object
your game code passes to createController(); if the module falls short,
that is a kit change, not a local edit.
Kind: phaser-2d — drives an Arcade Physics body.

WHAT
  The movement feel of a 2D character, tuned the way kids ask for it, on top
  of an Arcade body. Two modes: 'platformer' (run + jump + gravity) and
  'topdown' (8-way, no gravity).

    const input = createKeyboard({ left: [...], right: [...], jump: [...] })
    const hero = addBody(this, this.add.sprite(100, 300, 'hero'),
                         { collideWorldBounds: true })
    const control = createController({
      sprite: hero, input, mode: 'platformer',
      speed: CONFIG.player.speed, jumpVelocity: CONFIG.player.jumpVelocity,
      onJump: () => sfx.tone({ freq: 520, slideTo: 900 }),
    })

    update(_t, dt) { control.update(dt) }      // one line in the scene

TYPICAL REQUESTS → WHAT TO TOUCH
  "que salte más alto"     → jumpVelocity (higher = higher; 300-900 is sane).
  "que corra más rápido"   → speed.
  "doble salto"            → maxJumps: 2.
  "salta apenas lo toco"   → coyoteMs / bufferMs are already on; raise them
                             if it still feels strict (they forgive early or
                             late presses — this is what makes it feel good).
  "cae como una pluma"     → gravityY on the body, or fallMultiplier here.
  "que mire para donde va" → flipX is handled; pass animations to also switch
                             idle/run/jump clips.
  "vista de arriba"        → mode: 'topdown' (gravity and jump are ignored).

INTEGRATIONS
  - Reads actions from any input handle with pressed() — keyboard, or touch
    feeding the same keyboard, so mobile works with no extra code.
  - Pause: the controller stops when the scene stops; while paused the input
    module reports everything released, so nothing drifts.

NOTES
  - update(dt) expects the delta in MILLISECONDS, exactly what Phaser's
    update(time, delta) gives you.
  - The controller never creates the body: pass a sprite that already has
    one (physics module's addBody).
```

## Public API

Declarations shipped with the package (`dist/phaser-2d/controller.d.ts`).

```ts
import Phaser from 'phaser';
export type ControllerMode = 'platformer' | 'topdown';
/** Minimal input surface — createKeyboard()'s handle satisfies it. */
export interface ControllerInput {
    pressed(action: string): boolean;
}
export interface ControllerAnimations {
    idle?: string;
    run?: string;
    jump?: string;
    fall?: string;
}
export interface ControllerOptions {
    sprite: Phaser.GameObjects.GameObject & {
        x: number;
        y: number;
        flipX?: boolean;
    };
    input: ControllerInput;
    mode?: ControllerMode;
    /** Horizontal speed in px/s. Default 220. */
    speed?: number;
    /** Jump impulse in px/s (positive number, applied upwards). Default 560. */
    jumpVelocity?: number;
    /** Jumps available before touching ground again. Default 1 (2 = double jump). */
    maxJumps?: number;
    /** Extra gravity factor while falling — snappier arc. Default 1.15. */
    fallMultiplier?: number;
    /** Grace period after leaving a ledge where a jump still works. Default 90ms. */
    coyoteMs?: number;
    /** Jump pressed slightly before landing still fires. Default 120ms. */
    bufferMs?: number;
    /** Action names, if your map does not use these. */
    actions?: {
        left?: string;
        right?: string;
        up?: string;
        down?: string;
        jump?: string;
    };
    /** Animation keys (from the assets module) to switch automatically. */
    animations?: ControllerAnimations;
    /** Flip the sprite to face the movement direction. Default true. */
    faceDirection?: boolean;
    onJump?: () => void;
    onLand?: () => void;
}
export interface ControllerHandle {
    /** Call once per frame with Phaser's delta (milliseconds). */
    update(deltaMs: number): void;
    /** True while standing on something (platformer mode). */
    isGrounded(): boolean;
    /** -1, 0 or 1: the direction the character is moving horizontally. */
    facing(): number;
    /** Force a jump from code (jump pads, cutscenes). */
    jump(): void;
    destroy(): void;
}
export declare function createController(options: ControllerOptions): ControllerHandle;
```
