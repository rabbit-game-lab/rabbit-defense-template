import type { Point } from '../systems/towerDefenseRules'

export type TowerType = 'arrow' | 'frost' | 'bomb'
export type EnemyType = 'grunt' | 'runner' | 'tank'

export interface TowerDefinition {
  type: TowerType
  name: string
  cost: number
  damage: number
  range: number
  fireRateMs: number
  projectileSpeed: number
  color: number
  topColor: number
  description: string
  slowFactor?: number
  slowMs?: number
  splashRadius?: number
  upgradeCost: number
}

export interface EnemyDefinition {
  type: EnemyType
  name: string
  hp: number
  speed: number
  reward: number
  leakDamage: number
  color: number
  trimColor: number
  radius: number
}

export interface WaveDefinition {
  enemies: EnemyType[]
  spawnEveryMs: number
}

export const PATH: readonly Point[] = [
  { x: -24, y: 222 },
  { x: 132, y: 222 },
  { x: 132, y: 112 },
  { x: 312, y: 112 },
  { x: 312, y: 338 },
  { x: 520, y: 338 },
  { x: 520, y: 190 },
  { x: 824, y: 190 },
]

export const BUILD_SPOTS: readonly Point[] = [
  { x: 90, y: 140 },
  { x: 220, y: 178 },
  { x: 238, y: 292 },
  { x: 402, y: 244 },
  { x: 430, y: 398 },
  { x: 610, y: 270 },
]

export const SHOP_TOWER_ORDER: readonly TowerType[] = ['arrow', 'frost', 'bomb']

export const SHOP_CARD_WIDTH = 52
export const SHOP_CARD_HEIGHT = 34
export const SHOP_CARD_SPACING_X = 61
export const SHOP_PANEL = { x: 694, y: 58, width: 196, height: 78 }
export const SHOP_CARD_START = { x: 590, y: 24 }

export const TOWERS: Record<TowerType, TowerDefinition> = {
  arrow: {
    type: 'arrow',
    name: 'Arrow Tower',
    cost: 50,
    damage: 10,
    range: 118,
    fireRateMs: 620,
    projectileSpeed: 430,
    color: 0x8b5a2b,
    topColor: 0xf6d365,
    description: 'Fast single-target shots.',
    upgradeCost: 55,
  },
  frost: {
    type: 'frost',
    name: 'Frost Mage',
    cost: 70,
    damage: 6,
    range: 104,
    fireRateMs: 900,
    projectileSpeed: 360,
    color: 0x385b83,
    topColor: 0xa9e8ff,
    description: 'Slows monsters with low damage.',
    slowFactor: 0.55,
    slowMs: 1200,
    upgradeCost: 55,
  },
  bomb: {
    type: 'bomb',
    name: 'Bombard',
    cost: 95,
    damage: 18,
    range: 96,
    fireRateMs: 1120,
    projectileSpeed: 320,
    color: 0x573016,
    topColor: 0xff9b54,
    description: 'Slow splash damage.',
    splashRadius: 44,
    upgradeCost: 55,
  },
}

export const ENEMIES: Record<EnemyType, EnemyDefinition> = {
  grunt: {
    type: 'grunt',
    name: 'Goblin',
    hp: 26,
    speed: 46,
    reward: 9,
    leakDamage: 1,
    color: 0x5f9f45,
    trimColor: 0x20351d,
    radius: 12,
  },
  runner: {
    type: 'runner',
    name: 'Imp Runner',
    hp: 16,
    speed: 72,
    reward: 11,
    leakDamage: 1,
    color: 0xb95f33,
    trimColor: 0x3a1d13,
    radius: 10,
  },
  tank: {
    type: 'tank',
    name: 'Ogre',
    hp: 72,
    speed: 31,
    reward: 22,
    leakDamage: 2,
    color: 0x6f6277,
    trimColor: 0x2c2630,
    radius: 15,
  },
}

export const WAVES: readonly WaveDefinition[] = [
  { enemies: ['grunt', 'grunt', 'grunt', 'runner'], spawnEveryMs: 920 },
  { enemies: ['grunt', 'runner', 'grunt', 'runner', 'grunt'], spawnEveryMs: 820 },
  { enemies: ['runner', 'runner', 'grunt', 'grunt', 'tank'], spawnEveryMs: 780 },
  { enemies: ['grunt', 'tank', 'runner', 'grunt', 'runner', 'tank'], spawnEveryMs: 740 },
  { enemies: ['tank', 'grunt', 'runner', 'tank', 'runner', 'grunt', 'tank'], spawnEveryMs: 700 },
]
