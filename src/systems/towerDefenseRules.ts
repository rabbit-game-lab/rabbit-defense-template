import { canAffordTower, refundForTower, spendCoins } from './towerEconomyRules.js'
import {
  type PlacementOutOfRangeReason,
  type TowerEconomyLike,
  type TowerPlacementCostLike,
} from './towerEconomyRules.js'
import {
  computeTowerUpgrade,
  createTowerUpgradePreview,
  formatTowerUpgradePreview,
  resolveTowerUpgradeRequest,
  type TowerUpgradeDeltas,
  type TowerUpgradePreview,
  type TowerUpgradeRequestOutcome,
  type TowerUpgradeStats,
} from './towerUpgradeRules.js'

export interface Point {
  x: number
  y: number
}

export interface BuildPadState {
  x: number
  y: number
  occupied: boolean
}

export interface PlacementDropOutcomeSuccess {
  type: 'success'
  target: BuildPadState
  spendAmount: number
  nextCoins: number
  status: string
}

export interface PlacementDropOutcomeFailed {
  type: 'cancelled'
  reason: PlacementOutOfRangeReason
  target: BuildPadState | undefined
  spendAmount: 0
  nextCoins: number
  status: string
}

export type PlacementDropOutcome = PlacementDropOutcomeSuccess | PlacementDropOutcomeFailed

export interface PlacementProbe {
  nearestPad: BuildPadState | undefined
  validPad: BuildPadState | undefined
  valid: boolean
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
  slowResistance?: number
}

export interface DamageResult extends DamageableEnemy {
  killed: boolean
}

export {
  canAffordTower,
  computeTowerUpgrade,
  createTowerUpgradePreview,
  formatTowerUpgradePreview,
  refundForTower,
  resolveTowerUpgradeRequest,
  spendCoins,
}

export type {
  PlacementOutOfRangeReason,
  TowerEconomyLike,
  TowerPlacementCostLike,
  TowerUpgradeDeltas,
  TowerUpgradePreview,
  TowerUpgradeRequestOutcome,
  TowerUpgradeStats,
}

export function findNearestPadWithinRadius(
  pointer: Point,
  pads: readonly BuildPadState[],
  radius: number,
): PlacementProbe {
  let nearestPad: BuildPadState | undefined
  let nearestDistance = Infinity

  for (const pad of pads) {
    const distance = distanceBetween(pad, pointer)
    if (distance > radius || distance >= nearestDistance) continue
    nearestPad = pad
    nearestDistance = distance
  }

  const validPad = nearestPad && !nearestPad.occupied ? nearestPad : undefined
  return { nearestPad, validPad, valid: Boolean(validPad) }
}

export function resolvePlacementDrop(
  pointer: Point,
  pads: readonly BuildPadState[],
  radius: number,
  tower: TowerPlacementCostLike,
  currentCoins: number,
): PlacementDropOutcome {
  const { nearestPad, validPad } = findNearestPadWithinRadius(pointer, pads, radius)

  if (!validPad) {
    if (nearestPad?.occupied) {
      return {
        type: 'cancelled',
        reason: 'occupied-pad',
        target: nearestPad,
        spendAmount: 0,
        nextCoins: currentCoins,
        status: 'That build circle is already occupied.',
      }
    }

    return {
      type: 'cancelled',
      reason: 'outside-range',
      target: undefined,
      spendAmount: 0,
      nextCoins: currentCoins,
      status: 'Drag cancelled — drop on a glowing circle.',
    }
  }

  if (currentCoins < tower.cost) {
    return {
      type: 'cancelled',
      reason: 'insufficient-funds',
      target: validPad,
      spendAmount: 0,
      nextCoins: currentCoins,
      status: `Need ${tower.cost} ryo to build ${tower.towerName}.`,
    }
  }

  return {
    type: 'success',
    target: validPad,
    spendAmount: tower.cost,
    nextCoins: currentCoins - tower.cost,
    status: `${tower.towerName} placed.`,
  }
}

export function distanceBetween(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function normalizeSlowFactor(value: number | undefined): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return 1
  return Math.min(1, Math.max(0, value))
}

function normalizeSlowResistance(value: number | undefined): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0
  return Math.min(1, Math.max(0, value))
}

function applySlowResistance(slowFactor: number, slowResistance: number): number {
  const normalizedFactor = normalizeSlowFactor(slowFactor)
  const normalizedResistance = normalizeSlowResistance(slowResistance)
  return 1 - (1 - normalizedFactor) * (1 - normalizedResistance)
}

export interface ActiveSlow {
  slowFactor: number
  slowUntil: number
}

export function evaluateSlowImpact(
  active: ActiveSlow,
  incoming: ActiveSlow | undefined,
  now: number,
  slowResistance = 0,
): ActiveSlow {
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

  const normalizedIncomingFactor = applySlowResistance(incoming.slowFactor, slowResistance)
  if (normalizedIncomingFactor === 1) return effectiveActive

  const strongerEffect = Math.min(effectiveActive.slowFactor, normalizedIncomingFactor)
  if (strongerEffect === 1) return { slowFactor: normalizedIncomingFactor, slowUntil: incoming.slowUntil }

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
    enemy.slowResistance,
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
      return { ...pos, pathIndex, progress, escaped: false }
    }

    remaining -= leftOnSegment
    pathIndex += 1
    progress = 0
  }

  const finalPoint = path[path.length - 1]
  return { x: finalPoint.x, y: finalPoint.y, pathIndex: path.length - 1, progress: 0, escaped: true }
}

export type TargetMode = 'first' | 'last' | 'strongest' | 'nearest'

export const TARGET_MODES: readonly TargetMode[] = ['first', 'last', 'strongest', 'nearest']

export const TARGET_MODE_LABELS: Record<TargetMode, string> = {
  first: 'First',
  last: 'Last',
  strongest: 'Strongest',
  nearest: 'Nearest',
}

/**
 * Returns true when `candidate` should replace the current `best` under `mode`.
 * All comparisons are strict so ties keep the earlier-seen enemy, preserving the
 * stable list-order behavior the rules tests depend on.
 */
function isBetterTarget<T extends TargetableEnemy>(candidate: T, best: T, mode: TargetMode, tower: TowerTargeter): boolean {
  switch (mode) {
    case 'first':
      return candidate.pathIndex > best.pathIndex || (candidate.pathIndex === best.pathIndex && candidate.progress > best.progress)
    case 'last':
      return candidate.pathIndex < best.pathIndex || (candidate.pathIndex === best.pathIndex && candidate.progress < best.progress)
    case 'strongest':
      return candidate.hp > best.hp
    case 'nearest':
      return distanceBetween(tower, candidate) < distanceBetween(tower, best)
  }
}

export function chooseTowerTarget<T extends TargetableEnemy>(
  tower: TowerTargeter,
  enemies: readonly T[],
  mode: TargetMode = 'first',
): T | undefined {
  let best: T | undefined

  for (const enemy of enemies) {
    if (enemy.hp <= 0 || enemy.escaped) continue
    if (distanceBetween(tower, enemy) > tower.range) continue

    if (!best || isBetterTarget(enemy, best, mode, tower)) {
      best = enemy
    }
  }

  return best
}

export function cycleTargetMode(mode: TargetMode, step = 1): TargetMode {
  const index = TARGET_MODES.indexOf(mode)
  const base = index < 0 ? 0 : index
  return TARGET_MODES[(base + step + TARGET_MODES.length) % TARGET_MODES.length]
}
