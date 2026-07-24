import Phaser from 'phaser'
import { TOWER_TEXTURE_KEYS } from '../data/assets'
import type { TowerDefinition, TowerType } from '../data/towerDefense'
import { computeTowerLevelScale } from '../systems/towerPlacementVisuals'

export interface TowerRuntime {
  id: string
  type: TowerType
  x: number
  y: number
  level: number
  cost: number
  investedCost: number
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
  private readonly sprite: Phaser.GameObjects.Image
  private readonly levelText: Phaser.GameObjects.Text
  private readonly rangeCircle: Phaser.GameObjects.Arc
  private readonly selectionRing: Phaser.GameObjects.Arc
  private pulseTween?: Phaser.Tweens.Tween

  constructor(scene: Phaser.Scene, definition: TowerDefinition, x: number, y: number) {
    this.container = scene.add.container(x, y)
    this.rangeCircle = scene.add.circle(0, 0, definition.range, 0xffffff, 0.07).setStrokeStyle(1, 0xffffff, 0.2)
    this.rangeCircle.setVisible(false)
    this.selectionRing = scene.add.circle(0, 2, 21, 0xfff0a3, 0).setStrokeStyle(2, 0xfff0a3, 0.9)
    this.selectionRing.setVisible(false)
    this.sprite = scene.add.image(0, 0, TOWER_TEXTURE_KEYS[definition.type])
    this.levelText = scene.add
      .text(13, 13, '1', {
        fontSize: '10px',
        color: '#fff4cf',
        fontStyle: 'bold',
        backgroundColor: '#111827',
        padding: { x: 2, y: 1 },
      })
      .setOrigin(0.5)
    this.container.add([this.rangeCircle, this.selectionRing, this.sprite, this.levelText])
  }

  setSelected(selected: boolean): void {
    this.rangeCircle.setVisible(selected)
    this.selectionRing.setVisible(selected)
  }

  setLevel(level: number): void {
    this.cancelPulse()
    this.levelText.setText(String(level))
    const scale = computeTowerLevelScale(level)
    this.sprite.setScale(scale)
    this.levelText.setScale(scale)
  }

  setRange(range: number): void {
    this.rangeCircle.setRadius(range)
  }

  pulse(scene: Phaser.Scene, duration = 80): void {
    this.cancelPulse()
    const restingScale = this.sprite.scaleX
    this.pulseTween = scene.tweens.add({
      targets: this.sprite,
      scale: restingScale * 1.12,
      duration,
      yoyo: true,
      onComplete: () => {
        this.sprite.setScale(restingScale)
        this.pulseTween = undefined
      },
    })
  }

  cancelPulse(): void {
    if (!this.pulseTween) return
    const restingScale = this.levelText.scaleX
    this.pulseTween.stop()
    this.sprite.setScale(restingScale)
    this.pulseTween = undefined
  }

  destroy(): void {
    this.cancelPulse()
    this.container.destroy()
  }
}
