import Phaser from 'phaser'
import { CONFIG } from '../game.config'
import { TOWER_TEXTURE_KEYS } from '../data/assets'
import type { TowerType } from '../data/towerDefense'
import type { PlacementEvaluation } from '../data/terrain'

export class TerrainPlacementPreview {
  private readonly scene: Phaser.Scene
  private readonly container: Phaser.GameObjects.Container
  private readonly clearance: Phaser.GameObjects.Rectangle
  private readonly cell: Phaser.GameObjects.Rectangle
  private readonly icon: Phaser.GameObjects.Text
  private readonly ghost: Phaser.GameObjects.Image

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    this.container = scene.add.container(0, 0).setDepth(8).setVisible(false)
    this.clearance = scene.add.rectangle(0, 0, 32, 32, 0xffffff, 0)
    this.cell = scene.add.rectangle(0, 0, CONFIG.placement.cellSize, CONFIG.placement.cellSize, 0x7bd879, CONFIG.placement.previewFillAlpha)
    this.icon = scene.add.text(13, -14, '✓', {
      fontSize: '14px',
      color: '#d9ffd8',
      fontStyle: 'bold',
      backgroundColor: '#172219',
      padding: { x: 2, y: 0 },
    }).setOrigin(0.5)
    this.ghost = scene.add.image(0, 0, TOWER_TEXTURE_KEYS.arrow).setAlpha(0.72)
    this.container.add([this.clearance, this.cell, this.ghost, this.icon])
  }

  show(type: TowerType, evaluation: PlacementEvaluation): void {
    const valid = evaluation.valid
    const color = valid ? 0x7bd879 : 0xe66f67
    const clearanceSize = (evaluation.requiredSpacingCells * 2 - 1) * CONFIG.placement.cellSize
    this.container.setPosition(evaluation.cell.x, evaluation.cell.y).setVisible(true)
    this.clearance.setSize(clearanceSize, clearanceSize).setStrokeStyle(1, color, 0.42)
    this.cell
      .setFillStyle(color, CONFIG.placement.previewFillAlpha)
      .setStrokeStyle(CONFIG.placement.previewStrokePx, color, 0.92)
    this.ghost.setTexture(TOWER_TEXTURE_KEYS[type]).setTint(valid ? 0xffffff : 0xd77f7a)
    this.icon.setText(valid ? '✓' : '!').setColor(valid ? '#d9ffd8' : '#ffd0ca')
  }

  hide(): void {
    this.container.setVisible(false)
  }

  destroy(): void {
    this.container.destroy()
  }
}
