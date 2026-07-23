import type { Point } from '../systems/towerDefenseRules'

export type TowerType = 'arrow' | 'frost' | 'bomb'
export type EnemyType = 'grunt' | 'runner' | 'tank' | 'warden'

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
  maxLevel: number
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
  slowResistance: number
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

export const TOWERS: Record<TowerType, TowerDefinition> = {
  arrow: {
    type: 'arrow',
    name: 'Shuriken Tower',
    cost: 50,
    damage: 10,
    range: 118,
    fireRateMs: 620,
    projectileSpeed: 430,
    color: 0x8b5a2b,
    topColor: 0xf6d365,
    description: 'Fast single-target shuriken.',
    upgradeCost: 55,
    maxLevel: 3,
  },
  frost: {
    type: 'frost',
    name: 'Ice Shrine',
    cost: 70,
    damage: 6,
    range: 104,
    fireRateMs: 900,
    projectileSpeed: 360,
    color: 0x385b83,
    topColor: 0xa9e8ff,
    description: 'Slows raiders with frozen seals.',
    slowFactor: 0.55,
    slowMs: 1200,
    upgradeCost: 55,
    maxLevel: 3,
  },
  bomb: {
    type: 'bomb',
    name: 'Fire Mortar',
    cost: 95,
    damage: 18,
    range: 96,
    fireRateMs: 1120,
    projectileSpeed: 320,
    color: 0x573016,
    topColor: 0xff9b54,
    description: 'Slow explosive kunai damage.',
    splashRadius: 44,
    upgradeCost: 55,
    maxLevel: 3,
  },
}

export const ENEMIES: Record<EnemyType, EnemyDefinition> = {
  grunt: {
   type: 'grunt',
   name: 'Scout Mouse',
   hp: 26,
   speed: 46,
   reward: 9,
   leakDamage: 1,
   color: 0x5f9f45,
   trimColor: 0x20351d,
   radius: 12,
   slowResistance: 0,
 },
  runner: {
   type: 'runner',
   name: 'Rogue Raccoon',
   hp: 16,
   speed: 72,
   reward: 11,
   leakDamage: 1,
   color: 0xb95f33,
   trimColor: 0x3a1d13,
   radius: 10,
   slowResistance: 0,
 },
  tank: {
   type: 'tank',
   name: 'Iron Panda',
   hp: 72,
   speed: 31,
   reward: 22,
   leakDamage: 2,
   color: 0x6f6277,
   trimColor: 0x2c2630,
   radius: 15,
   slowResistance: 0,
 },
 warden: {
   type: 'warden',
   name: 'Crimson Bear Shogun',
   hp: 220,
   speed: 24,
   reward: 160,
   leakDamage: 4,
   color: 0x6e4f2f,
   trimColor: 0x2d1f13,
   radius: 22,
   slowResistance: 1,
 },
 }

export const WAVES: readonly WaveDefinition[] = [
  { enemies: ['grunt', 'grunt', 'grunt', 'runner'], spawnEveryMs: 920 },
  { enemies: ['grunt', 'runner', 'grunt', 'runner', 'grunt'], spawnEveryMs: 820 },
  { enemies: ['runner', 'runner', 'grunt', 'grunt', 'tank'], spawnEveryMs: 780 },
  { enemies: ['grunt', 'tank', 'runner', 'grunt', 'runner', 'tank'], spawnEveryMs: 740 },
  { enemies: ['tank', 'grunt', 'runner', 'tank', 'runner', 'grunt', 'tank'], spawnEveryMs: 700 },
  { enemies: ['grunt', 'runner', 'tank', 'grunt', 'tank', 'runner', 'runner'], spawnEveryMs: 680 },
  { enemies: ['tank', 'runner', 'runner', 'tank', 'grunt', 'tank'], spawnEveryMs: 660 },
  { enemies: ['runner', 'tank', 'tank', 'runner', 'grunt', 'runner', 'tank'], spawnEveryMs: 620 },
  { enemies: ['tank', 'runner', 'tank', 'tank', 'runner', 'runner'], spawnEveryMs: 640 },
  { enemies: ['warden'], spawnEveryMs: 900 },
]
