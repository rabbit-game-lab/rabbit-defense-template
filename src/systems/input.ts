/**
 * Input snapshot — one unified read per frame instead of listeners scattered
 * across gameplay code. Covers keyboard (arrows + WASD + Space) and pointer
 * (mouse and touch are the same Phaser pointer).
 *
 * Usage in a scene:
 *   this.controls = createInput(this)           // in create()
 *   const snap = this.controls.getSnapshot()    // in update()
 *
 * Extension points:
 *   - Virtual buttons / joystick for mobile: add Phaser UI zones in UIScene
 *     and OR their state into the snapshot here.
 *   - Swipe gestures: track pointer down/up positions here and expose
 *     swipeLeft/swipeRight/... booleans in the snapshot.
 */
import Phaser from 'phaser'

export interface InputSnapshot {
  left: boolean
  right: boolean
  up: boolean
  down: boolean
  /** Space bar — the default "do something" button. */
  action: boolean
  pointer: {
    isDown: boolean
    /** Position in logical game coordinates (800×480 space). */
    x: number
    y: number
  }
}

export interface InputHandle {
  getSnapshot(): InputSnapshot
}

interface KeyMap {
  left: Phaser.Input.Keyboard.Key
  right: Phaser.Input.Keyboard.Key
  up: Phaser.Input.Keyboard.Key
  down: Phaser.Input.Keyboard.Key
  a: Phaser.Input.Keyboard.Key
  d: Phaser.Input.Keyboard.Key
  w: Phaser.Input.Keyboard.Key
  s: Phaser.Input.Keyboard.Key
  space: Phaser.Input.Keyboard.Key
}

export function createInput(scene: Phaser.Scene): InputHandle {
  const keyboard = scene.input.keyboard
  const keys = keyboard?.addKeys({
    left: Phaser.Input.Keyboard.KeyCodes.LEFT,
    right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
    up: Phaser.Input.Keyboard.KeyCodes.UP,
    down: Phaser.Input.Keyboard.KeyCodes.DOWN,
    a: Phaser.Input.Keyboard.KeyCodes.A,
    d: Phaser.Input.Keyboard.KeyCodes.D,
    w: Phaser.Input.Keyboard.KeyCodes.W,
    s: Phaser.Input.Keyboard.KeyCodes.S,
    space: Phaser.Input.Keyboard.KeyCodes.SPACE,
  }) as KeyMap | undefined

  return {
    getSnapshot(): InputSnapshot {
      const pointer = scene.input.activePointer
      return {
        left: Boolean(keys && (keys.left.isDown || keys.a.isDown)),
        right: Boolean(keys && (keys.right.isDown || keys.d.isDown)),
        up: Boolean(keys && (keys.up.isDown || keys.w.isDown)),
        down: Boolean(keys && (keys.down.isDown || keys.s.isDown)),
        action: Boolean(keys && keys.space.isDown),
        pointer: {
          isDown: pointer.isDown,
          x: pointer.worldX,
          y: pointer.worldY,
        },
      }
    },
  }
}
