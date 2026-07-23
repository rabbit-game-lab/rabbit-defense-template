import Phaser from 'phaser'
import { CONFIG } from '../game.config'
import { getAudioSettings, setMuted, setSoundVolume } from '../systems/audioManager'
import { saveAudioSettings } from '../systems/audioSettingsStore'
import {
  getAccessibilitySettings,
  loadAccessibilitySettings,
  setReducedEffects,
} from '../systems/accessibilitySettingsStore'
import { announce } from '../accessibility/liveAnnouncements'
import { clampAudioPercent, resolvePanelFillPercent, sliderGeometryFromPanel } from './audioSettingsPanelRules'
import { createSceneButton, type SceneButtonHandle } from './createSceneButton'

const PANEL_DEPTH = {
  dimmer: 90,
  panel: 100,
  text: 101,
  slider: 101,
  button: 110,
}

export interface AudioSettingsPanelConfig {
  x: number
  y: number
  onClose: () => void
  baseDepth?: number
}

export class AudioSettingsPanel {
  private readonly scene: Phaser.Scene
  private readonly onClose: () => void
  private readonly panel: Phaser.Geom.Rectangle
  private readonly rootObjects: Phaser.GameObjects.GameObject[] = []
  private readonly buttons: SceneButtonHandle[] = []

  private muteToggle!: SceneButtonHandle
  private reducedEffectsToggle!: SceneButtonHandle
  private closeButton!: SceneButtonHandle
  private volumeFill!: Phaser.GameObjects.Rectangle
  private volumeTrack!: Phaser.GameObjects.Rectangle
  private volumeThumb!: Phaser.GameObjects.Rectangle
  private valueText!: Phaser.GameObjects.Text
  private readonly sliderLeftX: number
  private readonly sliderWidth: number

  private isDragging = false
  private hasUnsavedVolumeChange = false
  private isDestroyed = false
  private focusedControl: 'mute' | 'volume' | 'effects' | 'back' = 'mute'
  private readonly onPointerDown: (_pointer: Phaser.Input.Pointer) => void
  private readonly onPointerMove: (_pointer: Phaser.Input.Pointer) => void
  private readonly onPointerUp: () => void
  private readonly onEscape = (): void => {
    this.close()
  }
  private readonly onNavigate = (event: KeyboardEvent): void => {
    event.preventDefault()
    const controls = ['mute', 'volume', 'effects', 'back'] as const
    const currentIndex = controls.indexOf(this.focusedControl)
    const reverse = event.key === 'ArrowUp' || (event.key === 'Tab' && event.shiftKey)
    const offset = reverse ? -1 : 1
    this.setFocusedControl(controls[(currentIndex + offset + controls.length) % controls.length])
  }
  private readonly onAdjustVolume = (event: KeyboardEvent): void => {
    if (this.focusedControl !== 'volume') return
    event.preventDefault()
    const nextPercent = getAudioSettings().soundVolume * 100
      + (event.key === 'ArrowLeft' ? -5 : 5)
    this.applyVolume(nextPercent)
    void this.persistCurrentSettings()
    announce(`Sound volume ${clampAudioPercent(nextPercent)} percent.`, {
      throttleKey: 'settings-volume',
      throttleMs: 150,
    })
  }
  private readonly onVolumeBoundary = (event: KeyboardEvent): void => {
    if (this.focusedControl !== 'volume') return
    event.preventDefault()
    this.applyVolume(event.key === 'Home' ? 0 : 100)
    void this.persistCurrentSettings()
  }

  constructor(scene: Phaser.Scene, config: AudioSettingsPanelConfig) {
    this.scene = scene
    this.onClose = config.onClose
    const baseDepth = config.baseDepth ?? 0

    const panelWidth = CONFIG.ui.audioPanel.width
    const panelHeight = CONFIG.ui.audioPanel.height
    const left = config.x - panelWidth / 2
    const top = config.y - panelHeight / 2
    this.panel = new Phaser.Geom.Rectangle(left, top, panelWidth, panelHeight)

    const dimmer = scene.add
      .rectangle(config.x, config.y, CONFIG.screen.width, CONFIG.screen.height, 0x000000, 0.42)
      .setDepth(baseDepth + PANEL_DEPTH.dimmer)
      .setInteractive()
      .on('pointerdown', (
        _pointer: Phaser.Input.Pointer,
        _localX: number,
        _localY: number,
        event: Phaser.Types.Input.EventData,
      ) => event.stopPropagation())
    const panelBg = scene.add
      .rectangle(config.x, config.y, panelWidth, panelHeight, CONFIG.ui.audioPanel.panelColor, 0.98)
      .setStrokeStyle(CONFIG.ui.buttonDefaults.borderThickness, CONFIG.world.accentColor, 0.65)
      .setDepth(baseDepth + PANEL_DEPTH.panel)

    this.rootObjects.push(dimmer, panelBg)

    const geometry = sliderGeometryFromPanel(this.panel.x, panelWidth)
    this.sliderLeftX = geometry.leftX
    this.sliderWidth = geometry.width

    const title = scene.add
      .text(config.x, top + 25, 'Settings', {
        color: CONFIG.ui.textColor,
        fontSize: CONFIG.ui.audioPanel.titleFontSize,
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(baseDepth + PANEL_DEPTH.text)
    const muteLabel = scene.add
      .text(this.panel.x + CONFIG.ui.audioPanel.marginX, top + 58, 'Sound', {
        color: CONFIG.ui.audioPanel.valueColor,
        fontSize: CONFIG.ui.audioPanel.labelFontSize,
      })
      .setDepth(baseDepth + PANEL_DEPTH.text)
    const soundLabel = scene.add
      .text(this.panel.x + CONFIG.ui.audioPanel.marginX, top + 112, 'Sound Volume', {
        color: CONFIG.ui.audioPanel.valueColor,
        fontSize: CONFIG.ui.audioPanel.labelFontSize,
      })
      .setDepth(baseDepth + PANEL_DEPTH.text)
    this.valueText = scene.add
      .text(this.panel.x + panelWidth - CONFIG.ui.audioPanel.marginX, top + 112, '', {
        color: CONFIG.ui.audioPanel.valueColor,
        fontSize: CONFIG.ui.audioPanel.valueFontSize,
      })
      .setOrigin(1, 0)
      .setDepth(baseDepth + PANEL_DEPTH.text)

    this.rootObjects.push(title, muteLabel, soundLabel, this.valueText)
    const effectsLabel = scene.add
      .text(this.panel.x + CONFIG.ui.audioPanel.marginX, top + 168, 'Reduced Effects', {
        color: CONFIG.ui.audioPanel.valueColor,
        fontSize: CONFIG.ui.audioPanel.labelFontSize,
      })
      .setDepth(baseDepth + PANEL_DEPTH.text)
    this.rootObjects.push(effectsLabel)

    this.volumeTrack = scene.add
      .rectangle(
        this.sliderLeftX + this.sliderWidth / 2,
        top + 140,
        this.sliderWidth,
        CONFIG.ui.audioPanel.trackHeight,
        CONFIG.ui.audioPanel.trackColor,
        1,
      )
      .setDepth(baseDepth + PANEL_DEPTH.slider)
    this.volumeFill = scene.add
      .rectangle(this.sliderLeftX, top + 140, 0, CONFIG.ui.audioPanel.trackHeight, CONFIG.ui.audioPanel.fillColor, 1)
      .setOrigin(0, 0.5)
      .setDepth(baseDepth + PANEL_DEPTH.slider)
    this.volumeThumb = scene.add
      .rectangle(this.sliderLeftX, top + 140, CONFIG.ui.audioPanel.thumbSize, CONFIG.ui.audioPanel.thumbSize, CONFIG.ui.audioPanel.thumbColor, 1)
      .setOrigin(0.5)
      .setDepth(baseDepth + PANEL_DEPTH.slider)

    this.rootObjects.push(this.volumeTrack, this.volumeFill, this.volumeThumb)

    this.muteToggle = createSceneButton(scene, {
      x: config.x,
      y: top + 78,
      width: 140,
      text: 'Mute',
      depth: baseDepth + PANEL_DEPTH.button,
      onActivate: () => {
        const current = getAudioSettings()
        const nextMuted = !current.muted
        void this.applySettings({ muted: nextMuted, soundVolume: current.soundVolume })
        announce(nextMuted ? 'Sound muted.' : 'Sound unmuted.', { throttleMs: 0 })
      },
    })

    this.reducedEffectsToggle = createSceneButton(scene, {
      x: config.x,
      y: top + 190,
      width: 180,
      text: 'Reduced Effects',
      depth: baseDepth + PANEL_DEPTH.button,
      onActivate: () => {
        const enabled = !getAccessibilitySettings().reducedEffects
        void setReducedEffects(enabled).then(() => {
          if (this.isDestroyed) return
          this.refreshReducedEffects()
          announce(`Reduced effects ${enabled ? 'on' : 'off'}.`, { throttleMs: 0 })
        })
      },
    })

    this.closeButton = createSceneButton(scene, {
      x: this.panel.x + panelWidth / 2 - CONFIG.ui.audioPanel.marginX - CONFIG.ui.audioPanel.closeButtonWidth / 2,
      y: top + panelHeight - CONFIG.ui.buttonDefaults.minTouchablePx / 2 - 2,
      width: CONFIG.ui.audioPanel.closeButtonWidth,
      height: CONFIG.ui.audioPanel.closeButtonHeight,
      text: 'Back',
      depth: baseDepth + PANEL_DEPTH.button,
      onActivate: () => this.close(),
    })

    this.buttons.push(this.muteToggle, this.reducedEffectsToggle, this.closeButton)

    this.onPointerDown = (pointer: Phaser.Input.Pointer): void => {
      if (!this.panel.contains(pointer.x, pointer.y)) return
      if (this.volumeTrack.getBounds().contains(pointer.x, pointer.y)) {
        this.startDrag(pointer.x)
        return
      }
      const thumbBounds = this.volumeThumb.getBounds()
      if (thumbBounds.contains(pointer.x, pointer.y)) {
        this.startDrag(pointer.x)
      }
    }

    this.onPointerMove = (pointer: Phaser.Input.Pointer): void => {
      if (!this.isDragging) return
      this.startDrag(pointer.x)
    }

    this.onPointerUp = (): void => {
      if (this.isDragging) {
        void this.persistCurrentSettings()
      }
      this.isDragging = false
    }

    this.refreshFromAudioSettings()
    this.refreshReducedEffects()
    this.setFocusedControl('mute')
    void loadAccessibilitySettings().then(() => {
      if (!this.isDestroyed) this.refreshReducedEffects()
    })

    scene.input.on('pointerdown', this.onPointerDown)
    scene.input.on('pointermove', this.onPointerMove)
    scene.input.on('pointerup', this.onPointerUp)
    scene.input.on('pointerupoutside', this.onPointerUp)

    scene.input.keyboard?.on('keydown-ESC', this.onEscape)
    scene.input.keyboard?.on('keydown-TAB', this.onNavigate)
    scene.input.keyboard?.on('keydown-UP', this.onNavigate)
    scene.input.keyboard?.on('keydown-DOWN', this.onNavigate)
    scene.input.keyboard?.on('keydown-LEFT', this.onAdjustVolume)
    scene.input.keyboard?.on('keydown-RIGHT', this.onAdjustVolume)
    scene.input.keyboard?.on('keydown-HOME', this.onVolumeBoundary)
    scene.input.keyboard?.on('keydown-END', this.onVolumeBoundary)
  }

  private async applySettings(next: { muted: boolean; soundVolume: number }): Promise<void> {
    setMuted(next.muted)
    setSoundVolume(next.soundVolume)
    const latest = getAudioSettings()
    try {
      await saveAudioSettings(latest)
    } catch {
      // Non-blocking persistence failure.
    }
    this.refreshFromAudioSettings()
  }

  private applyVolume(percent: number): void {
    const clamped = clampAudioPercent(percent)
    setSoundVolume(clamped / 100)
    this.hasUnsavedVolumeChange = true
    this.refreshFromAudioSettings()
  }

  private async persistCurrentSettings(): Promise<void> {
    if (!this.hasUnsavedVolumeChange) return
    this.hasUnsavedVolumeChange = false
    try {
      await saveAudioSettings(getAudioSettings())
    } catch {
      // Non-blocking persistence failure.
    }
  }

  private startDrag(pointerX: number): void {
    const clampedPercent = clampAudioPercent(((pointerX - this.sliderLeftX) / this.sliderWidth) * 100)
    this.applyVolume(clampedPercent)
    this.isDragging = true
  }

  private refreshFromAudioSettings(): void {
    const current = getAudioSettings()
    const safe = {
      muted: !!current.muted,
      soundVolume: clampAudioPercent(current.soundVolume * 100),
    }
    const { fillPercent, thumbX, label } = resolvePanelFillPercent(safe.soundVolume, {
      leftX: this.sliderLeftX,
      width: this.sliderWidth,
    })
    const fillWidth = this.sliderWidth * fillPercent
    this.volumeFill.setDisplaySize(Math.max(2, fillWidth), CONFIG.ui.audioPanel.trackHeight)
    this.volumeFill.setPosition(this.sliderLeftX, this.volumeTrack.y)

    this.volumeThumb.setX(thumbX)
    this.valueText.setText(`${label}${safe.muted ? ' (Muted)' : ''}`)
    this.muteToggle.setText(safe.muted ? 'Unmute' : 'Mute')
  }

  private refreshReducedEffects(): void {
    const enabled = getAccessibilitySettings().reducedEffects
    this.reducedEffectsToggle.setText(`Reduced Effects: ${enabled ? 'On' : 'Off'}`)
  }

  private setFocusedControl(control: 'mute' | 'volume' | 'effects' | 'back'): void {
    this.focusedControl = control
    this.muteToggle.setKeyboardFocus(control === 'mute')
    this.reducedEffectsToggle.setKeyboardFocus(control === 'effects')
    this.closeButton.setKeyboardFocus(control === 'back')
    this.volumeThumb.setStrokeStyle(
      control === 'volume' ? 3 : 0,
      CONFIG.world.accentColor,
      control === 'volume' ? 1 : 0,
    )
  }

  private close(): void {
    if (this.isDestroyed) return
    void this.persistCurrentSettings()
    this.onClose()
    this.destroy()
  }

  public destroy(): void {
    if (this.isDestroyed) return
    void this.persistCurrentSettings()
    this.isDestroyed = true

    this.scene.input.off('pointerdown', this.onPointerDown)
    this.scene.input.off('pointermove', this.onPointerMove)
    this.scene.input.off('pointerup', this.onPointerUp)
    this.scene.input.off('pointerupoutside', this.onPointerUp)

    this.scene.input.keyboard?.off('keydown-ESC', this.onEscape)
    this.scene.input.keyboard?.off('keydown-TAB', this.onNavigate)
    this.scene.input.keyboard?.off('keydown-UP', this.onNavigate)
    this.scene.input.keyboard?.off('keydown-DOWN', this.onNavigate)
    this.scene.input.keyboard?.off('keydown-LEFT', this.onAdjustVolume)
    this.scene.input.keyboard?.off('keydown-RIGHT', this.onAdjustVolume)
    this.scene.input.keyboard?.off('keydown-HOME', this.onVolumeBoundary)
    this.scene.input.keyboard?.off('keydown-END', this.onVolumeBoundary)

    for (const button of this.buttons) {
      button.destroy()
    }

    for (const object of this.rootObjects) {
      object.destroy()
    }
    this.rootObjects.length = 0
    this.buttons.length = 0
  }
}
