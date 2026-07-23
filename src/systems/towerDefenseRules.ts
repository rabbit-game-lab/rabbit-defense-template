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
  slowFactor: number
  slowUntil: number
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

export interface TowerUpgradeDeltas {
  damage: number
  range: number
  fireRateMs: number
}

export interface TowerUpgradePreview {
  next: TowerUpgradeStats
  delta: TowerUpgradeDeltas
  cost: number
  summary: string
}

export type TowerUpgradeRequestOutcome = {
    type: 'no-selection'
    reason: 'no-selection'
  } | {
    type: 'insufficient-funds'
    reason: 'insufficient-funds'
    currentCoins: number
    needed: number
  } | {
    type: 'success'
    reason: 'success'
    next: TowerUpgradeStats
    cost: number
    remainingCoins: number
  }

export interface ActiveSlow {
  slowFactor: number
  slowUntil: number
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

function normalizeSlowFactor(value: number | undefined): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return 1
  return Math.min(1, Math.max(0, value))
}

export function evaluateSlowImpact(active: ActiveSlow, incoming: ActiveSlow | undefined, now: number): ActiveSlow {
  const activeExpired = now >= active.slowUntil
  const effectiveActive: ActiveSlow = activeExpired
    ? { slowFactor: 1, slowUntil: 0 }
    : {
        slowFactor: normalizeSlowFactor(active.slowFactor),
        slowUntil: active.slowUntil,
      }

  if (!incoming) {
    return effectiveActive
  }

  const incomingExpired = now >= incoming.slowUntil
  if (incomingExpired) {
    return effectiveActive
  }

  const normalizedIncomingFactor = normalizeSlowFactor(incoming.slowFactor)

  const strongerEffect = Math.min(effectiveActive.slowFactor, normalizedIncomingFactor)
  if (strongerEffect === 1) return { slowFactor: normalizedIncomingFactor, slowUntil: incoming.slowUntil }

  if (normalizedIncomingFactor === 1) return effectiveActive

  return {
    slowFactor: strongerEffect,
    slowUntil: Math.max(effectiveActive.slowUntil, incoming.slowUntil),
  }
}

export function damageEnemy(
  enemy: DamageableEnemy,
  damage: number,
  now: number,
  slowFactor?: number,
  slowUntil?: number,
): DamageResult {
  const hp = Math.max(0, enemy.hp - Math.max(0, damage))
  const nextSlow = evaluateSlowImpact(
    { slowFactor: enemy.slowFactor, slowUntil: enemy.slowUntil },
    slowFactor === undefined || slowUntil === undefined ? undefined : { slowFactor, slowUntil },
    now,
  )

  return {
    hp,
    slowFactor: nextSlow.slowFactor,
    slowUntil: nextSlow.slowUntil,
    killed: hp === 0,
  }
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

export function computeTowerUpgrade(tower: TowerUpgradeStats): TowerUpgradeStats {
  return {
    level: tower.level + 1,
    damage: Math.round(tower.damage * 1.5),
    range: tower.range + 10,
    fireRateMs: Math.round(tower.fireRateMs * 0.9),
    upgradeCost: Math.round(tower.upgradeCost * 1.5),
  }
}

export function createTowerUpgradePreview(tower: TowerUpgradeStats): TowerUpgradePreview {
  const next = computeTowerUpgrade(tower)
  const preview: TowerUpgradePreview = {
    next,
    delta: {
      damage: next.damage - tower.damage,
      range: next.range - tower.range,
      fireRateMs: next.fireRateMs - tower.fireRateMs,
    },
    cost: tower.upgradeCost,
    summary: `+${next.damage - tower.damage} Damage · +${next.range - tower.range} Range · ${next.fireRateMs - tower.fireRateMs}ms fire rate`,
  }
  return preview
}

export function resolveTowerUpgradeRequest(
  selected: TowerUpgradeStats | null,
  currentCoins: number,
): TowerUpgradeRequestOutcome {
  if (!selected) {
    return { type: 'no-selection', reason: 'no-selection' }
  }

  const next = computeTowerUpgrade(selected)
  const cost = selected.upgradeCost

  if (currentCoins < cost) {
    return { type: 'insufficient-funds', reason: 'insufficient-funds', currentCoins, needed: cost }
  }

  return {
    type: 'success',
    reason: 'success',
    next,
    cost,
    remainingCoins: Math.max(0, currentCoins - cost),
  }
}

export function formatTowerUpgradePreview(preview: Pick<TowerUpgradePreview, 'summary'>): string {
  return preview.summary
}
