import Phaser from 'phaser'
import { CONFIG } from '../game.config'
import { GAME_SCENE_KEY, MAIN_MENU_SCENE_KEY } from '../scenes/flowContracts'
import { getAudioSettings, setMuted } from '../systems/audioManager'
import { saveAudioSettings } from '../systems/audioSettingsStore'
import { AudioSettingsPanel } from './AudioSettingsPanel'
import { createSceneButton, type SceneButtonHandle } from './createSceneButton'
import {
  resolvePauseMenuAction,
  resolvePauseMenuEffect,
  type PauseMenuAction,
  type PauseMenuEffect,
  type PauseMenuState,
} from './pauseMenuRules'

export type PauseOverlayMarker = 'pause' | 'audio-options' | 'confirm-restart' | 'confirm-menu' | null

interface PauseMenuControllerConfig {
  scene: Phaser.Scene
  pauseButton: SceneButtonHandle
  onOverlayMarker: (overlay: PauseOverlayMarker) => void
  onModalChange?: (open: boolean) => void
}

export class PauseMenuController {
  private readonly scene: Phaser.Scene
  private readonly pauseButton: SceneButtonHandle
  private readonly onOverlayMarker: (overlay: PauseOverlayMarker) => void
  private readonly onModalChange?: (open: boolean) => void

  private state: PauseMenuState = 'running'
  private overlayObjects: Phaser.GameObjects.GameObject[] = []
  private overlayButtons: SceneButtonHandle[] = []
  private audioPanel: AudioSettingsPanel | null = null
  private focusedButtonIndex = 0
  private confirmationReadyAt = 0
  private isEnabled = true
  private isDestroyed = false
  private isTransitioning = false

  constructor(config: PauseMenuControllerConfig) {
    this.scene = config.scene
    this.pauseButton = config.pauseButton
    this.onOverlayMarker = config.onOverlayMarker
    this.onModalChange = config.onModalChange

    this.pauseButton.setEnabled(true)
    this.pauseButton.setKeyboardFocus(false)
    this.scene.input.keyboard?.on('keydown-ESC', this.onPauseToggle)
    this.scene.input.keyboard?.on('keydown-P', this.onPauseToggle)
    this.scene.input.keyboard?.on('keydown-M', this.onMuteToggle)
    this.scene.input.keyboard?.on('keydown-TAB', this.onNavigate)
    this.scene.input.keyboard?.on('keydown-UP', this.onNavigate)
    this.scene.input.keyboard?.on('keydown-DOWN', this.onNavigate)
    this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy)
    this.setMarker(null)
  }

  public activatePauseButton(): void {
    this.transition('toggle-pause')
  }

  public setEnabled(enabled: boolean): void {
    if (this.isDestroyed || this.isEnabled === enabled) return
    this.isEnabled = enabled
    if (!enabled && this.state !== 'running') this.forceResume()
    this.pauseButton.setEnabled(enabled && this.state === 'running')
    this.pauseButton.setKeyboardFocus(false)
  }

  public isModalOpen(): boolean {
    return this.state !== 'running'
  }

  public destroy = (): void => {
    if (this.isDestroyed) return
    if (this.state !== 'running' && !this.isTransitioning) {
      this.getGameScene()?.scene.resume()
    }
    this.isDestroyed = true
    this.scene.input.keyboard?.off('keydown-ESC', this.onPauseToggle)
    this.scene.input.keyboard?.off('keydown-P', this.onPauseToggle)
    this.scene.input.keyboard?.off('keydown-M', this.onMuteToggle)
    this.scene.input.keyboard?.off('keydown-TAB', this.onNavigate)
    this.scene.input.keyboard?.off('keydown-UP', this.onNavigate)
    this.scene.input.keyboard?.off('keydown-DOWN', this.onNavigate)
    this.destroyOverlay()
    this.pauseButton.destroy()
    this.setMarker(null)
  }

  private readonly onPauseToggle = (): void => {
    if (!this.isEnabled || this.isTransitioning) return
    const gameScene = this.getGameScene() as (Phaser.Scene & { cancelPlacement?: () => boolean }) | null
    if (gameScene?.cancelPlacement?.()) return
    this.transition('toggle-pause')
  }

  private readonly onMuteToggle = (): void => {
    const current = getAudioSettings()
    setMuted(!current.muted)
    void saveAudioSettings(getAudioSettings()).catch(() => {
      // Audio persistence is non-blocking.
    })
  }

  private readonly onNavigate = (event: KeyboardEvent): void => {
    if (this.overlayButtons.length < 2 || this.audioPanel) return
    event.preventDefault()
    const step = event.key === 'ArrowUp' ? -1 : 1
    this.focusedButtonIndex =
      (this.focusedButtonIndex + step + this.overlayButtons.length) % this.overlayButtons.length
    this.overlayButtons.forEach((button, index) => button.setKeyboardFocus(index === this.focusedButtonIndex))
  }

  private transition(action: PauseMenuAction): void {
    if (this.isDestroyed || this.isTransitioning) return
    if (this.state === 'running' && action === 'toggle-pause' && !this.isGameSceneRunning()) return

    const previousState = this.state
    const nextState = resolvePauseMenuAction(previousState, action)
    const effect = resolvePauseMenuEffect(previousState, action)
    if (nextState === previousState && effect === 'none') return

    this.state = nextState
    this.applyEffect(effect)
    if (!this.isTransitioning) this.render()
  }

  private applyEffect(effect: PauseMenuEffect): void {
    const gameScene = this.getGameScene()
    if (effect === 'pause-game') {
      gameScene?.scene.pause()
      return
    }
    if (effect === 'resume-game') {
      gameScene?.scene.resume()
      return
    }
    if (effect === 'restart-run') {
      this.beginSceneTransition(() => {
        const manager = this.scene.game.scene
        manager.stop(this.scene.scene.key)
        manager.stop(GAME_SCENE_KEY)
        window.setTimeout(() => manager.start(GAME_SCENE_KEY), 0)
      })
      return
    }
    if (effect === 'go-main-menu') {
      this.beginSceneTransition(() => {
        this.scene.scene.start(MAIN_MENU_SCENE_KEY)
      })
    }
  }

  private beginSceneTransition(execute: () => void): void {
    this.isTransitioning = true
    this.destroyOverlay()
    this.setMarker(null)
    window.setTimeout(execute, 80)
  }

  private render(): void {
    this.destroyOverlay()
    this.pauseButton.setEnabled(this.isEnabled && this.state === 'running')
    this.pauseButton.setKeyboardFocus(false)

    if (this.state === 'running') {
      this.setMarker(null)
    } else if (this.state === 'paused') {
      this.renderPauseOverlay()
      this.setMarker('pause')
    } else if (this.state === 'options') {
      this.renderAudioOptions()
      this.setMarker('audio-options')
    } else if (this.state === 'confirm-restart') {
      this.renderConfirmation('Restart Run?', 'Restart now and lose this run progress.', 'confirm-restart')
      this.setMarker('confirm-restart')
    } else {
      this.renderConfirmation('Main Menu?', 'Abandon this run and return to the dojo menu.', 'confirm-menu')
      this.setMarker('confirm-menu')
    }
  }

  private renderPauseOverlay(): void {
    const cfg = CONFIG.ui.pauseMenu
    const centerX = CONFIG.screen.width / 2
    const centerY = CONFIG.screen.height / 2
    this.addOverlayFrame(cfg.panelWidth, cfg.panelHeight)
    this.overlayObjects.push(
      this.scene.add
        .text(centerX, centerY - 130, 'Paused', {
          fontSize: '24px',
          color: CONFIG.ui.textColor,
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
        .setDepth(cfg.depth + 2),
      this.scene.add
        .text(centerX, centerY - 102, 'Esc/P: resume · M: mute', {
          fontSize: '12px',
          color: CONFIG.ui.textColor,
        })
        .setOrigin(0.5)
        .setDepth(cfg.depth + 2),
    )

    const definitions: Array<[string, number, PauseMenuAction]> = [
      ['Resume', -55, 'resume'],
      ['Options', -5, 'open-options'],
      ['Restart Run', 45, 'request-restart'],
      ['Main Menu', 95, 'request-menu'],
    ]
    this.overlayButtons = definitions.map(([text, offsetY, action]) =>
      createSceneButton(this.scene, {
        x: centerX,
        y: centerY + offsetY,
        width: cfg.buttonWidth,
        text,
        depth: cfg.depth + 3,
        onActivate: () => this.transition(action),
      }),
    )
    this.focusFirstButton()
  }

  private renderConfirmation(titleText: string, bodyText: string, confirmAction: PauseMenuAction): void {
    const cfg = CONFIG.ui.pauseMenu
    const centerX = CONFIG.screen.width / 2
    const centerY = CONFIG.screen.height / 2
    this.addOverlayFrame(cfg.confirmPanelWidth, cfg.confirmPanelHeight)
    this.overlayObjects.push(
      this.scene.add
        .text(centerX, centerY - 54, titleText, {
          fontSize: '18px',
          color: CONFIG.ui.textColor,
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
        .setDepth(cfg.depth + 2),
      this.scene.add
        .text(centerX, centerY - 20, bodyText, {
          fontSize: '12px',
          color: CONFIG.ui.textColor,
          align: 'center',
        })
        .setOrigin(0.5)
        .setDepth(cfg.depth + 2),
    )
    this.confirmationReadyAt = this.scene.time.now + 120
    this.overlayButtons = [
      createSceneButton(this.scene, {
        x: centerX - 82,
        y: centerY + 48,
        width: cfg.confirmButtonWidth,
        text: 'Confirm',
        depth: cfg.depth + 3,
        onActivate: () => this.activateConfirmation(confirmAction),
      }),
      createSceneButton(this.scene, {
        x: centerX + 82,
        y: centerY + 48,
        width: cfg.confirmButtonWidth,
        text: 'Cancel',
        depth: cfg.depth + 3,
        onActivate: () => this.activateConfirmation('cancel'),
      }),
    ]
    this.focusButton(1)
  }

  private addOverlayFrame(width: number, height: number): void {
    const cfg = CONFIG.ui.pauseMenu
    this.overlayObjects.push(
      this.scene.add
        .rectangle(
          CONFIG.screen.width / 2,
          CONFIG.screen.height / 2,
          CONFIG.screen.width,
          CONFIG.screen.height,
          0x000000,
          0.48,
        )
        .setDepth(cfg.depth)
        .setInteractive()
        .on('pointerdown', (
          _pointer: Phaser.Input.Pointer,
          _localX: number,
          _localY: number,
          event: Phaser.Types.Input.EventData,
        ) => event.stopPropagation()),
      this.scene.add
        .rectangle(CONFIG.screen.width / 2, CONFIG.screen.height / 2, width, height, cfg.panelColor, 0.98)
        .setStrokeStyle(1, CONFIG.world.accentColor, 0.7)
        .setDepth(cfg.depth + 1),
    )
  }

  private renderAudioOptions(): void {
    this.audioPanel = new AudioSettingsPanel(this.scene, {
      x: CONFIG.screen.width / 2,
      y: CONFIG.screen.height / 2,
      baseDepth: CONFIG.ui.pauseMenu.depth + CONFIG.ui.pauseMenu.audioDepthOffset,
      onClose: () => this.transition('close-options'),
    })
  }

  private activateConfirmation(action: PauseMenuAction): void {
    if (this.scene.time.now < this.confirmationReadyAt) return
    this.transition(action)
  }

  private focusFirstButton(): void {
    this.focusButton(0)
  }

  private focusButton(index: number): void {
    this.focusedButtonIndex = index
    this.overlayButtons.forEach((button, buttonIndex) => button.setKeyboardFocus(buttonIndex === index))
  }

  private destroyOverlay(): void {
    const panel = this.audioPanel
    this.audioPanel = null
    panel?.destroy()
    this.overlayButtons.forEach((button) => button.destroy())
    this.overlayButtons = []
    this.overlayObjects.forEach((object) => object.destroy())
    this.overlayObjects = []
  }

  private forceResume(): void {
    this.getGameScene()?.scene.resume()
    this.state = 'running'
    this.render()
  }

  private setMarker(marker: PauseOverlayMarker): void {
    this.onModalChange?.(marker !== null)
    this.onOverlayMarker(marker)
  }

  private getGameScene(): Phaser.Scene | null {
    const gameScene = this.scene.scene.get(GAME_SCENE_KEY)
    if (!gameScene || !(gameScene.scene.isActive() || gameScene.scene.isPaused())) return null
    return gameScene
  }

  private isGameSceneRunning(): boolean {
    const gameScene = this.scene.scene.get(GAME_SCENE_KEY)
    return !!gameScene?.scene.isActive() && !gameScene.scene.isPaused()
  }
}
