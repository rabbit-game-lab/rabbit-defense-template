import type { EnemyType, TowerType } from './towerDefense'

export interface ImageAsset {
  key: string
  path: string
}

export const IMAGES: readonly ImageAsset[] = [
  { key: 'world-board', path: 'assets/ninja/world-board.png' },
  { key: 'hidden-dojo', path: 'assets/ninja/hidden-dojo.png' },
  { key: 'tower-shuriken', path: 'assets/ninja/tower-shuriken.png' },
  { key: 'tower-frost', path: 'assets/ninja/tower-frost.png' },
  { key: 'tower-bomb', path: 'assets/ninja/tower-bomb.png' },
  { key: 'enemy-grunt', path: 'assets/ninja/enemy-grunt.png' },
  { key: 'enemy-runner', path: 'assets/ninja/enemy-runner.png' },
  { key: 'enemy-tank', path: 'assets/ninja/enemy-tank.png' },
  { key: 'enemy-boss', path: 'assets/ninja/enemy-boss.png' },
  { key: 'projectile-shuriken', path: 'assets/ninja/projectile-shuriken.png' },
  { key: 'projectile-frost', path: 'assets/ninja/projectile-frost.png' },
  { key: 'projectile-bomb', path: 'assets/ninja/projectile-bomb.png' },
] as const

export const AUDIO: readonly string[] = []

export const TOWER_TEXTURE_KEYS: Record<TowerType, string> = {
  arrow: 'tower-shuriken',
  frost: 'tower-frost',
  bomb: 'tower-bomb',
}

export const ENEMY_TEXTURE_KEYS: Record<EnemyType, string> = {
  grunt: 'enemy-grunt',
  runner: 'enemy-runner',
  tank: 'enemy-tank',
  warden: 'enemy-boss',
}

export const PROJECTILE_TEXTURE_KEYS: Record<TowerType, string> = {
  arrow: 'projectile-shuriken',
  frost: 'projectile-frost',
  bomb: 'projectile-bomb',
}
