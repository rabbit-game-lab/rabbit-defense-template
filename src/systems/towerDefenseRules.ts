export interface Point {
  x: number
  y: number
}

export interface TowerCostLike {
  cost: number
}

export interface TowerEconomyLike {
  cost: number
  level: number
  upgradeCost: number
}

export interface MovingEnemyState extends Point {
  pathIndex: number
  progress: number
}

export interface AdvancedEnemyState extends MovingEnemyState {
  escaped: boolean
}

export interface TargetableEnemy extends Point {
  id: string
  hp: number
  pathIndex: number
  progress: number
  escaped: boolean
}

export interface TowerTargeter extends Point {
  range: number
}

export interface DamageableEnemy {
  hp: number
  slowedUntil: number
}

export interface DamageResult extends DamageableEnemy {
  killed: boolean
}

export interface TowerUpgradeStats {
  level: number
  damage: number
  range: number
  fireRateMs: number
  upgradeCost: number
}

export function canAffordTower(coins: number, tower: TowerCostLike): boolean {
  return coins >= tower.cost
}

export function spendCoins(coins: number, cost: number): number {
  return Math.max(0, coins - cost)
}

export function refundForTower(tower: TowerEconomyLike): number {
  const spent = tower.cost + Math.max(0, tower.level - 1) * tower.upgradeCost
  return Math.floor(spent * 0.6)
}

export function distanceBetween(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function segmentLength(a: Point, b: Point): number {
  return distanceBetween(a, b)
}

function pointOnSegment(a: Point, b: Point, distance: number): Point {
  const length = segmentLength(a, b)
  if (length === 0) return { x: b.x, y: b.y }
  const t = Math.min(1, Math.max(0, distance / length))
  return {
    x: Math.round(a.x + (b.x - a.x) * t),
    y: Math.round(a.y + (b.y - a.y) * t),
  }
}

export function advanceEnemyAlongPath(enemy: MovingEnemyState, path: readonly Point[], distance: number): AdvancedEnemyState {
  if (path.length < 2) return { ...enemy, escaped: true }

  let pathIndex = enemy.pathIndex
  let progress = enemy.progress
  let remaining = Math.max(0, distance)

  while (remaining > 0 && pathIndex < path.length - 1) {
    const start = path[pathIndex]
    const end = path[pathIndex + 1]
    const length = segmentLength(start, end)
    const leftOnSegment = Math.max(0, length - progress)

    if (remaining <= leftOnSegment) {
      progress += remaining
      remaining = 0
      const pos = pointOnSegment(start, end, progress)
      return { ...pos, pathIndex, progress: Math.round(progress), escaped: false }
    }

    remaining -= leftOnSegment
    pathIndex += 1
    progress = 0
  }

  const finalPoint = path[path.length - 1]
  return { x: finalPoint.x, y: finalPoint.y, pathIndex: path.length - 1, progress: 0, escaped: true }
}

export function chooseTowerTarget<T extends TargetableEnemy>(tower: TowerTargeter, enemies: readonly T[]): T | undefined {
  return enemies
    .filter((enemy) => enemy.hp > 0 && !enemy.escaped && distanceBetween(tower, enemy) <= tower.range)
    .sort((a, b) => b.pathIndex - a.pathIndex || b.progress - a.progress)[0]
}

export function damageEnemy(enemy: DamageableEnemy, damage: number, slowedUntil = enemy.slowedUntil): DamageResult {
  const hp = Math.max(0, enemy.hp - Math.max(0, damage))
  return { hp, slowedUntil, killed: hp === 0 }
}

export function computeTowerUpgrade(tower: TowerUpgradeStats): TowerUpgradeStats {
  return {
    level: tower.level + 1,
    damage: Math.round(tower.damage * 1.5),
    range: tower.range + 10,
    fireRateMs: Math.round(tower.fireRateMs * 0.9),
    upgradeCost: Math.round(tower.upgradeCost * 1.5),
  }
}
