import Phaser from 'phaser'
import type { TowerDefinition, TowerType } from '../data/towerDefense'
import { computeTowerLevelScale } from '../systems/towerPlacementVisuals'

export interface TowerRuntime {
  id: string
  type: TowerType
  x: number
  y: number
  level: number
  cost: number
  upgradeCost: number
  maxLevel: number
  damage: number
  range: number
  fireRateMs: number
  projectileSpeed: number
  nextShotAt: number
  slowFactor?: number
  slowMs?: number
  splashRadius?: number
  view: TowerView
}

export class TowerView {
  readonly container: Phaser.GameObjects.Container
  private readonly base: Phaser.GameObjects.Rectangle
  private readonly roof: Phaser.GameObjects.Triangle
  private readonly levelText: Phaser.GameObjects.Text
  private readonly rangeCircle: Phaser.GameObjects.Arc

  constructor(scene: Phaser.Scene, definition: TowerDefinition, x: number, y: number) {
    this.container = scene.add.container(x, y)
    this.rangeCircle = scene.add.circle(0, 0, definition.range, 0xffffff, 0.07).setStrokeStyle(1, 0xffffff, 0.2)
    this.rangeCircle.setVisible(false)
    this.base = scene.add.rectangle(0, 4, 24, 28, definition.color)
    this.roof = scene.add.triangle(0, -16, -16, 8, 16, 8, 0, -12, definition.topColor)
    this.levelText = scene.add
      .text(0, 6, '1', { fontSize: '12px', color: '#fff4cf', fontStyle: 'bold' })
      .setOrigin(0.5)
    this.container.add([this.rangeCircle, this.base, this.roof, this.levelText])
  }

  setSelected(selected: boolean): void {
    this.rangeCircle.setVisible(selected)
    this.base.setStrokeStyle(selected ? 2 : 0, 0xfff0a3)
  }

  setLevel(level: number): void {
    this.levelText.setText(String(level))
    const scale = computeTowerLevelScale(level)
    this.base.setScale(scale)
    this.roof.setScale(scale)
    this.levelText.setScale(scale)
  }

  setRange(range: number): void {
    this.rangeCircle.setRadius(range)
  }
  pulse(scene: Phaser.Scene): void {
    scene.tweens.add({ targets: this.roof, scale: 1.2, yoyo: true })
  }

  destroy(): void {
    this.container.destroy()
  }
}
