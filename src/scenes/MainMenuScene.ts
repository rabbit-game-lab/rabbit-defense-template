import Phaser from 'phaser'
import { CONFIG } from '../game.config'
import {
  GAME_SCENE_KEY,
  MAIN_MENU_SCENE_KEY,
  resolveMenuEscapeAction,
  resolveMenuOptionsAction,
  resolveMenuStartTransition,
} from './flowContracts'
import { formatBestProfileResult } from '../ui/audioSettingsPanelRules'
import { createSceneButton, type SceneButtonHandle } from '../ui/createSceneButton'
import { AudioSettingsPanel } from '../ui/AudioSettingsPanel'
import { loadProfile } from '../systems/profileStore'
import type { ProfileRecord } from '../systems/profilePersistenceRules'

interface MenuProfileView {
  wins: number
  defeats: number
  bestLives: number
  bestCoins: number
  fastestWinMs: number
}

export default class MainMenuScene extends Phaser.Scene {
  private background!: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle
  private titleText!: Phaser.GameObjects.Text
  private subtitleText!: Phaser.GameObjects.Text
  private profileText!: Phaser.GameObjects.Text

  private playButton!: SceneButtonHandle
  private optionsButton!: SceneButtonHandle

  private audioPanel: AudioSettingsPanel | null = null

  private isStartingGame = false
  private isDestroyed = false
  private profileLoadEpoch = 0
  private focusedButton: 'play' | 'options' = 'play'

  private resolveBackgroundColor(color: string | number): number {
    if (typeof color === 'number') return Number.isFinite(color) ? color : 0x000000
    const parsed = Number.parseInt(color.replace(/^#/, ''), 16)
    return Number.isFinite(parsed) ? parsed : 0x000000
  }

  private readonly onEscape = (): void => {
    if (resolveMenuEscapeAction({ optionsOpen: this.audioPanel !== null }) === 'close-options') {
      this.closeAudioPanel()
    }
  }

  private readonly onNavigate = (event: KeyboardEvent): void => {
    if (this.audioPanel || this.isStartingGame) return
    event.preventDefault()
    this.setMenuFocus(this.focusedButton === 'play' ? 'options' : 'play')
  }

  constructor() {
    super(MAIN_MENU_SCENE_KEY)
  }

  create(): void {
    this.game.canvas.dataset.scene = 'main-menu'
    delete this.game.canvas.dataset.overlay
    this.input.keyboard?.on('keydown-ESC', this.onEscape)
    this.input.keyboard?.on('keydown-TAB', this.onNavigate)
    this.input.keyboard?.on('keydown-LEFT', this.onNavigate)
    this.input.keyboard?.on('keydown-RIGHT', this.onNavigate)

    const width = CONFIG.screen.width
    const height = CONFIG.screen.height

    if (this.textures.exists('world-board')) {
      const board = this.add.image(width / 2, height / 2, 'world-board')
      board.setOrigin(0.5)

      const scale = Math.max(width / board.width, height / board.height)
      board.setScale(scale)
      board.setAlpha(0.65)
      board.setTint(0x77aa77)
      this.background = board
    } else {
      this.background = this.add.rectangle(width / 2, height / 2, width, height, this.resolveBackgroundColor(CONFIG.world.backgroundColor))
    }

    this.add
      .rectangle(width / 2, CONFIG.ui.mainMenu.panelY, width, 200, CONFIG.ui.mainMenu.backgroundTint, CONFIG.ui.mainMenu.backgroundAlpha)
      .setDepth(1)

    this.titleText = this.add
      .text(width / 2, CONFIG.ui.mainMenu.panelY - 42, 'Hidden Dojo Defense', {
        color: CONFIG.ui.mainMenu.titleColor,
        fontSize: CONFIG.ui.mainMenu.titleFontSize,
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(2)

    this.subtitleText = this.add
      .text(width / 2, CONFIG.ui.mainMenu.panelY + 10, 'Defend the sacred dojo from night raiders', {
        color: CONFIG.ui.mainMenu.subtitleColor,
        fontSize: CONFIG.ui.mainMenu.subtitleFontSize,
      })
      .setOrigin(0.5)
      .setDepth(2)

    this.profileText = this.add
      .text(width / 2, CONFIG.ui.mainMenu.panelY + CONFIG.ui.mainMenu.summaryOffsetY + 70, 'Profile: loading…', {
        color: CONFIG.ui.audioPanel.valueColor,
        fontSize: '14px',
      })
      .setOrigin(0.5)
      .setDepth(2)

    this.playButton = createSceneButton(this, {
      x: width / 2 - CONFIG.ui.mainMenu.buttonSpacing / 2,
      y: CONFIG.ui.mainMenu.buttonY,
      width: 180,
      text: 'Play',
      onActivate: () => this.launchGame(),
      depth: 5,
    })
    this.optionsButton = createSceneButton(this, {
      x: width / 2 + CONFIG.ui.mainMenu.buttonSpacing / 2,
      y: CONFIG.ui.mainMenu.buttonY,
      width: 180,
      text: 'Options',
      onActivate: () => this.openAudioPanel(),
      depth: 5,
    })
    this.setMenuFocus('play')

    this.loadProfileSummaryAsync()
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup)
  }

  private async loadProfileSummaryAsync(): Promise<void> {
    const requestId = ++this.profileLoadEpoch
    this.profileText.setText('Profile: loading…')

    try {
      const profile = await loadProfile()
      if (this.isDestroyed || requestId !== this.profileLoadEpoch) return
      this.renderProfileSummary(profile)
    } catch {
      if (this.isDestroyed || requestId !== this.profileLoadEpoch) return
      this.renderProfileError()
    }
  }

  private renderProfileSummary(profile: ProfileRecord): void {
    const best = formatBestProfileResult(profile.bestLives, profile.bestCoins, profile.fastestWinMs)
    const record: MenuProfileView = {
      wins: profile.wins,
      defeats: profile.defeats,
      bestLives: profile.bestLives,
      bestCoins: profile.bestCoins,
      fastestWinMs: profile.fastestWinMs,
    }
    this.profileText.setText(
      `Record — Wins ${record.wins} | Losses ${record.defeats} | ${best} `,
    )
  }

  private renderProfileError(): void {
    this.profileText.setText('Profile: offline — unable to read records right now')
  }

  private openAudioPanel(): void {
    if (this.audioPanel) return
    const action = resolveMenuOptionsAction({ optionsOpen: this.audioPanel !== null, isStarting: this.isStartingGame })
    if (action === 'block-starting') return

    this.audioPanel = new AudioSettingsPanel(this, {
      x: CONFIG.screen.width / 2,
      y: CONFIG.screen.height / 2,
      onClose: () => {
        this.closeAudioPanel()
      },
    })
    this.game.canvas.dataset.overlay = 'audio-options'
    this.playButton.setEnabled(false)
    this.optionsButton.setEnabled(false)
  }

  private closeAudioPanel(): void {
    if (this.isDestroyed) {
      this.audioPanel?.destroy()
      this.audioPanel = null
      return
    }
    if (!this.audioPanel) return
    const panel = this.audioPanel
    this.audioPanel = null
    panel.destroy()
    delete this.game.canvas.dataset.overlay
    this.playButton.setEnabled(true)
    this.optionsButton.setEnabled(true)
    this.setMenuFocus('options')
  }

  private setMenuFocus(target: 'play' | 'options'): void {
    this.focusedButton = target
    this.playButton.setKeyboardFocus(target === 'play')
    this.optionsButton.setKeyboardFocus(target === 'options')
  }

  private launchGame(): void {
    const gameSceneIsActive = this.scene.get(GAME_SCENE_KEY)?.scene?.isActive() ?? false

    const transition = resolveMenuStartTransition({
      optionsOpen: this.audioPanel !== null,
      isStarting: this.isStartingGame,
      gameSceneActive: gameSceneIsActive,
    })

    if (!transition.didTransition) return

    this.isStartingGame = true
    this.playButton.setEnabled(false)
    this.optionsButton.setEnabled(false)

    if (gameSceneIsActive) {
      this.isStartingGame = false
      this.playButton.setEnabled(true)
      this.optionsButton.setEnabled(true)
      return
    }

    this.closeAudioPanel()
    this.time.delayedCall(0, () => {
      this.scene.start(GAME_SCENE_KEY)
    })
  }

  private cleanup = (): void => {
    if (this.isDestroyed) return
    this.isDestroyed = true

    this.input.keyboard?.off('keydown-ESC', this.onEscape)
    this.input.keyboard?.off('keydown-TAB', this.onNavigate)
    this.input.keyboard?.off('keydown-LEFT', this.onNavigate)
    this.input.keyboard?.off('keydown-RIGHT', this.onNavigate)

    this.closeAudioPanel()
    this.playButton.destroy()
    this.optionsButton.destroy()
  }

  shutdown(): void {
    this.cleanup()
  }
}
