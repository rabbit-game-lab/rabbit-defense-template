import Phaser from 'phaser'
import { CONFIG } from '../game.config'
import { createSceneButton, type SceneButtonHandle } from '../ui/createSceneButton'
import { PauseMenuController, type PauseOverlayMarker } from '../ui/PauseMenuController'
import { ResultPanelController } from '../ui/ResultPanelController'
import { createPortraitOrientationGate } from '../ui/createPortraitOrientationGate'
import { GameplayFocusController, type GameSceneBridge } from '../ui/GameplayFocusController'
import { createTextFitter } from '../ui/fitText'
import { GAME_SCENE_KEY, MAIN_MENU_SCENE_KEY } from './flowContracts'
import type { HudState } from './GameScene'
import { isReducedEffectsEnabled } from '../systems/accessibilitySettingsStore'

export default class UIScene extends Phaser.Scene {
  private statsLine!: Phaser.GameObjects.Text
  private changeLine!: Phaser.GameObjects.Text
  private waveLine!: Phaser.GameObjects.Text
  private selectedLine!: Phaser.GameObjects.Text
  private statusLine!: Phaser.GameObjects.Text
  private previewLine!: Phaser.GameObjects.Text
  private keyboardHintLine!: Phaser.GameObjects.Text
  private onboardingObjects: Array<Phaser.GameObjects.Rectangle | Phaser.GameObjects.Text> = []
  private onboardingText!: Phaser.GameObjects.Text
  private skipButton!: SceneButtonHandle
  private upgradeButton!: SceneButtonHandle
  private sellButton!: SceneButtonHandle
  private targetButton!: SceneButtonHandle
  private speedButton!: SceneButtonHandle
  private pauseButton!: SceneButtonHandle
  private resultPanel!: ResultPanelController
  private pauseMenuController!: PauseMenuController
  private focus!: GameplayFocusController
  private modalSources = new Set<string>()
  private sellConfirmationUntil = 0
  private sellConfirmationTowerId = ''
  private lastSelectedTowerId = ''
  private previousCoins?: number
  private previousLives?: number
  private changeHideAt = 0
  private fitSelected!: (raw: string) => void
  private fitStatus!: (raw: string) => void
  private fitPreview!: (raw: string) => void
  private fitHint!: (raw: string) => void
  private fitWave!: (raw: string) => void

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
    this.pauseButton = createSceneButton(this, {
      x: CONFIG.ui.pauseMenu.buttonX, y: CONFIG.ui.pauseMenu.buttonY,
      width: CONFIG.ui.pauseMenu.buttonSize, height: CONFIG.ui.pauseMenu.buttonSize,
      text: 'Ⅱ', depth: CONFIG.ui.pauseMenu.depth - 1,
      onActivate: () => this.pauseMenuController.activatePauseButton(),
    })
    this.pauseMenuController = new PauseMenuController({
      scene: this,
      pauseButton: this.pauseButton,
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
    this.focus = new GameplayFocusController({
      getGameScene: () => this.getGameScene(),
      isModalOpen: () => this.modalSources.size > 0,
      forwardToModal: (event) => this.pauseMenuController.handleKeyboardEvent(event),
      requestSell: () => this.handleSell(),
      clearSellConfirmation: () => {
        if (!this.sellConfirmationTowerId) return false
        this.sellConfirmationTowerId = ''
        return true
      },
      buttons: () => ({
        upgrade: this.upgradeButton,
        sell: this.sellButton,
        target: this.targetButton,
        pause: this.pauseButton,
      }),
    })
    this.input.keyboard?.on('keydown', this.focus.handleKey)
    this.input.on('pointerdown', this.focus.handlePointerInput)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off('keydown', this.focus.handleKey)
      this.input.off('pointerdown', this.focus.handlePointerInput)
    })
    this.focus.applyFocus()
  }

  update(): void {
    const game = this.getGameScene()
    if (!game) return
    const hud = game.getHudState()
    this.pauseMenuController.setEnabled(!hud.result)
    this.focus.reconcile(hud)
    this.renderTopHud(hud)
    this.renderSelection(hud)
    this.renderOnboarding(hud)
    this.renderKeyboardHint()
    this.resultPanel.render(hud)
  }

  private createHud(): void {
    const hud = CONFIG.ui.hud
    this.add.rectangle(hud.topRowX, hud.topRowY + hud.topRowHeight / 2, hud.topRowWidth, hud.topRowHeight, CONFIG.ui.panelColor, 0.94)
      .setStrokeStyle(1, CONFIG.world.accentColor, 0.45)
    this.statsLine = this.add.text(18, hud.topRowY + 8, '', { fontSize: '16px', color: CONFIG.ui.textColor, fontStyle: 'bold' })
    this.changeLine = this.add.text(18, hud.topRowY + 32, '', { fontSize: '12px', color: CONFIG.ui.colors.positive, fontStyle: 'bold' })
    this.waveLine = this.add.text(hud.waveTextX, hud.topRowY + 9, '', { fontSize: '15px', color: CONFIG.ui.textColor, fontStyle: 'bold' })
    const bottomTop = hud.bottomY - hud.bottomHeight / 2
    this.add.rectangle(CONFIG.screen.width / 2, hud.bottomY, hud.bottomWidth, hud.bottomHeight, CONFIG.ui.panelColor, 0.94)
      .setStrokeStyle(1, CONFIG.world.accentColor, 0.4)
    // One left-hand column: every row starts at textLeftX and stops at textZoneRightX,
    // which is what keeps these clear of the action buttons.
    this.selectedLine = this.add.text(hud.textLeftX, bottomTop + hud.selectedLineY, '', { fontSize: hud.selectedFontSize, color: CONFIG.ui.colors.accentText, fontStyle: 'bold' })
    this.statusLine = this.add.text(hud.textLeftX, bottomTop + hud.statusLineY, '', { fontSize: hud.statusFontSize, color: CONFIG.ui.textColor })
    this.previewLine = this.add.text(hud.textLeftX, bottomTop + hud.previewLineY, '', { fontSize: hud.previewFontSize, color: CONFIG.ui.colors.accentText })
    this.keyboardHintLine = this.add.text(hud.textLeftX, bottomTop + hud.hintLineY, '', { fontSize: hud.hintFontSize, color: CONFIG.ui.colors.hint, fontStyle: 'bold' }).setVisible(false)

    const zone = hud.textZoneRightX - hud.textLeftX
    this.fitSelected = createTextFitter(this.selectedLine, zone)
    this.fitStatus = createTextFitter(this.statusLine, zone)
    this.fitPreview = createTextFitter(this.previewLine, zone)
    this.fitHint = createTextFitter(this.keyboardHintLine, zone)
    this.fitWave = createTextFitter(this.waveLine, hud.waveZoneRightX - hud.waveTextX)
  }

  private createActions(): void {
    const hud = CONFIG.ui.hud
    const y = hud.actionButtonY
    this.targetButton = createSceneButton(this, { x: hud.targetButtonX, y, width: hud.targetButtonWidth, text: 'Target: First', onActivate: () => this.getGameScene()?.cycleSelectedTowerTargetMode() })
    this.sellButton = createSceneButton(this, { x: hud.sellButtonX, y, width: hud.sellButtonWidth, text: 'Sell', onActivate: () => this.handleSell() })
    this.upgradeButton = createSceneButton(this, { x: hud.upgradeButtonX, y, width: hud.upgradeButtonWidth, text: 'Upgrade', onActivate: () => this.getGameScene()?.upgradeSelectedTower() })
    this.speedButton = createSceneButton(this, { x: hud.speedButtonX, y: CONFIG.ui.pauseMenu.buttonY, width: CONFIG.ui.pauseMenu.buttonSize, height: CONFIG.ui.pauseMenu.buttonSize, text: '1×', depth: CONFIG.ui.pauseMenu.depth - 1, onActivate: () => this.getGameScene()?.toggleGameSpeed() })
  }

  private createOnboarding(): void {
    const cfg = CONFIG.ui.onboarding
    const bg = this.add.rectangle(cfg.x, cfg.y, cfg.width, cfg.height, CONFIG.ui.panelColor, 0.97)
      .setStrokeStyle(2, CONFIG.world.accentColor, 0.55)
    this.onboardingText = this.add.text(cfg.x - 18, cfg.y, '', {
      fontSize: cfg.textSize, color: CONFIG.ui.textColor, align: 'center', wordWrap: { width: cfg.width - 120 },
    }).setOrigin(0.5)
    this.skipButton = createSceneButton(this, {
      x: cfg.x + cfg.width / 2 - 36, y: cfg.y, width: 72, height: 56, text: 'Skip',
      onActivate: () => this.getGameScene()?.skipOnboarding(),
    })
    this.onboardingObjects = [bg, this.onboardingText]
  }

  private renderTopHud(hud: HudState): void {
    this.statsLine.setText(`Ryo ${hud.coins}   Dojo HP ${hud.lives}`)
    this.speedButton.setText(`${hud.gameSpeed}×`)
    const seconds = Math.max(0, Math.ceil(hud.nextWaveInMs / 1000))
    const bossWarning = hud.wave === hud.totalWaves && hud.wavePhase !== 'active' && hud.wavePhase !== 'complete'
    const detail = hud.wavePhase === 'preparing' && hud.nextWaveInMs <= 0 ? 'Build now'
      : hud.wavePhase === 'active' ? `${hud.enemiesToSpawn + hud.activeEnemies} left`
        : hud.wavePhase === 'complete' ? 'All clear' : `Next in ${seconds}s`
    this.fitWave(bossWarning ? `Raid ${hud.wave}/${hud.totalWaves} · BOSS IN ${seconds}` : `Raid ${hud.wave}/${hud.totalWaves} · ${detail}`)
    this.waveLine.setColor(bossWarning ? CONFIG.ui.colors.danger : CONFIG.ui.textColor)
    const coinDelta = this.previousCoins === undefined ? 0 : hud.coins - this.previousCoins
    const hpDelta = this.previousLives === undefined ? 0 : hud.lives - this.previousLives
    if ((coinDelta || hpDelta) && !isReducedEffectsEnabled()) {
      this.changeLine.setText(coinDelta ? `${coinDelta > 0 ? '+' : ''}${coinDelta} Ryo` : `${hpDelta} Dojo HP`)
        .setColor(hpDelta < 0 ? CONFIG.ui.colors.danger : CONFIG.ui.colors.positive).setVisible(true)
      this.changeHideAt = this.time.now + CONFIG.ui.status.changeFeedbackMs
    } else if (this.time.now >= this.changeHideAt) this.changeLine.setVisible(false)
    this.previousCoins = hud.coins
    this.previousLives = hud.lives
  }

  private renderSelection(hud: HudState): void {
    const tower = hud.selectedTower
    if ((tower?.id ?? '') !== this.lastSelectedTowerId) {
      this.sellConfirmationTowerId = ''
      this.lastSelectedTowerId = tower?.id ?? ''
    }
    this.fitStatus(hud.status)
    if (!tower) {
      this.fitSelected(`Defenses ${hud.placement.towerCount}/${hud.placement.towerMaximum}`)
      this.fitPreview(
        hud.placement.pendingTowerType
          ? 'Choose a grass square; invalid squares explain why.'
          : hud.nextWavePreview || 'Choose a defense card to build.',
      )
      this.upgradeButton.setText('Upgrade'); this.upgradeButton.setEnabled(false)
      this.sellButton.setText('Sell'); this.sellButton.setEnabled(false)
      this.targetButton.setText('Target'); this.targetButton.setEnabled(false)
      return
    }
    this.targetButton.setText(`Target: ${tower.targetModeLabel}`); this.targetButton.setEnabled(true)
    const role = tower.type === 'arrow' ? 'Fast' : tower.type === 'frost' ? 'Slow' : 'Splash'
    this.fitSelected(`${tower.name} · L${tower.level} · ${role} · ${hud.placement.towerCount}/${hud.placement.towerMaximum}`)
    const shortfall = Math.max(0, tower.upgradeCost - hud.coins)
    this.fitPreview(tower.maxed ? `Maximum level · Sell refund ${tower.sellRefund} Ryo` : tower.affordable ? tower.upgrade.summary : `${tower.upgrade.summary} · Need ${shortfall} more Ryo`)
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

  private renderKeyboardHint(): void {
    if (!this.focus.keyboardHintsVisible || this.modalSources.size > 0) {
      this.keyboardHintLine.setVisible(false)
      return
    }
    const region = this.focus.activeRegion
    const hint = region === 'shop' ? 'Shop: 1–3 or [ ] · Enter choose · F speed'
      : region === 'terrain' ? 'Terrain: arrows move · Enter place · Esc cancel'
        : region === 'towers' ? 'Defenses: arrows cycle · Tab actions'
          : region === 'actions' ? 'Actions: arrows · U upgrade · S sell · T target'
            : 'Pause: Enter · P pause · M mute'
    this.fitHint(`${hint} · Tab regions`)
    this.keyboardHintLine.setVisible(true)
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

  private restartRun(): void {
    window.setTimeout(() => {
      const manager = this.game.scene
      manager.stop(this.scene.key); manager.stop(GAME_SCENE_KEY)
      window.setTimeout(() => manager.start(GAME_SCENE_KEY), 0)
    }, 80)
  }

  private goMainMenu(): void {
    window.setTimeout(() => this.scene.start(MAIN_MENU_SCENE_KEY), 80)
  }

  private setModalSource(source: string, active: boolean): void {
    if (active) {
      if (this.modalSources.size === 0) this.focus?.rememberRegionBeforeModal()
      this.modalSources.add(source)
    } else {
      this.modalSources.delete(source)
      if (this.modalSources.size === 0) this.focus?.restoreRegionAfterModal()
    }
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
