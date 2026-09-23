/* =============================================================================
 * SDK MODULE: physics — Arcade Physics presets and collision helpers.
 * Part of the Rabbit SDK (vendored via `rabbit-kit sync-sdk`).
 * ⛔ AGENTS MUST NOT EDIT THIS FILE. The tuning surface is the preset and the
 * options your game code passes; if the module falls short, that is a kit change.
 * Kind: phaser-2d — Phaser Arcade Physics.
 * =============================================================================
 *
 * WHAT
 *   The three-line setup every 2D game repeats, as named presets, plus the
 *   collision helpers whose argument order is easy to get wrong:
 *
 *     applyPhysicsPreset(this, 'platformer')        // gravity + world bounds
 *     const player = addBody(this, sprite, { bounce: 0.1, collideWorldBounds: true })
 *     const ground = addStatic(this, this.add.rectangle(400, 560, 800, 40, 0x2d6a4f))
 *     this.physics.add.collider(player, ground)
 *     onOverlap(this, player, coins, (_p, coin) => coin.destroy())
 *
 * PRESETS
 *   'platformer' — gravity down, world bounds on. Side view, things fall.
 *   'topdown'    — no gravity, world bounds on. Zelda-style movement.
 *   'space'      — no gravity, no bounds, drag 0. Asteroids-style drifting.
 *
 * TYPICAL REQUESTS → WHAT TO TOUCH
 *   "que caiga más rápido"      → applyPhysicsPreset gravityY (or CONFIG).
 *   "que rebote"                → bounce in addBody (0 = no bounce, 1 = full).
 *   "que atraviese las paredes" → collideWorldBounds: false.
 *   "que no se resbale"         → drag (higher = stops sooner).
 *   "que empuje las cajas"      → collider() between two dynamic bodies; a
 *                                 heavier body needs a bigger mass.
 *
 * NOTES
 *   - Arcade Physics must be enabled in main.ts (it already is in the base
 *     template: physics.default = 'arcade'). This module tunes it, never boots it.
 *   - body() returns the typed Arcade body of a game object, which is the part
 *     TypeScript makes noisy: use it instead of casting by hand.
 * =============================================================================
 */
import Phaser from 'phaser'

export type PhysicsPreset = 'platformer' | 'topdown' | 'space'

export interface PresetOptions {
  /** Downward gravity in px/s². Default: 1200 platformer, 0 otherwise. */
  gravityY?: number
  /** Keep bodies inside the camera bounds. Default: true except 'space'. */
  worldBounds?: boolean
  /** Draw body outlines to debug collisions. Default false. */
  debug?: boolean
}

export interface BodyOptions {
  /** 0 = no bounce, 1 = keeps all its energy. Default 0. */
  bounce?: number
  /** Deceleration in px/s² when nothing pushes the body. Default 0. */
  drag?: number
  /** Per-body gravity in px/s², added to the world's. */
  gravityY?: number
  collideWorldBounds?: boolean
  /** Body size override in px (defaults to the sprite size). */
  size?: { width: number; height: number }
  /** Body offset in px inside the sprite (art with padding). */
  offset?: { x: number; y: number }
  /** Heavier bodies are pushed less in collisions. Default 1. */
  mass?: number
  /** Never moved by collisions (moving platforms, doors). Default false. */
  immovable?: boolean
}

/** Any game object Arcade Physics can own. */
type PhysicsObject = Phaser.GameObjects.GameObject & { x: number; y: number }

/** The Arcade body of a game object, typed. Returns null if it has none. */
export function body(object: Phaser.GameObjects.GameObject): Phaser.Physics.Arcade.Body | null {
  const candidate = (object as { body?: unknown }).body
  return candidate instanceof Phaser.Physics.Arcade.Body ? candidate : null
}

/** World-level setup: gravity, bounds and debug. Call once from create(). */
export function applyPhysicsPreset(
  scene: Phaser.Scene,
  preset: PhysicsPreset,
  options: PresetOptions = {}
): void {
  const arcade = scene.physics.world
  const gravityY = options.gravityY ?? (preset === 'platformer' ? 1200 : 0)
  const bounds = options.worldBounds ?? preset !== 'space'

  arcade.gravity.set(0, gravityY)
  arcade.setBoundsCollision(bounds, bounds, bounds, bounds)
  const { width, height } = scene.scale
  arcade.setBounds(0, 0, width, height)
  arcade.drawDebug = options.debug ?? false
  if (!arcade.drawDebug) arcade.debugGraphic?.clear()
}

/** Give a game object a dynamic body and tune it in one call. */
export function addBody<T extends PhysicsObject>(
  scene: Phaser.Scene,
  object: T,
  options: BodyOptions = {}
): T {
  scene.physics.add.existing(object, false)
  const arcadeBody = body(object)
  if (!arcadeBody) return object

  arcadeBody.setBounce(options.bounce ?? 0)
  arcadeBody.setDrag(options.drag ?? 0)
  arcadeBody.setCollideWorldBounds(options.collideWorldBounds ?? false)
  arcadeBody.setAllowGravity(true)
  if (options.gravityY !== undefined) arcadeBody.setGravityY(options.gravityY)
  if (options.size) arcadeBody.setSize(options.size.width, options.size.height)
  if (options.offset) arcadeBody.setOffset(options.offset.x, options.offset.y)
  if (options.mass !== undefined) arcadeBody.setMass(options.mass)
  arcadeBody.setImmovable(options.immovable ?? false)
  return object
}

/** Give a game object a static body (ground, walls, platforms that never move). */
export function addStatic<T extends PhysicsObject>(scene: Phaser.Scene, object: T): T {
  scene.physics.add.existing(object, true)
  return object
}

type CollisionTarget =
  | Phaser.GameObjects.GameObject
  | Phaser.GameObjects.Group
  | Phaser.Physics.Arcade.Group
  | Phaser.Physics.Arcade.StaticGroup
  | Phaser.GameObjects.GameObject[]

/**
 * Solid collision: the bodies push each other. Returns the collider so you can
 * remove it later (scene.physics.world.removeCollider).
 */
export function onCollide(
  scene: Phaser.Scene,
  first: CollisionTarget,
  second: CollisionTarget,
  callback?: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback
): Phaser.Physics.Arcade.Collider {
  return scene.physics.add.collider(first, second, callback)
}

/**
 * Overlap: they pass through each other but you get told. This is the one for
 * coins, checkpoints, damage zones and "cuando toque X que pase Y".
 */
export function onOverlap(
  scene: Phaser.Scene,
  first: CollisionTarget,
  second: CollisionTarget,
  callback: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback
): Phaser.Physics.Arcade.Collider {
  return scene.physics.add.overlap(first, second, callback)
}

/** True while the body is standing on something (ground or a platform). */
export function isOnGround(object: Phaser.GameObjects.GameObject): boolean {
  const arcadeBody = body(object)
  return arcadeBody ? arcadeBody.blocked.down || arcadeBody.touching.down : false
}
