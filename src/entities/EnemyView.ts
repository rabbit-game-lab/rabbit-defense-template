import Phaser from 'phaser'
import type { EnemyDefinition, EnemyType } from '../data/towerDefense'

export interface EnemyRuntime {
  id: string
  name: string
  type: EnemyType
  x: number
  y: number
  hp: number
  maxHp: number
  speed: number
  reward: number
  leakDamage: number
  pathIndex: number
  progress: number
  slowFactor: number
  slowUntil: number
  slowResistance?: number
  escaped: boolean
  view: EnemyView
}

export class EnemyView {
  readonly container: Phaser.GameObjects.Container
  private readonly body: Phaser.GameObjects.Rectangle
  private readonly trim: Phaser.GameObjects.Rectangle
  private readonly hpBack: Phaser.GameObjects.Rectangle
  private readonly hpFill: Phaser.GameObjects.Rectangle
  private readonly bossHalo: Phaser.GameObjects.Ellipse
  private readonly bossBodyMark: Phaser.GameObjects.Rectangle
  private readonly bossLabel: Phaser.GameObjects.Text

  constructor(scene: Phaser.Scene, definition: EnemyDefinition, x: number, y: number) {
    this.container = scene.add.container(x, y)
    this.body = scene.add.rectangle(0, 0, definition.radius * 2, definition.radius * 2, definition.color)
    this.trim = scene.add.rectangle(0, 4, definition.radius * 1.4, 4, definition.trimColor)
    this.hpBack = scene.add.rectangle(0, -definition.radius - 8, definition.radius * 2, 4, 0x1b1b1b)
    this.hpFill = scene.add.rectangle(0, -definition.radius - 8, definition.radius * 2, 4, 0xd84a3a)
    this.hpBack.setOrigin(0.5)
    this.hpFill.setOrigin(0, 0.5)
    this.hpFill.x = -definition.radius

    this.bossHalo = scene.add.ellipse(0, 0, definition.radius * 2.9, definition.radius * 2.4, 0x4b2e1f, 0.0)
    this.bossBodyMark = scene.add.rectangle(0, 0, definition.radius * 2.2, 6, 0xe6c27a)
    this.bossLabel = scene.add.text(0, definition.radius + 12, 'BOSS', {
      color: '#f7d89f',
      fontFamily: 'monospace',
      fontSize: '8px',
      stroke: '#3a1608',
      strokeThickness: 1,
    })
    this.bossLabel.setOrigin(0.5)
    this.bossBodyMark.setVisible(false)
    this.bossHalo.setVisible(false)
    this.bossLabel.setVisible(false)

    if (definition.type === 'warden') {
      this.bossHalo.setFillStyle(0xf4cf6e, 0.5)
      this.bossBodyMark.setVisible(true)
      this.bossHalo.setVisible(true)
      this.bossLabel.setVisible(true)
      this.body.setStrokeStyle(3, 0xfff4bd)
    }

    this.container.add([
      this.bossHalo,
      this.body,
      this.trim,
      this.bossBodyMark,
      this.hpBack,
      this.hpFill,
      this.bossLabel,
    ])
  }

  setPosition(x: number, y: number): void {
    this.container.setPosition(x, y)
  }

  setHp(current: number, max: number): void {
    this.hpFill.scaleX = Math.max(0, current / max)
  }

  flashSlow(active: boolean): void {
    this.body.setStrokeStyle(active ? 2 : 0, 0xa9e8ff)
  }

  destroy(): void {
    this.container.destroy()
  }
}
