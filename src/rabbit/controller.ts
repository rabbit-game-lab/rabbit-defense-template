/* =============================================================================
 * SDK MODULE: controller — platformer / top-down character control (Phaser).
 * Part of the Rabbit SDK (vendored via `rabbit-kit sync-sdk`).
 * ⛔ AGENTS MUST NOT EDIT THIS FILE. The tuning surface is the options object
 * your game code passes to createController(); if the module falls short,
 * that is a kit change, not a local edit.
 * Kind: phaser-2d — drives an Arcade Physics body.
 * =============================================================================
 *
 * WHAT
 *   The movement feel of a 2D character, tuned the way kids ask for it, on top
 *   of an Arcade body. Two modes: 'platformer' (run + jump + gravity) and
 *   'topdown' (8-way, no gravity).
 *
 *     const input = createKeyboard({ left: [...], right: [...], jump: [...] })
 *     const hero = addBody(this, this.add.sprite(100, 300, 'hero'),
 *                          { collideWorldBounds: true })
 *     const control = createController({
 *       sprite: hero, input, mode: 'platformer',
 *       speed: CONFIG.player.speed, jumpVelocity: CONFIG.player.jumpVelocity,
 *       onJump: () => sfx.tone({ freq: 520, slideTo: 900 }),
 *     })
 *
 *     update(_t, dt) { control.update(dt) }      // one line in the scene
 *
 * TYPICAL REQUESTS → WHAT TO TOUCH
 *   "que salte más alto"     → jumpVelocity (higher = higher; 300-900 is sane).
 *   "que corra más rápido"   → speed.
 *   "doble salto"            → maxJumps: 2.
 *   "salta apenas lo toco"   → coyoteMs / bufferMs are already on; raise them
 *                              if it still feels strict (they forgive early or
 *                              late presses — this is what makes it feel good).
 *   "cae como una pluma"     → gravityY on the body, or fallMultiplier here.
 *   "que mire para donde va" → flipX is handled; pass animations to also switch
 *                              idle/run/jump clips.
 *   "vista de arriba"        → mode: 'topdown' (gravity and jump are ignored).
 *
 * INTEGRATIONS
 *   - Reads actions from any input handle with pressed() — keyboard, or touch
 *     feeding the same keyboard, so mobile works with no extra code.
 *   - Pause: the controller stops when the scene stops; while paused the input
 *     module reports everything released, so nothing drifts.
 *
 * NOTES
 *   - update(dt) expects the delta in MILLISECONDS, exactly what Phaser's
 *     update(time, delta) gives you.
 *   - The controller never creates the body: pass a sprite that already has
 *     one (physics module's addBody).
 * =============================================================================
 */
import Phaser from 'phaser'
import { body, isOnGround } from './physics'

export type ControllerMode = 'platformer' | 'topdown'

/** Minimal input surface — createKeyboard()'s handle satisfies it. */
export interface ControllerInput {
  pressed(action: string): boolean
}

export interface ControllerAnimations {
  idle?: string
  run?: string
  jump?: string
  fall?: string
}

export interface ControllerOptions {
  sprite: Phaser.GameObjects.GameObject & { x: number; y: number; flipX?: boolean }
  input: ControllerInput
  mode?: ControllerMode
  /** Horizontal speed in px/s. Default 220. */
  speed?: number
  /** Jump impulse in px/s (positive number, applied upwards). Default 560. */
  jumpVelocity?: number
  /** Jumps available before touching ground again. Default 1 (2 = double jump). */
  maxJumps?: number
  /** Extra gravity factor while falling — snappier arc. Default 1.15. */
  fallMultiplier?: number
  /** Grace period after leaving a ledge where a jump still works. Default 90ms. */
  coyoteMs?: number
  /** Jump pressed slightly before landing still fires. Default 120ms. */
  bufferMs?: number
  /** Action names, if your map does not use these. */
  actions?: { left?: string; right?: string; up?: string; down?: string; jump?: string }
  /** Animation keys (from the assets module) to switch automatically. */
  animations?: ControllerAnimations
  /** Flip the sprite to face the movement direction. Default true. */
  faceDirection?: boolean
  onJump?: () => void
  onLand?: () => void
}

export interface ControllerHandle {
  /** Call once per frame with Phaser's delta (milliseconds). */
  update(deltaMs: number): void
  /** True while standing on something (platformer mode). */
  isGrounded(): boolean
  /** -1, 0 or 1: the direction the character is moving horizontally. */
  facing(): number
  /** Force a jump from code (jump pads, cutscenes). */
  jump(): void
  destroy(): void
}

export function createController(options: ControllerOptions): ControllerHandle {
  const mode = options.mode ?? 'platformer'
  const speed = options.speed ?? 220
  const jumpVelocity = options.jumpVelocity ?? 560
  const maxJumps = options.maxJumps ?? 1
  const fallMultiplier = options.fallMultiplier ?? 1.15
  const coyoteMs = options.coyoteMs ?? 90
  const bufferMs = options.bufferMs ?? 120
  const faceDirection = options.faceDirection ?? true
  const actions = {
    left: options.actions?.left ?? 'left',
    right: options.actions?.right ?? 'right',
    up: options.actions?.up ?? 'up',
    down: options.actions?.down ?? 'down',
    jump: options.actions?.jump ?? 'jump',
  }

  const sprite = options.sprite
  const animated = sprite as Phaser.GameObjects.Sprite
  const canAnimate = typeof animated.play === 'function' && options.animations !== undefined

  let coyoteTimer = 0
  let bufferTimer = 0
  let jumpsLeft = maxJumps
  let wasGrounded = false
  let facing = 1
  let jumpWasPressed = false

  function arcadeBody(): Phaser.Physics.Arcade.Body | null {
    return body(sprite)
  }

  function playAnimation(key: string | undefined): void {
    if (!canAnimate || !key) return
    if (animated.anims.currentAnim?.key === key && animated.anims.isPlaying) return
    if (animated.anims.animationManager.exists(key)) animated.play(key, true)
  }

  function doJump(): void {
    const physicsBody = arcadeBody()
    if (!physicsBody) return
    physicsBody.setVelocityY(-jumpVelocity)
    jumpsLeft -= 1
    coyoteTimer = 0
    bufferTimer = 0
    options.onJump?.()
  }

  function update(deltaMs: number): void {
    const physicsBody = arcadeBody()
    if (!physicsBody) return
    const delta = deltaMs / 1000
    const input = options.input

    // --- Horizontal (both modes) ---
    const left = input.pressed(actions.left)
    const right = input.pressed(actions.right)
    const moveX = (right ? 1 : 0) - (left ? 1 : 0)
    physicsBody.setVelocityX(moveX * speed)
    if (moveX !== 0) {
      facing = moveX
      if (faceDirection && 'flipX' in sprite) sprite.flipX = moveX < 0
    }

    if (mode === 'topdown') {
      const up = input.pressed(actions.up)
      const down = input.pressed(actions.down)
      const moveY = (down ? 1 : 0) - (up ? 1 : 0)
      // Diagonals must not be faster than a straight line.
      const length = Math.hypot(moveX, moveY) || 1
      physicsBody.setVelocity((moveX / length) * speed, (moveY / length) * speed)
      playAnimation(moveX !== 0 || moveY !== 0 ? options.animations?.run : options.animations?.idle)
      return
    }

    // --- Platformer: coyote time, jump buffer, double jump ---
    const grounded = isOnGround(sprite)
    if (grounded) {
      if (!wasGrounded) options.onLand?.()
      coyoteTimer = coyoteMs
      jumpsLeft = maxJumps
    } else {
      coyoteTimer = Math.max(0, coyoteTimer - deltaMs)
    }
    wasGrounded = grounded

    const jumpPressed = input.pressed(actions.jump)
    const jumpJustPressed = jumpPressed && !jumpWasPressed
    jumpWasPressed = jumpPressed
    if (jumpJustPressed) bufferTimer = bufferMs
    else bufferTimer = Math.max(0, bufferTimer - deltaMs)

    const canGroundJump = coyoteTimer > 0 && jumpsLeft === maxJumps
    const canAirJump = jumpsLeft > 0 && jumpsLeft < maxJumps
    if (bufferTimer > 0 && (canGroundJump || canAirJump)) doJump()

    // Falling faster than rising is what makes a jump feel good rather than floaty.
    if (physicsBody.velocity.y > 0 && fallMultiplier !== 1) {
      physicsBody.setVelocityY(physicsBody.velocity.y * (1 + (fallMultiplier - 1) * delta * 60))
    }

    if (!grounded) playAnimation(physicsBody.velocity.y < 0 ? options.animations?.jump : options.animations?.fall ?? options.animations?.jump)
    else playAnimation(moveX !== 0 ? options.animations?.run : options.animations?.idle)
  }

  return {
    update,
    isGrounded: () => isOnGround(sprite),
    facing: () => facing,
    jump: doJump,
    destroy: () => undefined,
  }
}
