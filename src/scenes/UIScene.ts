import Phaser from 'phaser'
import { CONFIG } from '../game.config'
import type GameScene from './GameScene'

export default class UIScene extends Phaser.Scene {
  private statsLine!: Phaser.GameObjects.Text
  private waveLine!: Phaser.GameObjects.Text
  private selectedLine!: Phaser.GameObjects.Text
  private statusLine!: Phaser.GameObjects.Text
  private upgradeButtonBg!: Phaser.GameObjects.Rectangle
  private upgradeButtonText!: Phaser.GameObjects.Text
  private upgradePreviewLine!: Phaser.GameObjects.Text
  private upgradeEnabled = true

  constructor() {
    super('UIScene')
  }

  create(): void {
    const hud = CONFIG.ui.hud
    const upgradeButtonHeight = Math.max(hud.upgradeButtonHeight, 44)

    this.add
      .rectangle(hud.topRowX, hud.topRowY + hud.topRowHeight / 2, hud.topRowWidth, hud.topRowHeight, CONFIG.ui.panelColor, 0.9)
      .setStrokeStyle(1, CONFIG.world.accentColor, 0.35)
    this.statsLine = this.add.text(18, hud.topRowY + 2, '', {
      fontSize: '14px',
      color: CONFIG.ui.textColor,
      fontStyle: 'bold',
    })
    this.waveLine = this.add.text(258, hud.topRowY + 2, '', {
      fontSize: '14px',
      color: CONFIG.ui.hud.infoTextColor,
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
    this.upgradePreviewLine = this.add.text(hud.statusTextX, bottomTop + hud.previewLineY, '', {
      fontSize: hud.previewFontSize,
      color: '#ffd56a',
    })

    this.upgradeButtonBg = this.add
      .rectangle(
        hud.upgradeButtonX,
        hud.upgradeButtonY,
        hud.upgradeButtonWidth,
        Math.max(CONFIG.ui.hud.upgradeButtonHeight, 44),
        CONFIG.ui.panelColor,
        0.95,
      )
      .setStrokeStyle(1, CONFIG.world.accentColor, 0.33)
      .setInteractive(new Phaser.Geom.Rectangle(-hud.upgradeButtonWidth / 2, -upgradeButtonHeight / 2, hud.upgradeButtonWidth, upgradeButtonHeight), Phaser.Geom.Rectangle.Contains)

    this.upgradeButtonBg.on('pointerover', () => {
      if (this.upgradeEnabled) this.input.setDefaultCursor('pointer')
    })
    this.upgradeButtonBg.on('pointerout', () => {
      this.input.setDefaultCursor('default')
    })

    this.upgradeButtonText = this.add
      .text(hud.upgradeButtonX, hud.upgradeButtonY, '', {
        fontSize: hud.upgradeButtonFontSize,
        color: CONFIG.ui.textColor,
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0.5)

    this.upgradeButtonBg.on('pointerdown', () => {
      const gameScene = this.scene.get('GameScene') as GameScene
      if (!gameScene.scene.isActive()) return
      gameScene.upgradeSelectedTower()
    })
  }

  update(): void {
    const gameScene = this.scene.get('GameScene') as GameScene
    if (!gameScene.scene.isActive()) return

    const hud = gameScene.getHudState()
    this.statsLine.setText(`Coins ${hud.coins}   Lives ${hud.lives}`)
    this.waveLine.setText(`Wave ${hud.wave}/${hud.totalWaves}`)

    if (!hud.selectedTower) {
      this.selectedLine.setText('Selected: none')
      this.upgradeButtonText.setText('Upgrade · 0c')
      this.upgradePreviewLine.setText('No tower selected.')
      this.setUpgradeState(false)
    } else {
      this.selectedLine.setText(
        `${hud.selectedTower.name} L${hud.selectedTower.level} (DMG ${hud.selectedTower.damage}, RNG ${hud.selectedTower.range}, ATK ${hud.selectedTower.fireRateMs}ms)`,
      )
      this.upgradeButtonText.setText(`Upgrade · ${hud.selectedTower.upgradeCost}c`)
      this.upgradePreviewLine.setText(hud.selectedTower.upgrade.summary)
      this.setUpgradeState(hud.selectedTower.affordable)
    }

    this.statusLine.setText(hud.status)
  }

  private setUpgradeState(enabled: boolean): void {
    this.upgradeEnabled = enabled
    this.upgradeButtonBg.setAlpha(enabled ? 1 : 0.45)
    this.upgradeButtonText.setColor(enabled ? CONFIG.ui.textColor : '#8b8f84')
    if (!enabled) {
      this.input.setDefaultCursor('default')
    }
  }
}
