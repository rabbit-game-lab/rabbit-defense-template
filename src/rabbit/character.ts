/** Switch a sprite's visual without replacing its gameplay object or Arcade body. */
import type Phaser from 'phaser'
import { abortable, assetUrl, type LoadOptions } from './asset-source'
import { createAnimations, type AnimationSpec } from './assets'

export interface CharacterAsset {
  key: string
  path: string
  frameWidth?: number
  frameHeight?: number
  animations?: Record<string, AnimationSpec>
}
export interface CharacterOptions extends LoadOptions {
  frame?: string | number
  /** Semantic state -> existing Phaser animation key. */
  animations?: Record<string, string>
}
type Sprite = Phaser.GameObjects.Sprite | Phaser.Physics.Arcade.Sprite
const requests = new WeakMap<Phaser.Textures.TextureManager, Map<string, { signature: string; promise: Promise<void> }>>()

async function loadCharacter(sprite: Sprite, source: CharacterAsset, options: LoadOptions): Promise<void> {
  const scene = sprite.scene
  const url = assetUrl(source.path)
  const sheets = source.frameWidth !== undefined || source.frameHeight !== undefined
  if (sheets && (![source.frameWidth, source.frameHeight].every(n => Number.isInteger(n) && n! > 0))) {
    throw new Error('character: spritesheets need positive integer frame dimensions')
  }
  let cache = requests.get(scene.textures)
  if (!cache) { cache = new Map(); requests.set(scene.textures, cache) }
  const signature = JSON.stringify([url, source.frameWidth, source.frameHeight, source.animations])
  const previous = cache.get(source.key)
  if (previous?.signature !== signature && (previous || scene.textures.exists(source.key))) {
    throw new Error('character: texture key already belongs to another asset: ' + source.key)
  }
  if (!previous) {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    const downloaded = new Promise<HTMLImageElement>((resolve, reject) => {
      image.onload = () => resolve(image)
      image.onerror = () => reject(new Error('character: image load failed: ' + source.key))
      image.src = url
    })
    let installed = false
    const promise = abortable(downloaded).then(image => {
      if (!scene.sys.game) throw new Error('character: game has been destroyed')
      if (sheets) {
        scene.textures.addSpriteSheet(source.key, image, { frameWidth: source.frameWidth!, frameHeight: source.frameHeight! })
        createAnimations(scene, { spritesheets: [{ ...source, frameWidth: source.frameWidth!, frameHeight: source.frameHeight! }] })
      } else scene.textures.addImage(source.key, image)
      installed = true
    }).catch(error => { cache!.delete(source.key); throw error }).finally(() => {
      image.onload = null; image.onerror = null
      if (!installed) image.src = ''
    })
    cache.set(source.key, { signature, promise })
  }
  await abortable(cache.get(source.key)!.promise, options)
}

export function createCharacter(sprite: Sprite, options: CharacterOptions = {}) {
  let mappings = options.animations ?? {}
  let current = 'idle'
  let revision = 0
  let destroyed = false
  const shutdown = () => { destroyed = true; revision++ }
  sprite.once('destroy', shutdown)
  sprite.scene.events.once('shutdown', shutdown)
  function play(state: string): boolean {
    current = state
    const key = mappings[state]
    if (destroyed || !key || !sprite.scene.anims.exists(key)) return false
    sprite.play(key, true)
    return true
  }
  return {
    entity: sprite,
    play,
    state: () => current,
    async switchCharacter(source: string | CharacterAsset, next: CharacterOptions = {}): Promise<boolean> {
      if (destroyed) throw new Error('character: handle destroyed')
      const request = ++revision
      if (typeof source !== 'string') await loadCharacter(sprite, source, next)
      if (destroyed || request !== revision || next.signal?.aborted) return false
      const key = typeof source === 'string' ? source : source.key
      const texture = sprite.scene.textures.get(key)
      if (!sprite.scene.textures.exists(key) || !texture.has(String(next.frame ?? '__BASE'))) throw new Error('character: missing texture/frame: ' + key)
      const width = sprite.displayWidth, height = sprite.displayHeight
      const originX = sprite.originX, originY = sprite.originY
      const body = sprite.body as Phaser.Physics.Arcade.Body | null
      const box = body && 'setSize' in body ? {
        width: body.sourceWidth * Math.abs(sprite.scaleX), height: body.sourceHeight * Math.abs(sprite.scaleY), offsetX: body.offset.x * Math.abs(sprite.scaleX),
        offsetY: body.offset.y * Math.abs(sprite.scaleY), circle: body.isCircle,
      } : null
      sprite.anims.stop()
      sprite.setTexture(key, next.frame)
      sprite.setOrigin(originX, originY).setDisplaySize(width, height)
      if (body && box) {
        body.updateBounds()
        const x = Math.abs(sprite.scaleX) || 1, y = Math.abs(sprite.scaleY) || 1
        if (box.circle) body.setCircle(box.width / x / 2)
        else body.setSize(box.width / x, box.height / y, false)
        body.setOffset(box.offsetX / x, box.offsetY / y)
      }
      mappings = next.animations ?? (typeof source !== 'string' && source.animations
        ? Object.fromEntries(Object.keys(source.animations).map(name => [name, key + '.' + name])) : {})
      play(current)
      return true
    },
    /** Detaches the adapter; the game still owns the sprite and texture cache. */
    destroy(): void {
      shutdown()
      sprite.off('destroy', shutdown)
      sprite.scene?.events.off('shutdown', shutdown)
    },
  }
}
