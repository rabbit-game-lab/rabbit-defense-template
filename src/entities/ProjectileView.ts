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
  lastTrailAt?: number
}

export function createProjectile(scene: Phaser.Scene, x: number, y: number, type: TowerType): Phaser.GameObjects.Image {
  const projectile = scene.add.image(x, y, PROJECTILE_TEXTURE_KEYS[type]).setDepth(8)
  if (type === 'arrow') projectile.setScale(0.82)
  if (type === 'frost') projectile.setTint(0xc8f4ff).setScale(0.9)
  if (type === 'bomb') projectile.setTint(0xffb05c).setScale(1.08)
  return projectile
}
