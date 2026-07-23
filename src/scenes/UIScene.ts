import Phaser from 'phaser'
import { CONFIG } from '../game.config'
import type GameScene from './GameScene'

export default class UIScene extends Phaser.Scene {
  private statsLine!: Phaser.GameObjects.Text
  private waveLine!: Phaser.GameObjects.Text
  private selectedLine!: Phaser.GameObjects.Text
  private statusLine!: Phaser.GameObjects.Text

  constructor() {
    super('UIScene')
  }

  create(): void {
    this.add.rectangle(205, 24, 390, 38, CONFIG.ui.panelColor, 0.9).setStrokeStyle(1, CONFIG.world.accentColor, 0.35)
    this.statsLine = this.add.text(18, 12, '', { fontSize: '14px', color: CONFIG.ui.textColor, fontStyle: 'bold' })
    this.waveLine = this.add.text(258, 12, '', { fontSize: '14px', color: '#c8d8b6', fontStyle: 'bold' })

    this.add.rectangle(402, 456, 760, 34, CONFIG.ui.panelColor, 0.86).setStrokeStyle(1, CONFIG.world.accentColor, 0.28)
    this.selectedLine = this.add.text(28, 446, '', { fontSize: '12px', color: '#ffd56a', fontStyle: 'bold' })
    this.statusLine = this.add.text(212, 446, '', { fontSize: '12px', color: CONFIG.ui.textColor })
  }

  update(): void {
    const gameScene = this.scene.get('GameScene') as GameScene
    if (!gameScene.scene.isActive()) return
    const hud = gameScene.getHudState()
    this.statsLine.setText(`Coins ${hud.coins}   Lives ${hud.lives}`)
    this.waveLine.setText(`Wave ${hud.wave}/${hud.totalWaves}`)
    this.selectedLine.setText(`Selected: ${hud.selectedTower}`)
    this.statusLine.setText(hud.status)
  }
}
