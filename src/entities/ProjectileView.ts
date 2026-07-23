import Phaser from 'phaser'
import { PROJECTILE_TEXTURE_KEYS } from '../data/assets'
import type { TowerType } from '../data/towerDefense'
import type { EnemyRuntime } from './EnemyView'

export interface ProjectileRuntime {
  sprite: Phaser.GameObjects.Image
  target: EnemyRuntime
  damage: number
  speed: number
  type: TowerType
  slowFactor?: number
  slowMs?: number
  splashRadius?: number
}

export function createProjectile(scene: Phaser.Scene, x: number, y: number, type: TowerType): Phaser.GameObjects.Image {
  return scene.add.image(x, y, PROJECTILE_TEXTURE_KEYS[type])
}
