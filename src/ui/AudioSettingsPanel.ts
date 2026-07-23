import Phaser from 'phaser'
import { CONFIG } from '../game.config'
import { getAudioSettings, setMuted, setSoundVolume } from '../systems/audioManager'
import { saveAudioSettings } from '../systems/audioSettingsStore'
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
}

export class AudioSettingsPanel {
  private readonly scene: Phaser.Scene
  private readonly onClose: () => void
  private readonly panel: Phaser.Geom.Rectangle
  private readonly rootObjects: Phaser.GameObjects.GameObject[] = []
  private readonly buttons: SceneButtonHandle[] = []

  private muteToggle!: SceneButtonHandle
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
  private readonly onPointerDown: (_pointer: Phaser.Input.Pointer) => void
  private readonly onPointerMove: (_pointer: Phaser.Input.Pointer) => void
  private readonly onPointerUp: () => void
  private readonly onEscape = (): void => {
    this.close()
  }

  constructor(scene: Phaser.Scene, config: AudioSettingsPanelConfig) {
    this.scene = scene
    this.onClose = config.onClose

    const panelWidth = CONFIG.ui.audioPanel.width
    const panelHeight = CONFIG.ui.audioPanel.height
    const left = config.x - panelWidth / 2
    const top = config.y - panelHeight / 2
    this.panel = new Phaser.Geom.Rectangle(left, top, panelWidth, panelHeight)

    const dimmer = scene.add
      .rectangle(config.x, config.y, CONFIG.screen.width, CONFIG.screen.height, 0x000000, 0.42)
      .setDepth(PANEL_DEPTH.dimmer)
    const panelBg = scene.add
      .rectangle(config.x, config.y, panelWidth, panelHeight, CONFIG.ui.audioPanel.panelColor, 0.98)
      .setStrokeStyle(CONFIG.ui.buttonDefaults.borderThickness, CONFIG.world.accentColor, 0.65)
      .setDepth(PANEL_DEPTH.panel)

    this.rootObjects.push(dimmer, panelBg)

    const geometry = sliderGeometryFromPanel(this.panel.x, panelWidth)
    this.sliderLeftX = geometry.leftX
    this.sliderWidth = geometry.width

    const title = scene.add
      .text(config.x, top + 28, 'Audio Settings', {
        color: CONFIG.ui.textColor,
        fontSize: CONFIG.ui.audioPanel.titleFontSize,
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(PANEL_DEPTH.text)
    const muteLabel = scene.add
      .text(this.panel.x + CONFIG.ui.audioPanel.marginX, top + 72, 'Mute', {
        color: CONFIG.ui.audioPanel.valueColor,
        fontSize: CONFIG.ui.audioPanel.labelFontSize,
      })
      .setDepth(PANEL_DEPTH.text)
    const soundLabel = scene.add
      .text(this.panel.x + CONFIG.ui.audioPanel.marginX, top + 132, 'Sound Volume', {
        color: CONFIG.ui.audioPanel.valueColor,
        fontSize: CONFIG.ui.audioPanel.labelFontSize,
      })
      .setDepth(PANEL_DEPTH.text)
    this.valueText = scene.add
      .text(this.panel.x + panelWidth - CONFIG.ui.audioPanel.marginX, top + 132, '', {
        color: CONFIG.ui.audioPanel.valueColor,
        fontSize: CONFIG.ui.audioPanel.valueFontSize,
      })
      .setOrigin(1, 0)
      .setDepth(PANEL_DEPTH.text)

    this.rootObjects.push(title, muteLabel, soundLabel, this.valueText)

    this.volumeTrack = scene.add
      .rectangle(
        this.sliderLeftX + this.sliderWidth / 2,
        top + 160,
        this.sliderWidth,
        CONFIG.ui.audioPanel.trackHeight,
        CONFIG.ui.audioPanel.trackColor,
        1,
      )
      .setDepth(PANEL_DEPTH.slider)
    this.volumeFill = scene.add
      .rectangle(this.sliderLeftX, top + 160, 0, CONFIG.ui.audioPanel.trackHeight, CONFIG.ui.audioPanel.fillColor, 1)
      .setOrigin(0, 0.5)
      .setDepth(PANEL_DEPTH.slider)
    this.volumeThumb = scene.add
      .rectangle(this.sliderLeftX, top + 160, CONFIG.ui.audioPanel.thumbSize, CONFIG.ui.audioPanel.thumbSize, CONFIG.ui.audioPanel.thumbColor, 1)
      .setOrigin(0.5)
      .setDepth(PANEL_DEPTH.slider)

    this.rootObjects.push(this.volumeTrack, this.volumeFill, this.volumeThumb)

    this.muteToggle = createSceneButton(scene, {
      x: config.x,
      y: top + 96,
      width: 140,
      text: 'Mute',
      depth: PANEL_DEPTH.button,
      onActivate: () => {
        const current = getAudioSettings()
        const nextMuted = !current.muted
        void this.applySettings({ muted: nextMuted, soundVolume: current.soundVolume })
      },
    })

    this.closeButton = createSceneButton(scene, {
      x: this.panel.x + panelWidth / 2 - CONFIG.ui.audioPanel.marginX - CONFIG.ui.audioPanel.closeButtonWidth / 2,
      y: top + panelHeight - 36,
      width: CONFIG.ui.audioPanel.closeButtonWidth,
      height: CONFIG.ui.audioPanel.closeButtonHeight,
      text: 'Back',
      depth: PANEL_DEPTH.button,
      onActivate: () => this.close(),
    })

    this.buttons.push(this.muteToggle, this.closeButton)

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

    scene.input.on('pointerdown', this.onPointerDown)
    scene.input.on('pointermove', this.onPointerMove)
    scene.input.on('pointerup', this.onPointerUp)
    scene.input.on('pointerupoutside', this.onPointerUp)

    scene.input.keyboard?.on('keydown-ESC', this.onEscape)
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
    this.muteToggle.setKeyboardFocus(false)
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
