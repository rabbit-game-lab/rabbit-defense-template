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

  constructor() {
    super('UIScene')
  }

  create(): void {
    this.add
      .rectangle(205, 24, 390, 38, CONFIG.ui.panelColor, 0.9)
      .setStrokeStyle(1, CONFIG.world.accentColor, 0.35)
    this.statsLine = this.add.text(18, 12, '', { fontSize: '14px', color: CONFIG.ui.textColor, fontStyle: 'bold' })
    this.waveLine = this.add.text(258, 12, '', { fontSize: '14px', color: '#c8d8b6', fontStyle: 'bold' })

    this.add.rectangle(402, 456, 760, 34, CONFIG.ui.panelColor, 0.86).setStrokeStyle(1, CONFIG.world.accentColor, 0.28)
    this.selectedLine = this.add.text(28, 446, '', { fontSize: '12px', color: '#ffd56a', fontStyle: 'bold' })
    this.statusLine = this.add.text(212, 446, '', { fontSize: '12px', color: CONFIG.ui.textColor })

    this.upgradeButtonBg = this.add
      .rectangle(700, 446, 150, 30, CONFIG.ui.panelColor, 0.95)
      .setStrokeStyle(1, CONFIG.world.accentColor, 0.33)
      .setInteractive({ useHandCursor: true })
    this.upgradeButtonText = this.add.text(700, 440, '', {
      fontSize: '11px',
      color: CONFIG.ui.textColor,
      fontStyle: 'bold',
    })
    this.upgradeButtonText.setOrigin(0.5, 0)

    this.upgradePreviewLine = this.add.text(620, 458, '', {
      fontSize: '10px',
      color: '#ffd56a',
    })

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
    this.upgradeButtonBg.setAlpha(enabled ? 1 : 0.45)
    this.upgradeButtonText.setColor(enabled ? CONFIG.ui.textColor : '#8b8f84')
  }
}
