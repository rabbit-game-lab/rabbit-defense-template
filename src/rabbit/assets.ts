/* =============================================================================
 * SDK MODULE: assets — sprites, spritesheets, atlases and audio for Phaser.
 * Part of the Rabbit SDK (vendored via `rabbit-kit sync-sdk`).
 * ⛔ AGENTS MUST NOT EDIT THIS FILE. The tuning surface is the manifest your
 * game code declares; if the module itself falls short, that is a kit change.
 * Kind: phaser-2d — uses the Phaser loader and animation manager.
 * =============================================================================
 *
 * WHAT
 *   One declarative manifest for every file the game loads, plus the
 *   animations that come out of a spritesheet. Declare it once (ideally in
 *   src/data/assets.ts), queue it in a preload scene, use it anywhere:
 *
 *     export const ASSETS = defineAssets({
 *       images: [{ key: 'bg', path: 'assets/bg.png' }],
 *       spritesheets: [{
 *         key: 'hero', path: 'assets/hero.png', frameWidth: 32, frameHeight: 32,
 *         animations: {
 *           idle: { frames: [0, 1], frameRate: 4, repeat: -1 },
 *           run:  { frames: [2, 3, 4, 5], frameRate: 12, repeat: -1 },
 *           jump: { frames: [6] },
 *         },
 *       }],
 *       audio: [{ key: 'coin', path: 'assets/coin.mp3' }],
 *     })
 *
 *     // BootScene.preload():   loadAssets(this, ASSETS)
 *     // BootScene.create():    createAnimations(this, ASSETS)
 *     // GameScene:             const hero = this.add.sprite(x, y, 'hero')
 *     //                        playAnimation(hero, 'hero.run')
 *
 * TYPICAL REQUESTS → WHAT TO TOUCH
 *   "ponele un dibujo al jugador"  → drop the PNG in public/assets/ and add an
 *                                    entry to images (or spritesheets if it has
 *                                    frames). Then this.add.sprite(x, y, key).
 *   "que camine / que se anime"    → an `animations` entry on the spritesheet
 *                                    and playAnimation(sprite, 'key.name').
 *   "más rápido la animación"      → frameRate of that animation.
 *   "no se ve el sprite"           → keys are case-sensitive and paths are
 *                                    relative to public/ with NO leading slash.
 *   "sonido de moneda"             → an `audio` entry; play it through the
 *                                    `sound` SDK module (WebAudio, mute-aware)
 *                                    or scene.sound.play(key) for Phaser's own.
 *
 * NOTES
 *   - Animation keys are namespaced '<sheetKey>.<animName>' so two characters
 *     can both have 'run' without colliding.
 *   - loadAssets() is idempotent: already-loaded keys are skipped, so calling
 *     it from more than one scene is safe.
 *   - Pixel art: set CONFIG.render.pixelArt (main.ts reads it) — not here.
 * =============================================================================
 */
import type Phaser from 'phaser'
import { requireReady } from './sdk'

export interface ImageAsset {
  required?: boolean
  key: string
  /** Path relative to public/, no leading slash (e.g. 'assets/bg.png'). */
  path: string
}

export interface AnimationSpec {
  /** Frame indexes inside the sheet, in play order. */
  frames: readonly number[]
  /** Frames per second. Default 10. */
  frameRate?: number
  /** -1 loops forever, 0 plays once. Default 0. */
  repeat?: number
  /** Play the frames back and forth. Default false. */
  yoyo?: boolean
}

export interface SpritesheetAsset extends ImageAsset {
  frameWidth: number
  frameHeight: number
  /** Gap and offset inside the sheet, if the art needs them. */
  margin?: number
  spacing?: number
  animations?: Record<string, AnimationSpec>
}

export interface AtlasAsset extends ImageAsset {
  /** Path to the JSON produced by TexturePacker & friends. */
  atlasPath: string
  /** Animations by frame NAME (atlases name their frames). */
  animations?: Record<string, Omit<AnimationSpec, 'frames'> & { frames: readonly string[] }>
}

export interface AssetManifest {
  images?: readonly ImageAsset[]
  spritesheets?: readonly SpritesheetAsset[]
  atlases?: readonly AtlasAsset[]
  audio?: readonly ImageAsset[]
}

/** Identity helper: gives you autocompletion and type errors in the manifest. */
export function defineAssets<T extends AssetManifest>(manifest: T): T {
  return manifest
}

/** Namespaced animation key: playAnimation(sprite, animationKey('hero', 'run')). */
export function animationKey(sheetKey: string, name: string): string {
  return `${sheetKey}.${name}`
}

/** Queue everything in the manifest. Call from preload(). */
export function loadAssets(scene: Phaser.Scene, manifest: AssetManifest): Promise<void> {
  const textures = [...manifest.images ?? [], ...manifest.spritesheets ?? [], ...manifest.atlases ?? []]
  const required = new Set(textures.filter(asset => asset.required !== false && !scene.textures.exists(asset.key)).map(asset => asset.key))
  for (const asset of manifest.audio ?? []) if (asset.required !== false && !scene.cache.audio.exists(asset.key)) required.add(asset.key)
  const failed: string[] = []
  const work = new Promise<void>((resolve, reject) => {
    if (!required.size) { resolve(); return }
    const onError = (file: Phaser.Loader.File) => { if (required.has(file.key)) failed.push(file.key) }
    const cleanup = () => {
      clearTimeout(timer)
      scene.load.off('loaderror', onError)
      scene.load.off('complete', complete)
      scene.events.off('shutdown', cancel)
    }
    const complete = () => {
      cleanup()
      if (failed.length) reject(new Error('assets: required files failed: ' + failed.join(', ')))
      else resolve()
    }
    const cancel = () => { cleanup(); reject(new Error('assets: scene stopped before required loading completed')) }
    const timer = setTimeout(() => { cleanup(); reject(new Error('assets: required loading timed out')) }, 30000)
    scene.load.on('loaderror', onError)
    scene.load.once('complete', complete)
    scene.events.once('shutdown', cancel)
  })
  const ready = requireReady(work)
  for (const { key, path } of manifest.images ?? []) {
    if (!scene.textures.exists(key)) scene.load.image(key, path)
  }
  for (const sheet of manifest.spritesheets ?? []) {
    if (scene.textures.exists(sheet.key)) continue
    scene.load.spritesheet(sheet.key, sheet.path, {
      frameWidth: sheet.frameWidth,
      frameHeight: sheet.frameHeight,
      margin: sheet.margin ?? 0,
      spacing: sheet.spacing ?? 0,
    })
  }
  for (const atlas of manifest.atlases ?? []) {
    if (!scene.textures.exists(atlas.key)) scene.load.atlas(atlas.key, atlas.path, atlas.atlasPath)
  }
  for (const { key, path } of manifest.audio ?? []) {
    if (!scene.cache.audio.exists(key)) scene.load.audio(key, path)
  }
  return ready
}

/**
 * Register every declared animation. Call from create() of the boot scene,
 * AFTER the loader finished (animations need the texture to exist).
 */
export function createAnimations(scene: Phaser.Scene, manifest: AssetManifest): void {
  for (const sheet of manifest.spritesheets ?? []) {
    for (const [name, spec] of Object.entries(sheet.animations ?? {})) {
      const key = animationKey(sheet.key, name)
      if (scene.anims.exists(key)) continue
      scene.anims.create({
        key,
        frames: spec.frames.map((frame) => ({ key: sheet.key, frame })),
        frameRate: spec.frameRate ?? 10,
        repeat: spec.repeat ?? 0,
        yoyo: spec.yoyo ?? false,
      })
    }
  }
  for (const atlas of manifest.atlases ?? []) {
    for (const [name, spec] of Object.entries(atlas.animations ?? {})) {
      const key = animationKey(atlas.key, name)
      if (scene.anims.exists(key)) continue
      scene.anims.create({
        key,
        frames: spec.frames.map((frame) => ({ key: atlas.key, frame })),
        frameRate: spec.frameRate ?? 10,
        repeat: spec.repeat ?? 0,
        yoyo: spec.yoyo ?? false,
      })
    }
  }
}

/**
 * Play an animation without restarting it if it is already the current one —
 * the usual want in an update() loop ("run while moving, idle while not").
 * Returns false when the key does not exist (typo-proof, never throws).
 */
export function playAnimation(
  sprite: Phaser.GameObjects.Sprite,
  key: string,
  restart = false
): boolean {
  if (!sprite.anims.animationManager.exists(key)) {
    console.warn(`assets: animation "${key}" does not exist — check createAnimations()`)
    return false
  }
  if (!restart && sprite.anims.currentAnim?.key === key && sprite.anims.isPlaying) return true
  sprite.anims.play(key, !restart)
  return true
}

/**
 * A 1×1 white texture, handy for rectangles, particles and flashes when the
 * game has no art yet. Safe to call more than once.
 */
export function ensurePixelTexture(scene: Phaser.Scene, key = 'pixel'): string {
  if (!scene.textures.exists(key)) {
    const graphics = scene.add.graphics()
    graphics.fillStyle(0xffffff, 1)
    graphics.fillRect(0, 0, 1, 1)
    graphics.generateTexture(key, 1, 1)
    graphics.destroy()
  }
  return key
}
