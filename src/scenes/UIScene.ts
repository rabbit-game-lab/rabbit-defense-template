import Phaser from 'phaser'
import { CONFIG } from '../game.config'
import { SHOP_TOWER_ORDER, type TowerType } from '../data/towerDefense'
import { createSceneButton, type SceneButtonHandle } from '../ui/createSceneButton'
import { PauseMenuController, type PauseOverlayMarker } from '../ui/PauseMenuController'
import { ResultPanelController } from '../ui/ResultPanelController'
import { createPortraitOrientationGate } from '../ui/createPortraitOrientationGate'
import { GAME_SCENE_KEY, MAIN_MENU_SCENE_KEY } from './flowContracts'
import type { HudState } from './GameScene'
import { isReducedEffectsEnabled } from '../systems/accessibilitySettingsStore'

interface GameSceneBridge {
  getHudState(): HudState
  upgradeSelectedTower(): boolean
  sellSelectedTower(): boolean
  skipOnboarding(): void
  setUiBlocked(blocked: boolean): void
  beginPlacement(type: TowerType): boolean
  cancelPlacement(): boolean
  placeOnPad(padId: string): boolean
  selectTower(towerId: string): boolean
  focusPad(padId: string): boolean
}

export default class UIScene extends Phaser.Scene {
  private statsLine!: Phaser.GameObjects.Text
  private changeLine!: Phaser.GameObjects.Text
  private waveLine!: Phaser.GameObjects.Text
  private selectedLine!: Phaser.GameObjects.Text
  private statusLine!: Phaser.GameObjects.Text
  private previewLine!: Phaser.GameObjects.Text
  private onboardingObjects: Array<Phaser.GameObjects.Rectangle | Phaser.GameObjects.Text> = []
  private onboardingText!: Phaser.GameObjects.Text
  private skipButton!: SceneButtonHandle
  private upgradeButton!: SceneButtonHandle
  private sellButton!: SceneButtonHandle
  private resultPanel!: ResultPanelController
  private pauseMenuController!: PauseMenuController
  private modalSources = new Set<string>()
  private sellConfirmationUntil = 0
  private sellConfirmationTowerId = ''
  private shopIndex = 0
  private padIndex = 0
  private towerIndex = -1
  private actionIndex = -1
  private previousCoins?: number
  private previousLives?: number
  private changeHideAt = 0

  constructor() {
    super('UIScene')
  }

  create(): void {
    this.createHud()
    this.createOnboarding()
    this.createActions()
    this.resultPanel = new ResultPanelController(this, {
      onReplay: () => this.restartRun(),
      onMainMenu: () => this.goMainMenu(),
      onVisibilityChange: (visible) => this.setModalSource('result', visible),
    })
    const pauseButton = createSceneButton(this, {
      x: CONFIG.ui.pauseMenu.buttonX,
      y: CONFIG.ui.pauseMenu.buttonY,
      width: CONFIG.ui.pauseMenu.buttonSize,
      height: CONFIG.ui.pauseMenu.buttonSize,
      text: 'Ⅱ',
      depth: CONFIG.ui.pauseMenu.depth - 1,
      onActivate: () => this.pauseMenuController.activatePauseButton(),
    })
    this.pauseMenuController = new PauseMenuController({
      scene: this,
      pauseButton,
      onOverlayMarker: (marker) => this.setOverlayMarker(marker),
      onModalChange: (open) => this.setModalSource('pause', open),
    })
    createPortraitOrientationGate(this, {
      getPauseStatus: () => {
        const game = this.getGameScene()
        if (!game) return 'inactive'
        return game.scene.isPaused() ? 'paused' : game.scene.isActive() ? 'running' : 'inactive'
      },
      pause: () => this.getGameScene()?.scene.pause(),
      resume: () => this.getGameScene()?.scene.resume(),
      canResumeFromOrientationGate: () => !this.pauseMenuController.isModalOpen(),
      setUiBlocked: (blocked) => this.setModalSource('orientation', blocked),
    }, (active) => this.setOverlayMarker(active ? 'orientation' : null))
    this.input.keyboard?.on('keydown', this.onGameplayKey)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off('keydown', this.onGameplayKey)
    })
  }

  update(): void {
    const game = this.getGameScene()
    if (!game) return
    const hud = game.getHudState()
    this.pauseMenuController.setEnabled(!hud.result)
    this.renderTopHud(hud)
    this.renderSelection(hud)
    this.renderOnboarding(hud)
    this.resultPanel.render(hud)
  }

  private createHud(): void {
    const hud = CONFIG.ui.hud
    this.add.rectangle(hud.topRowX, hud.topRowY + hud.topRowHeight / 2, hud.topRowWidth, hud.topRowHeight, CONFIG.ui.panelColor, 0.94)
      .setStrokeStyle(1, CONFIG.world.accentColor, 0.45)
    this.statsLine = this.add.text(18, hud.topRowY + 8, '', { fontSize: '16px', color: CONFIG.ui.textColor, fontStyle: 'bold' })
    this.changeLine = this.add.text(18, hud.topRowY + 32, '', { fontSize: '12px', color: '#bde88f', fontStyle: 'bold' })
    this.waveLine = this.add.text(250, hud.topRowY + 9, '', { fontSize: '15px', color: CONFIG.ui.textColor, fontStyle: 'bold' })
    const bottomTop = hud.bottomY - hud.bottomHeight / 2
    this.add.rectangle(CONFIG.screen.width / 2, hud.bottomY, hud.bottomWidth, hud.bottomHeight, CONFIG.ui.panelColor, 0.94)
      .setStrokeStyle(1, CONFIG.world.accentColor, 0.4)
    this.selectedLine = this.add.text(hud.selectedTextX, bottomTop + hud.selectedLineY, '', {
      fontSize: hud.selectedFontSize, color: '#ffd56a', fontStyle: 'bold',
    })
    this.statusLine = this.add.text(hud.statusTextX, bottomTop + hud.statusLineY, '', {
      fontSize: hud.statusFontSize, color: CONFIG.ui.textColor,
    })
    this.previewLine = this.add.text(hud.statusTextX, bottomTop + hud.previewLineY, '', {
      fontSize: hud.previewFontSize, color: '#ffd56a',
    })
  }

  private createActions(): void {
    const hud = CONFIG.ui.hud
    this.sellButton = createSceneButton(this, {
      x: hud.upgradeButtonX - 142, y: hud.upgradeButtonY, width: 112, text: 'Sell',
      onActivate: () => this.handleSell(),
    })
    this.upgradeButton = createSceneButton(this, {
      x: hud.upgradeButtonX, y: hud.upgradeButtonY, width: hud.upgradeButtonWidth, text: 'Upgrade',
      onActivate: () => this.getGameScene()?.upgradeSelectedTower(),
    })
  }

  private createOnboarding(): void {
    const cfg = CONFIG.ui.onboarding
    const bg = this.add.rectangle(cfg.x, cfg.y, cfg.width, cfg.height, CONFIG.ui.panelColor, 0.97)
      .setStrokeStyle(2, CONFIG.world.accentColor, 0.55)
    this.onboardingText = this.add.text(cfg.x - 18, cfg.y, '', {
      fontSize: cfg.textSize, color: CONFIG.ui.textColor, align: 'center',
      wordWrap: { width: cfg.width - 120 },
    }).setOrigin(0.5)
    this.skipButton = createSceneButton(this, {
      x: cfg.x + cfg.width / 2 - 36, y: cfg.y, width: 72, height: 56, text: 'Skip',
      onActivate: () => this.getGameScene()?.skipOnboarding(),
    })
    this.onboardingObjects = [bg, this.onboardingText]
  }

  private renderTopHud(hud: HudState): void {
    this.statsLine.setText(`Ryo ${hud.coins}   Dojo HP ${hud.lives}`)
    const seconds = Math.max(0, Math.ceil(hud.nextWaveInMs / 1000))
    const bossWarning = hud.wave === hud.totalWaves && hud.wavePhase !== 'active' && hud.wavePhase !== 'complete'
    const raidDetail =
      hud.wavePhase === 'preparing' && hud.nextWaveInMs <= 0
        ? 'Place a defense'
        : hud.wavePhase === 'active'
          ? `${hud.enemiesToSpawn + hud.activeEnemies} left`
          : hud.wavePhase === 'complete'
            ? 'All clear'
            : `Starts in ${seconds}s`
    this.waveLine.setText(
      bossWarning ? `Raid ${hud.wave}/${hud.totalWaves} · BOSS IN ${seconds}` : `Raid ${hud.wave}/${hud.totalWaves} · ${raidDetail}`,
    ).setColor(bossWarning ? '#ffaaa0' : CONFIG.ui.textColor)
    const coinDelta = this.previousCoins === undefined ? 0 : hud.coins - this.previousCoins
    const hpDelta = this.previousLives === undefined ? 0 : hud.lives - this.previousLives
    if ((coinDelta !== 0 || hpDelta !== 0) && !isReducedEffectsEnabled()) {
      this.changeLine.setText(coinDelta !== 0 ? `${coinDelta > 0 ? '+' : ''}${coinDelta} Ryo` : `${hpDelta} Dojo HP`)
        .setColor(hpDelta < 0 ? '#ffaaa0' : '#bde88f').setVisible(true)
      this.changeHideAt = this.time.now + CONFIG.ui.status.changeFeedbackMs
    } else if (this.time.now >= this.changeHideAt) {
      this.changeLine.setVisible(false)
    }
    this.previousCoins = hud.coins
    this.previousLives = hud.lives
  }

  private renderSelection(hud: HudState): void {
    const tower = hud.selectedTower
    this.statusLine.setText(hud.status)
    if (!tower) {
      this.selectedLine.setText('No defense selected')
      this.previewLine.setText(hud.placement.pendingTowerType ? 'Choose a free ＋ seal.' : 'Choose a defense card to build.')
      this.upgradeButton.setText('Upgrade')
      this.upgradeButton.setEnabled(false)
      this.sellButton.setText('Sell')
      this.sellButton.setEnabled(false)
      return
    }
    this.selectedLine.setText(`${tower.name} · Level ${tower.level} · ${tower.type === 'arrow' ? 'Fast' : tower.type === 'frost' ? 'Slow' : 'Splash'}`)
    const shortfall = Math.max(0, tower.upgradeCost - hud.coins)
    this.previewLine.setText(tower.maxed ? `Maximum level · Sell refund ${tower.sellRefund} Ryo` : tower.affordable ? tower.upgrade.summary : `${tower.upgrade.summary} · Need ${shortfall} more Ryo`)
    this.upgradeButton.setText(tower.maxed ? 'Max Level' : `Upgrade · ${tower.upgradeCost}`)
    this.upgradeButton.setEnabled(!tower.maxed && tower.affordable)
    const confirming = this.sellConfirmationTowerId === tower.id && this.time.now < this.sellConfirmationUntil
    this.sellButton.setText(confirming ? `Confirm · +${tower.sellRefund}` : `Sell · +${tower.sellRefund}`)
    this.sellButton.setEnabled(tower.sellEnabled)
    if (!confirming && this.sellConfirmationTowerId === tower.id) this.sellConfirmationTowerId = ''
  }

  private renderOnboarding(hud: HudState): void {
    const visible = hud.onboardingStep !== 'complete' && !hud.result
    this.onboardingObjects.forEach((object) => object.setVisible(visible))
    this.onboardingText.setText(hud.onboardingInstruction)
    this.skipButton.setEnabled(visible)
    this.skipButton.setVisible(visible)
  }

  private handleSell(): void {
    const game = this.getGameScene()
    const tower = game?.getHudState().selectedTower
    if (!game || !tower) return
    if (this.sellConfirmationTowerId === tower.id && this.time.now < this.sellConfirmationUntil) {
      game.sellSelectedTower()
      this.sellConfirmationTowerId = ''
      return
    }
    this.sellConfirmationTowerId = tower.id
    this.sellConfirmationUntil = this.time.now + CONFIG.ui.status.sellConfirmMs
  }

  private readonly onGameplayKey = (event: KeyboardEvent): void => {
    if (this.modalSources.size > 0) return
    const game = this.getGameScene()
    if (!game) return
    const hud = game.getHudState()
    if (/^[123]$/.test(event.key)) {
      this.shopIndex = Number(event.key) - 1
      game.beginPlacement(SHOP_TOWER_ORDER[this.shopIndex])
      game.focusPad(hud.placement.pads[this.padIndex]?.id ?? '')
      return
    }
    if (event.key === '[' || event.key === ']') {
      this.shopIndex = (this.shopIndex + (event.key === '[' ? 2 : 1)) % SHOP_TOWER_ORDER.length
      game.beginPlacement(SHOP_TOWER_ORDER[this.shopIndex])
      game.focusPad(hud.placement.pads[this.padIndex]?.id ?? '')
      return
    }
    if ((event.key === 'ArrowUp' || event.key === 'ArrowDown') && hud.placement.pendingTowerType) {
      event.preventDefault()
      const step = event.key === 'ArrowUp' ? -1 : 1
      this.padIndex = (this.padIndex + step + hud.placement.pads.length) % hud.placement.pads.length
      game.focusPad(hud.placement.pads[this.padIndex]?.id ?? '')
      return
    }
    if ((event.key === 'Enter' || event.key === ' ') && hud.placement.pendingTowerType) {
      event.preventDefault()
      game.placeOnPad(hud.placement.pads[this.padIndex]?.id ?? '')
      return
    }
    if (event.key === 'Tab' && hud.placement.towerIds.length > 0) {
      event.preventDefault()
      this.towerIndex = (this.towerIndex + (event.shiftKey ? -1 : 1) + hud.placement.towerIds.length) % hud.placement.towerIds.length
      game.selectTower(hud.placement.towerIds[this.towerIndex])
    } else if (event.key.toLowerCase() === 'a' && hud.selectedTower) {
      this.actionIndex = this.actionIndex === 0 ? 1 : 0
      this.upgradeButton.setKeyboardFocus(this.actionIndex === 0)
      this.sellButton.setKeyboardFocus(this.actionIndex === 1)
    } else if ((event.key === 'Enter' || event.key === ' ') && this.actionIndex >= 0) {
      event.preventDefault()
      if (this.actionIndex === 0) game.upgradeSelectedTower()
      else this.handleSell()
    } else if (event.key.toLowerCase() === 'u') {
      game.upgradeSelectedTower()
    } else if (event.key.toLowerCase() === 's') {
      this.handleSell()
    }
  }

  private restartRun(): void {
    window.setTimeout(() => {
      const manager = this.game.scene
      manager.stop(this.scene.key)
      manager.stop(GAME_SCENE_KEY)
      window.setTimeout(() => manager.start(GAME_SCENE_KEY), 0)
    }, 80)
  }

  private goMainMenu(): void {
    window.setTimeout(() => {
      this.scene.start(MAIN_MENU_SCENE_KEY)
    }, 80)
  }

  private setModalSource(source: string, active: boolean): void {
    if (active) this.modalSources.add(source)
    else this.modalSources.delete(source)
    this.getGameScene()?.setUiBlocked(this.modalSources.size > 0)
  }

  private setOverlayMarker(marker: PauseOverlayMarker | 'orientation'): void {
    if (marker) this.game.canvas.dataset.overlay = marker
    else if (this.modalSources.has('pause')) this.game.canvas.dataset.overlay = 'pause'
    else if (this.modalSources.has('result')) this.game.canvas.dataset.overlay = 'result'
    else if (this.modalSources.size === 0) delete this.game.canvas.dataset.overlay
  }

  private getGameScene(): (Phaser.Scene & GameSceneBridge) | null {
    const scene = this.scene.get(GAME_SCENE_KEY) as (Phaser.Scene & GameSceneBridge) | undefined
    return scene && (scene.scene.isActive() || scene.scene.isPaused()) ? scene : null
  }
}
