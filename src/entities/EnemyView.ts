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
  escaped: boolean
  view: EnemyView
}

export class EnemyView {
  readonly container: Phaser.GameObjects.Container
  private readonly body: Phaser.GameObjects.Rectangle
  private readonly trim: Phaser.GameObjects.Rectangle
  private readonly hpBack: Phaser.GameObjects.Rectangle
  private readonly hpFill: Phaser.GameObjects.Rectangle

  constructor(scene: Phaser.Scene, definition: EnemyDefinition, x: number, y: number) {
    this.container = scene.add.container(x, y)
    this.body = scene.add.rectangle(0, 0, definition.radius * 2, definition.radius * 2, definition.color)
    this.trim = scene.add.rectangle(0, 4, definition.radius * 1.4, 4, definition.trimColor)
    this.hpBack = scene.add.rectangle(0, -definition.radius - 8, definition.radius * 2, 4, 0x1b1b1b)
    this.hpFill = scene.add.rectangle(0, -definition.radius - 8, definition.radius * 2, 4, 0xd84a3a)
    this.hpBack.setOrigin(0.5)
    this.hpFill.setOrigin(0, 0.5)
    this.hpFill.x = -definition.radius
    this.container.add([this.body, this.trim, this.hpBack, this.hpFill])
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
