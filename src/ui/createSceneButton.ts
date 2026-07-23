import Phaser from 'phaser'
import { CONFIG } from '../game.config'
import { playClickSfx } from '../systems/audioManager'

export interface SceneButtonConfig {
  x: number
  y: number
  width: number
  height?: number
  text: string
  enabled?: boolean
  depth?: number
  onActivate: () => void
}

export interface SceneButtonHandle {
  setEnabled(enabled: boolean): void
  setText(text: string): void
  setKeyboardFocus(focused: boolean): void
  setVisible(visible: boolean): void
  trigger(): void
  destroy(): void
}

interface VisualState {
  fill: number
  alpha: number
  stroke: number
  strokeAlpha: number
}

function getVisualStates() {
  const buttonDefaults = CONFIG.ui.buttonDefaults
  return {
    normal: {
      fill: buttonDefaults.normalFill,
      alpha: buttonDefaults.normalAlpha,
      stroke: CONFIG.world.accentColor,
      strokeAlpha: 0.6,
    } as VisualState,
    hover: {
      fill: buttonDefaults.hoverFill,
      alpha: buttonDefaults.hoverAlpha,
      stroke: CONFIG.world.accentColor,
      strokeAlpha: 0.85,
    } as VisualState,
    pressed: {
      fill: buttonDefaults.pressedFill,
      alpha: buttonDefaults.pressedAlpha,
      stroke: CONFIG.world.accentColor,
      strokeAlpha: 1,
    } as VisualState,
    disabled: {
      fill: buttonDefaults.disabledFill,
      alpha: buttonDefaults.disabledAlpha,
      stroke: CONFIG.world.accentColor,
      strokeAlpha: 0.25,
    } as VisualState,
  }
}

/**
 * Reusable Phaser button helper for pointer and keyboard activation.
 */
export function createSceneButton(scene: Phaser.Scene, config: SceneButtonConfig): SceneButtonHandle {
  const safeHeight = Math.max(config.height ?? CONFIG.ui.buttonDefaults.defaultHeight, CONFIG.ui.buttonDefaults.minTouchablePx)
  const safeWidth = Math.max(config.width, CONFIG.ui.buttonDefaults.minTouchablePx)

  const state = getVisualStates()

  const bg = scene.add
    .rectangle(config.x, config.y, safeWidth, safeHeight, state.normal.fill, state.normal.alpha)
    .setStrokeStyle(CONFIG.ui.buttonDefaults.borderThickness, state.normal.stroke, state.normal.strokeAlpha)
    .setDepth(config.depth ?? 0)
  const label = scene.add
    .text(config.x, config.y, config.text, {
      fontSize: '16px',
      color: CONFIG.ui.textColor,
      fontStyle: 'bold',
    })
    .setOrigin(0.5)
    .setDepth(config.depth ?? 0)

  bg.setInteractive({ useHandCursor: true })

  let isEnabled = config.enabled !== false
  let isPressed = false
  let isHovering = false
  let isFocused = false
  let isDestroyed = false

  const applyState = (): void => {
    const target =
      !isEnabled
        ? state.disabled
        : isPressed
          ? state.pressed
          : isHovering || isFocused
            ? state.hover
            : state.normal

    bg.setFillStyle(target.fill, target.alpha).setStrokeStyle(
      CONFIG.ui.buttonDefaults.borderThickness,
      target.stroke,
      target.strokeAlpha,
    )
  }

  const applyClick = (): void => {
    if (!isEnabled || isDestroyed) return
    playClickSfx()
    config.onActivate()
  }

  const onPointerDown = (_pointer: Phaser.Input.Pointer): void => {
    if (!isEnabled || isDestroyed) return
    isPressed = true
    applyState()
  }

  const onPointerUp = (pointer: Phaser.Input.Pointer): void => {
    if (!isEnabled || isDestroyed) return
    if (isPressed && bg.getBounds().contains(pointer.x, pointer.y)) {
      applyClick()
    }
    isPressed = false
    applyState()
  }

  const onPointerOut = (): void => {
    if (!isEnabled || isDestroyed) return
    isPressed = false
    isHovering = false
    applyState()
  }

  const onPointerOver = (): void => {
    if (!isEnabled || isDestroyed) return
    isHovering = true
    applyState()
  }

  const onKeyboardActivate = (): void => {
    if (!isEnabled || !isFocused || isDestroyed) return
    applyClick()
  }

  bg.on('pointerdown', onPointerDown)
  bg.on('pointerup', onPointerUp)
  bg.on('pointerupoutside', onPointerOut)
  bg.on('pointerover', onPointerOver)
  bg.on('pointerout', onPointerOut)

  const keyboard = scene.input.keyboard
  keyboard?.on('keydown-ENTER', onKeyboardActivate)
  keyboard?.on('keydown-SPACE', onKeyboardActivate)

  const refreshEnabled = (enabled: boolean): void => {
    if (enabled) {
      bg.setInteractive({ useHandCursor: true })
    } else {
      bg.disableInteractive()
    }
  }

  applyState()
  refreshEnabled(isEnabled)

  return {
    setEnabled(enabled: boolean): void {
      if (isDestroyed) return
      isEnabled = enabled
      isPressed = false
      isHovering = false
      refreshEnabled(enabled)
      applyState()
    },

    setText(text: string): void {
      if (isDestroyed) return
      label.setText(text)
    },

    setKeyboardFocus(focused: boolean): void {
      if (isDestroyed) return
      isFocused = focused
      applyState()
    },

    setVisible(visible: boolean): void {
      if (isDestroyed) return
      bg.setVisible(visible)
      label.setVisible(visible)
      refreshEnabled(visible && isEnabled)
    },

    trigger(): void {
      applyClick()
    },

    destroy(): void {
      if (isDestroyed) return
      isDestroyed = true

      bg.off('pointerdown', onPointerDown)
      bg.off('pointerup', onPointerUp)
      bg.off('pointerupoutside', onPointerOut)
      bg.off('pointerover', onPointerOver)
      bg.off('pointerout', onPointerOut)
      keyboard?.off('keydown-ENTER', onKeyboardActivate)
      keyboard?.off('keydown-SPACE', onKeyboardActivate)

      bg.removeAllListeners()
      bg.destroy()
      label.destroy()
    },
  }
}
