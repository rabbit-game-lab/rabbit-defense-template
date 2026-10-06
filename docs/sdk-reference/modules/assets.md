<!-- Generated from @rabbit-game-lab/sdk@1.1.0 by `rabbit-kit sync-docs`. Do not edit: rabbit-check compares it with the installed package. -->

# `assets`

Import path: `@rabbit-game-lab/sdk/phaser-2d/assets`  
Source when installed: `node_modules/@rabbit-game-lab/sdk/sdk/phaser-2d/assets.ts` (read-only)

```ts
import { defineAssets, animationKey, loadAssets, createAnimations, playAnimation, ensurePixelTexture, type ImageAsset, type AnimationSpec, type SpritesheetAsset, type AtlasAsset, type AssetManifest } from '@rabbit-game-lab/sdk/phaser-2d/assets'
```

## Guide

```text
SDK MODULE: assets — sprites, spritesheets, atlases and audio for Phaser.
Part of the Rabbit SDK (vendored via `rabbit-kit sync-sdk`).
⛔ AGENTS MUST NOT EDIT THIS FILE. The tuning surface is the manifest your
game code declares; if the module itself falls short, that is a kit change.
Kind: phaser-2d — uses the Phaser loader and animation manager.

WHAT
  One declarative manifest for every file the game loads, plus the
  animations that come out of a spritesheet. Declare it once (ideally in
  src/data/assets.ts), queue it in a preload scene, use it anywhere:

    export const ASSETS = defineAssets({
      images: [{ key: 'bg', path: 'assets/bg.png' }],
      spritesheets: [{
        key: 'hero', path: 'assets/hero.png', frameWidth: 32, frameHeight: 32,
        animations: {
          idle: { frames: [0, 1], frameRate: 4, repeat: -1 },
          run:  { frames: [2, 3, 4, 5], frameRate: 12, repeat: -1 },
          jump: { frames: [6] },
        },
      }],
      audio: [{ key: 'coin', path: 'assets/coin.mp3' }],
    })

    // BootScene.preload():   loadAssets(this, ASSETS)
    // BootScene.create():    createAnimations(this, ASSETS)
    // GameScene:             const hero = this.add.sprite(x, y, 'hero')
    //                        playAnimation(hero, 'hero.run')

TYPICAL REQUESTS → WHAT TO TOUCH
  "ponele un dibujo al jugador"  → drop the PNG in public/assets/ and add an
                                   entry to images (or spritesheets if it has
                                   frames). Then this.add.sprite(x, y, key).
  "que camine / que se anime"    → an `animations` entry on the spritesheet
                                   and playAnimation(sprite, 'key.name').
  "más rápido la animación"      → frameRate of that animation.
  "no se ve el sprite"           → keys are case-sensitive and paths are
                                   relative to public/ with NO leading slash.
  "sonido de moneda"             → an `audio` entry; play it through the
                                   `sound` SDK module (WebAudio, mute-aware)
                                   or scene.sound.play(key) for Phaser's own.

NOTES
  - Animation keys are namespaced '<sheetKey>.<animName>' so two characters
    can both have 'run' without colliding.
  - loadAssets() is idempotent: already-loaded keys are skipped, so calling
    it from more than one scene is safe.
  - Pixel art: set CONFIG.render.pixelArt (main.ts reads it) — not here.
```

## Public API

Declarations shipped with the package (`dist/phaser-2d/assets.d.ts`).

```ts
import type Phaser from 'phaser';
export interface ImageAsset {
    required?: boolean;
    key: string;
    /** Path relative to public/, no leading slash (e.g. 'assets/bg.png'). */
    path: string;
}
export interface AnimationSpec {
    /** Frame indexes inside the sheet, in play order. */
    frames: readonly number[];
    /** Frames per second. Default 10. */
    frameRate?: number;
    /** -1 loops forever, 0 plays once. Default 0. */
    repeat?: number;
    /** Play the frames back and forth. Default false. */
    yoyo?: boolean;
}
export interface SpritesheetAsset extends ImageAsset {
    frameWidth: number;
    frameHeight: number;
    /** Gap and offset inside the sheet, if the art needs them. */
    margin?: number;
    spacing?: number;
    animations?: Record<string, AnimationSpec>;
}
export interface AtlasAsset extends ImageAsset {
    /** Path to the JSON produced by TexturePacker & friends. */
    atlasPath: string;
    /** Animations by frame NAME (atlases name their frames). */
    animations?: Record<string, Omit<AnimationSpec, 'frames'> & {
        frames: readonly string[];
    }>;
}
export interface AssetManifest {
    images?: readonly ImageAsset[];
    spritesheets?: readonly SpritesheetAsset[];
    atlases?: readonly AtlasAsset[];
    audio?: readonly ImageAsset[];
}
/** Identity helper: gives you autocompletion and type errors in the manifest. */
export declare function defineAssets<T extends AssetManifest>(manifest: T): T;
/** Namespaced animation key: playAnimation(sprite, animationKey('hero', 'run')). */
export declare function animationKey(sheetKey: string, name: string): string;
/** Queue everything in the manifest. Call from preload(). */
export declare function loadAssets(scene: Phaser.Scene, manifest: AssetManifest): Promise<void>;
/**
 * Register every declared animation. Call from create() of the boot scene,
 * AFTER the loader finished (animations need the texture to exist).
 */
export declare function createAnimations(scene: Phaser.Scene, manifest: AssetManifest): void;
/**
 * Play an animation without restarting it if it is already the current one —
 * the usual want in an update() loop ("run while moving, idle while not").
 * Returns false when the key does not exist (typo-proof, never throws).
 */
export declare function playAnimation(sprite: Phaser.GameObjects.Sprite, key: string, restart?: boolean): boolean;
/**
 * A 1×1 white texture, handy for rectangles, particles and flashes when the
 * game has no art yet. Safe to call more than once.
 */
export declare function ensurePixelTexture(scene: Phaser.Scene, key?: string): string;
```
