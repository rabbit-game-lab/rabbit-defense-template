import Phaser from 'phaser'
import { ENEMY_TEXTURE_KEYS } from '../data/assets'
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
  private readonly sprite: Phaser.GameObjects.Image
  private readonly hpFill: Phaser.GameObjects.Rectangle

  constructor(scene: Phaser.Scene, definition: EnemyDefinition, x: number, y: number) {
    this.container = scene.add.container(x, y)
    const isBoss = definition.type === 'warden'
    const spriteScale = isBoss ? 3 : 2
    const hpY = -definition.radius - 8
    const hpWidth = definition.radius * 2

    this.sprite = scene.add.image(0, 0, ENEMY_TEXTURE_KEYS[definition.type]).setScale(spriteScale)
    const hpBack = scene.add.rectangle(0, hpY, hpWidth, 4, 0x1b1b1b).setOrigin(0.5)
    this.hpFill = scene.add.rectangle(-definition.radius, hpY, hpWidth, 4, 0xd84a3a).setOrigin(0, 0.5)
    const bossLabel = scene.add.text(0, definition.radius + 14, 'SHOGUN', {
      color: '#f7d89f',
      fontFamily: 'monospace',
      fontSize: '8px',
      backgroundColor: '#3a1608',
      padding: { x: 3, y: 1 },
    }).setOrigin(0.5).setVisible(isBoss)

    this.container.add([this.sprite, hpBack, this.hpFill, bossLabel])
  }

  setPosition(x: number, y: number): void {
    this.container.setPosition(x, y)
  }

  setHp(current: number, max: number): void {
    this.hpFill.scaleX = Math.max(0, current / max)
  }

  flashSlow(active: boolean): void {
    if (active) this.sprite.setTint(0xa9e8ff)
    else this.sprite.clearTint()
  }

  destroy(): void {
    this.container.destroy()
  }
}
