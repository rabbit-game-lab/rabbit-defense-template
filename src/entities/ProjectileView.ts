import Phaser from 'phaser'
import type { EnemyRuntime } from './EnemyView'
import type { TowerType } from '../data/towerDefense'

export interface ProjectileRuntime {
  sprite: Phaser.GameObjects.Arc
  target: EnemyRuntime
  damage: number
  speed: number
  type: TowerType
  slowFactor?: number
  slowMs?: number
  splashRadius?: number
}

export function createProjectile(scene: Phaser.Scene, x: number, y: number, type: TowerType): Phaser.GameObjects.Arc {
  const colors: Record<TowerType, number> = {
    arrow: 0xf6d365,
    frost: 0xa9e8ff,
    bomb: 0xff9b54,
  }
  const radius = type === 'bomb' ? 6 : 4
  return scene.add.circle(x, y, radius, colors[type])
}
