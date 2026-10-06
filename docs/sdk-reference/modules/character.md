<!-- Generated from @rabbit-game-lab/sdk@1.1.0 by `rabbit-kit sync-docs`. Do not edit: rabbit-check compares it with the installed package. -->

# `character`

Import path: `@rabbit-game-lab/sdk/phaser-2d/character`  
Source when installed: `node_modules/@rabbit-game-lab/sdk/sdk/phaser-2d/character.ts` (read-only)

```ts
import { createCharacter, type CharacterAsset, type CharacterOptions } from '@rabbit-game-lab/sdk/phaser-2d/character'
```

## Guide

```text
Switch a sprite's visual without replacing its gameplay object or Arcade body.
```

## Public API

Declarations shipped with the package (`dist/phaser-2d/character.d.ts`).

```ts
/** Switch a sprite's visual without replacing its gameplay object or Arcade body. */
import type Phaser from 'phaser';
import { type LoadOptions } from "../common/asset-source.js";
import { type AnimationSpec } from "./assets.js";
export interface CharacterAsset {
    key: string;
    path: string;
    frameWidth?: number;
    frameHeight?: number;
    animations?: Record<string, AnimationSpec>;
}
export interface CharacterOptions extends LoadOptions {
    frame?: string | number;
    /** Semantic state -> existing Phaser animation key. */
    animations?: Record<string, string>;
}
type Sprite = Phaser.GameObjects.Sprite | Phaser.Physics.Arcade.Sprite;
export declare function createCharacter(sprite: Sprite, options?: CharacterOptions): {
    entity: Sprite;
    play: (state: string) => boolean;
    state: () => string;
    switchCharacter(source: string | CharacterAsset, next?: CharacterOptions): Promise<boolean>;
    /** Detaches the adapter; the game still owns the sprite and texture cache. */
    destroy(): void;
};
export {};
```
