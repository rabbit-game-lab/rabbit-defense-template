import Phaser from 'phaser'
import { CONFIG } from '../game.config'
import type { HudState } from './GameScene'

interface GameSceneBridge {
  getHudState: () => HudState
  upgradeSelectedTower: () => boolean
  sellSelectedTower: () => boolean
  skipOnboarding: () => void
}

interface SceneButton {
  bg: Phaser.GameObjects.Rectangle
  text: Phaser.GameObjects.Text
}

interface ResultPanel {
  bg: Phaser.GameObjects.Rectangle
  title: Phaser.GameObjects.Text
  resultLine: Phaser.GameObjects.Text
  statsLine: Phaser.GameObjects.Text
  recordsLine: Phaser.GameObjects.Text
  replay: SceneButton
}

export default class UIScene extends Phaser.Scene {
  private readonly onboardingPanel = {
    bg: undefined as Phaser.GameObjects.Rectangle | undefined,
    text: undefined as Phaser.GameObjects.Text | undefined,
    skipButton: undefined as SceneButton | undefined,
    canSkip: false,
  }

  private statsLine!: Phaser.GameObjects.Text
  private waveLine!: Phaser.GameObjects.Text
  private selectedLine!: Phaser.GameObjects.Text
  private statusLine!: Phaser.GameObjects.Text
  private previewLine!: Phaser.GameObjects.Text

  private upgradeButton!: SceneButton
  private sellButton!: SceneButton

  private resultPanel: ResultPanel | null = null
  private hasShownResult = false
  private replayedCurrentRun = false

  constructor() {
    super('UIScene')
  }

  create(): void {
    const hud = CONFIG.ui.hud

    this.add
      .rectangle(hud.topRowX, hud.topRowY + hud.topRowHeight / 2, hud.topRowWidth, hud.topRowHeight, CONFIG.ui.panelColor, 0.9)
      .setStrokeStyle(1, CONFIG.world.accentColor, 0.35)
    this.statsLine = this.add.text(18, hud.topRowY + 2, '', {
      fontSize: '14px',
      color: CONFIG.ui.textColor,
      fontStyle: 'bold',
    })
    this.waveLine = this.add.text(220, hud.topRowY + 2, '', {
      fontSize: '12px',
      color: CONFIG.ui.textColor,
      fontStyle: 'bold',
    })

    const bottomTop = hud.bottomY - hud.bottomHeight / 2
    this.add
      .rectangle(CONFIG.screen.width / 2, hud.bottomY, hud.bottomWidth, hud.bottomHeight, CONFIG.ui.panelColor, 0.86)
      .setStrokeStyle(1, CONFIG.world.accentColor, 0.28)

    this.selectedLine = this.add.text(hud.selectedTextX, bottomTop + hud.selectedLineY, '', {
      fontSize: hud.selectedFontSize,
      color: '#ffd56a',
      fontStyle: 'bold',
    })
    this.statusLine = this.add.text(hud.statusTextX, bottomTop + hud.statusLineY, '', {
      fontSize: hud.statusFontSize,
      color: CONFIG.ui.textColor,
    })
    this.previewLine = this.add.text(hud.statusTextX, bottomTop + hud.previewLineY, '', {
      fontSize: hud.previewFontSize,
      color: '#ffd56a',
    })

    const buttonY = hud.upgradeButtonY
    this.sellButton = this.createButton(hud.upgradeButtonX - 130, buttonY, 96, 'Sell', () => {
      const game = this.getGameScene()
      if (!game) return
      if (!game.sellSelectedTower()) return
    })
    this.sellButton.bg.setFillStyle(CONFIG.world.pathBorderColor, 0.2)

    this.upgradeButton = this.createButton(hud.upgradeButtonX, buttonY, 112, 'Upgrade', () => {
      const game = this.getGameScene()
      if (!game) return
      game.upgradeSelectedTower()
    })

    const onboarding = CONFIG.ui.onboarding
    this.onboardingPanel.bg = this.add
      .rectangle(onboarding.x, onboarding.y, onboarding.width, onboarding.height, CONFIG.ui.panelColor, 0.95)
      .setStrokeStyle(1, CONFIG.world.accentColor, 0.35)

    this.onboardingPanel.text = this.add
      .text(onboarding.x, onboarding.y, '', {
        fontSize: onboarding.textSize,
        color: CONFIG.ui.textColor,
        align: 'center',
        wordWrap: { width: Math.max(260, onboarding.width - 16) },
      })
      .setOrigin(0.5)

    this.onboardingPanel.skipButton = this.createButton(
      onboarding.x + onboarding.width / 2 - 38,
      onboarding.y - onboarding.height / 2 + 16,
      58,
      'Skip',
      () => {
        const game = this.getGameScene()
        if (!game || !this.onboardingPanel.canSkip) return
        game.skipOnboarding()
      },
    )

    this.resultPanel = this.createResultPanel()
    this.hideResultPanel()
    this.hasShownResult = false
    this.replayedCurrentRun = false

    this.setButtonEnabled(this.upgradeButton, false)
    this.setButtonEnabled(this.sellButton, false)
    this.onboardingPanel.skipButton.bg.setVisible(false)
  }

  update(): void {
    const game = this.getGameScene()
    if (!game) return

    const hud = game.getHudState()

    this.statsLine.setText(`Ryo ${hud.coins}   Dojo HP ${hud.lives}`)
    this.waveLine.setText(hud.waveLabel)

    if (!hud.selectedTower) {
      this.selectedLine.setText('Defense: none')
      this.setButtonEnabled(this.upgradeButton, false)
      this.setButtonEnabled(this.sellButton, false)
      this.upgradeButton.text.setText('Upgrade · 0 ryo')
      this.previewLine.setText('No defense selected.')
      this.statusLine.setText(hud.status)
    } else {
      this.selectedLine.setText(
        `${hud.selectedTower.name} L${hud.selectedTower.level} (DMG ${hud.selectedTower.damage}, RNG ${hud.selectedTower.range}, ATK ${hud.selectedTower.fireRateMs}ms)`,
      )
      this.statusLine.setText(hud.status)
      this.previewLine.setText(
        hud.selectedTower.maxed
          ? `MAX level. Sell for ${hud.selectedTower.sellRefund} ryo.`
          : `Next: ${hud.selectedTower.upgrade.summary}`,
      )
      this.upgradeButton.text.setText(`Upgrade · ${hud.selectedTower.upgradeCost} ryo`)
      this.setButtonEnabled(this.upgradeButton, !hud.selectedTower.maxed && hud.selectedTower.affordable)
      this.setButtonEnabled(this.sellButton, hud.selectedTower.sellEnabled)
    }

    this.renderOnboarding(hud)
    this.renderResultPanel(hud)
  }

  private renderOnboarding(hud: HudState): void {
    if (!this.onboardingPanel.bg || !this.onboardingPanel.text || !this.onboardingPanel.skipButton) return

    const shouldShow = hud.onboardingStep !== 'complete'
    this.onboardingPanel.bg.setVisible(shouldShow)
    this.onboardingPanel.text.setVisible(shouldShow)
    if (!shouldShow) {
      this.onboardingPanel.canSkip = false
      this.onboardingPanel.skipButton.bg.setVisible(false)
      return
    }

    this.onboardingPanel.text.setText(hud.onboardingInstruction)

    this.onboardingPanel.canSkip = shouldShow
    const showSkip = this.onboardingPanel.canSkip
    this.onboardingPanel.skipButton.bg.setVisible(showSkip)
    this.onboardingPanel.skipButton.text.setVisible(showSkip)
    this.setButtonEnabled(this.onboardingPanel.skipButton, showSkip)
  }

  private renderResultPanel(hud: HudState): void {
    if (!this.resultPanel) return
    const result = hud.result

    if (!result) {
      if (this.hasShownResult) {
        this.hideResultPanel()
      }
      return
    }

    if (!this.hasShownResult) {
      this.hasShownResult = true
      this.replayedCurrentRun = false
      this.resultPanel.bg.setVisible(true)
      this.resultPanel.title.setVisible(true)
      this.resultPanel.resultLine.setVisible(true)
      this.resultPanel.statsLine.setVisible(true)
      this.resultPanel.recordsLine.setVisible(true)
      this.setButtonEnabled(this.resultPanel.replay, true)
      this.resultPanel.replay.bg.setVisible(true)
      this.resultPanel.replay.text.setVisible(true)
      this.resultPanel.replay.bg.on('pointerdown', () => this.handleReplay())
    }

    this.resultPanel.title.setText(result.outcome === 'victory' ? 'Dojo Secured: Victory' : 'Dojo Fallen: Defeat')
    this.resultPanel.resultLine.setText(
      `Raids: ${result.wavesCleared}/${result.wavesReached} • Defeated ${result.kills} • Breaches ${result.leaks} • ${Math.round(result.durationMs / 1000)}s`,
    )
    this.resultPanel.statsLine.setText(`Dojo HP: ${result.livesRemaining}   Ryo: ${result.coinsRemaining}`)
    this.resultPanel.recordsLine.setText(
      `Profile — Wins ${hud.profile.wins}  Losses ${hud.profile.defeats}  Best Dojo HP ${hud.profile.bestLives}  Best Ryo ${hud.profile.bestCoins}  Fastest ${hud.profile.fastestWinMs}ms`,
    )
  }

  private handleReplay(): void {
    if (this.replayedCurrentRun) return
    this.replayedCurrentRun = true

    const game = this.getGameScene()
    if (!game) return

    game.scene.restart()
    this.scene.restart()
  }

  private hideResultPanel(): void {
    if (!this.resultPanel) return
    this.hasShownResult = false
    this.resultPanel.bg.setVisible(false)
    this.resultPanel.title.setVisible(false)
    this.resultPanel.resultLine.setVisible(false)
    this.resultPanel.statsLine.setVisible(false)
    this.resultPanel.recordsLine.setVisible(false)
    this.resultPanel.replay.bg.setVisible(false)
    this.resultPanel.replay.text.setVisible(false)
    this.resultPanel.replay.bg.removeAllListeners('pointerdown')
    this.setButtonEnabled(this.resultPanel.replay, false)
  }

  private createResultPanel(): ResultPanel {
    const x = CONFIG.screen.width / 2
    const y = 292

    const bg = this.add.rectangle(x, y + 2, 500, 112, CONFIG.ui.panelColor, 0.94).setStrokeStyle(2, CONFIG.world.accentColor, 0.45)
    const title = this.add.text(x, y - 28, '', {
      fontSize: '16px',
      color: '#fff4cf',
      fontStyle: 'bold',
    }).setOrigin(0.5)
    const resultLine = this.add.text(x, y - 4, '', {
      fontSize: '12px',
      color: CONFIG.ui.textColor,
    }).setOrigin(0.5)
    const statsLine = this.add.text(x, y + 16, '', {
      fontSize: '12px',
      color: CONFIG.ui.textColor,
    }).setOrigin(0.5)
    const recordsLine = this.add.text(x, y + 34, '', {
      fontSize: '12px',
      color: CONFIG.ui.textColor,
    }).setOrigin(0.5)

    const replay = this.createButton(x, y + 52, 140, 'Replay', () => {
      // replaced by explicit listener in renderResultPanel
    })

    return { bg, title, resultLine, statsLine, recordsLine, replay }
  }

  private createButton(x: number, y: number, width: number, label: string, onPress: () => void): SceneButton {
    const safeWidth = Math.max(width, CONFIG.ui.shop.minTouchablePx)
    const safeHeight = Math.max(CONFIG.ui.hud.upgradeButtonHeight, CONFIG.ui.shop.minTouchablePx)
    const bg = this.add
      .rectangle(x, y, safeWidth, safeHeight, CONFIG.world.pathBorderColor, 0.25)
      .setStrokeStyle(1, CONFIG.world.accentColor, 0.35)
      .setInteractive()
    const text = this.add
      .text(x, y, label, {
        fontSize: '12px',
        color: CONFIG.ui.textColor,
        fontStyle: 'bold',
      })
      .setOrigin(0.5)

    bg.on('pointerdown', () => onPress())
    bg.on('pointerover', () => this.input.setDefaultCursor('pointer'))
    bg.on('pointerout', () => this.input.setDefaultCursor('default'))

    return { bg, text }
  }

  private setButtonEnabled(button: SceneButton, enabled: boolean): void {
    button.bg.setAlpha(enabled ? 1 : 0.44)
    button.text.setAlpha(enabled ? 1 : 0.6)
    button.bg.disableInteractive()
    if (enabled) button.bg.setInteractive()
  }

  private getGameScene(): (Phaser.Scene & GameSceneBridge) | null {
    const scene = this.scene.get('GameScene') as (Phaser.Scene & GameSceneBridge) | undefined
    if (!scene || !scene.scene?.isActive()) return null
    return scene
  }
}
