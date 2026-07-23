import { CONFIG } from '../game.config.js'
import { PATH, BUILD_SPOTS, TOWERS, ENEMIES, WAVES, type TowerType, type EnemyType } from '../data/towerDefense.js'
import { chooseTowerTarget, computeTowerUpgrade, damageEnemy, advanceEnemyAlongPath, distanceBetween } from './towerDefenseRules.js'
import { createWaveState, prepareFirstWaveForCombat, nextEnemyToSpawn, markEnemySpawned, waveProgressSnapshot, makeEnemyStats } from './waves.js'
import { type SimWaveMetrics, type StrategyContext, type StrategyAction, type TowerRuntimeSummary } from './balanceTypes.js'

export const STEP_MS = 20
export const MAX_SIM_TIME_MS = 240_000

export interface TowerRuntime {
  id: string
  type: TowerType
  x: number
  y: number
  level: number
  damage: number
  range: number
  fireRateMs: number
  projectileSpeed: number
  upgradeCost: number
  maxLevel: number
  nextShotAt: number
  slowFactor?: number
  slowMs?: number
  splashRadius?: number
}

export interface EnemyRuntime {
  id: string
  hp: number
  reward: number
  speed: number
  leakDamage: number
  wave: number
  pathIndex: number
  progress: number
  x: number
  y: number
  slowFactor: number
  slowUntil: number
  alive: boolean
  escaped: boolean
}

export interface ProjectileRuntime {
  targetId: string
  x: number
  y: number
  speed: number
  damage: number
  slowFactor?: number
  slowUntil?: number
  splashRadius?: number
}

export interface SimState {
  now: number
  coins: number
  lives: number
  started: boolean
  pads: Array<string | undefined>
  towers: TowerRuntime[]
  enemies: EnemyRuntime[]
  projectiles: ProjectileRuntime[]
  waveState: ReturnType<typeof createWaveState>
  waveSnapshots: SimWaveMetrics[]
  towerCounter: number
  totalKills: number
  totalLeaks: number
}

export function createSimulationState(): SimState {
  return {
    now: 0,
    coins: CONFIG.run.startingCoins,
    lives: CONFIG.run.startingLives,
    started: false,
    pads: Array(BUILD_SPOTS.length).fill(undefined),
    towers: [],
    enemies: [],
    projectiles: [],
    waveState: createWaveState(0, CONFIG.waves.betweenWaveDelayMs, CONFIG.waves.firstWavePrepareDelayMs),
    waveSnapshots: WAVES.map((_, idx) => ({
      wave: idx + 1,
      coinsAtStart: CONFIG.run.startingCoins,
      coinsAtEnd: CONFIG.run.startingCoins,
      livesAtStart: CONFIG.run.startingLives,
      livesAtEnd: CONFIG.run.startingLives,
      kills: 0,
      leaks: 0,
      purchases: [],
    })),
    towerCounter: 0,
    totalKills: 0,
    totalLeaks: 0,
  }
}

export function getWaveMetrics(state: SimState, wave: number): SimWaveMetrics | undefined {
  return state.waveSnapshots[Math.max(0, Math.min(wave - 1, WAVES.length - 1))]
}

export function updateWaveStart(state: SimState, waveNumber: number): void {
  const metrics = getWaveMetrics(state, waveNumber)
  if (metrics && metrics.coinsAtStart === CONFIG.run.startingCoins && metrics.livesAtStart === CONFIG.run.startingLives) {
    metrics.coinsAtStart = state.coins
    metrics.livesAtStart = state.lives
  }
}

export function updateWaveEnd(state: SimState, wave: number): void {
  const metrics = getWaveMetrics(state, wave)
  if (metrics) {
    metrics.coinsAtEnd = state.coins
    metrics.livesAtEnd = state.lives
  }
}

export function recordPurchase(state: SimState, wave: number, type: string, cost: number, upgradeLevel: number): void {
  const metrics = getWaveMetrics(state, wave)
  if (metrics) metrics.purchases.push({ type, cost, upgradeLevel, wave })
}

export function towerSummary(tower: TowerRuntime): TowerRuntimeSummary {
  return {
    id: tower.id,
    type: tower.type,
    level: tower.level,
    damage: tower.damage,
    range: tower.range,
    fireRateMs: tower.fireRateMs,
    upgradeCost: tower.upgradeCost,
    maxLevel: tower.maxLevel,
  }
}

export function createTower(state: SimState, type: TowerType, padIndex: number): void {
  const definition = TOWERS[type]
  if (padIndex < 0 || padIndex >= BUILD_SPOTS.length || state.pads[padIndex] !== undefined) return
  if (state.coins < definition.cost || state.towers.length >= BUILD_SPOTS.length) return

  const id = `${type}-${state.towerCounter++}`
  state.towers.push({
    id,
    type,
    x: BUILD_SPOTS[padIndex].x,
    y: BUILD_SPOTS[padIndex].y,
    level: 1,
    damage: definition.damage,
    range: definition.range,
    fireRateMs: definition.fireRateMs,
    projectileSpeed: definition.projectileSpeed,
    upgradeCost: definition.upgradeCost,
    maxLevel: definition.maxLevel,
    nextShotAt: 0,
    slowFactor: definition.slowFactor,
    slowMs: definition.slowMs,
    splashRadius: definition.splashRadius,
  })
  state.pads[padIndex] = id
  state.coins -= definition.cost
  recordPurchase(state, Math.min(WAVES.length, Math.max(1, state.waveState.waveIndex + 1)), type, definition.cost, 1)

  if (!state.started) {
    state.started = true
    prepareFirstWaveForCombat(state.waveState, state.now)
  }
}

export function upgradeTower(state: SimState, towerId: string): void {
  const tower = state.towers.find((candidate) => candidate.id === towerId)
  if (!tower || tower.level >= tower.maxLevel || state.coins < tower.upgradeCost) return
  const next = computeTowerUpgrade(tower)
  const spent = tower.upgradeCost
  tower.level = next.level
  tower.damage = next.damage
  tower.range = next.range
  tower.fireRateMs = next.fireRateMs
  tower.upgradeCost = next.upgradeCost
  state.coins -= spent
  recordPurchase(state, Math.min(WAVES.length, Math.max(1, state.waveState.waveIndex + 1)), tower.type, spent, tower.level)
}

export function applyAction(state: SimState, action: StrategyAction | null): void {
  if (!action) return
  if (action.kind === 'place') createTower(state, action.towerType, action.padIndex)
  else upgradeTower(state, action.towerId)
}

export function spawnEnemyIfDue(state: SimState): void {
  const enemyType = nextEnemyToSpawn(state.waveState, state.now)
  if (!enemyType) return

  const def = ENEMIES[enemyType as EnemyType]
  const stats = makeEnemyStats(enemyType, state.waveState.waveIndex)
  const id = `${enemyType}-${state.waveState.waveIndex}-${state.waveState.nextEnemyIndex}-${state.now}`

  state.enemies.push({
    id,
    hp: stats.hp,
    reward: stats.reward,
    speed: def.speed,
    leakDamage: def.leakDamage,
    wave: state.waveState.waveIndex + 1,
    pathIndex: 0,
    progress: 0,
    x: PATH[0].x,
    y: PATH[0].y,
    slowFactor: 1,
    slowUntil: 0,
    alive: true,
    escaped: false,
  })
  markEnemySpawned(state.waveState, state.now)
}

export function fireTowers(state: SimState): void {
  for (const tower of state.towers) {
    if (state.now < tower.nextShotAt) continue
    const target = chooseTowerTarget({ x: tower.x, y: tower.y, range: tower.range }, state.enemies)
    if (!target) continue
    tower.nextShotAt = state.now + tower.fireRateMs
    state.projectiles.push({
      targetId: target.id,
      x: tower.x,
      y: tower.y,
      speed: tower.projectileSpeed,
      damage: tower.damage,
      slowFactor: tower.slowFactor,
      slowUntil: tower.slowMs !== undefined ? state.now + tower.slowMs : undefined,
      splashRadius: tower.splashRadius,
    })
  }
}

export function impactProjectiles(state: SimState): void {
  const enemySnapshot = [...state.enemies]
  for (let i = state.projectiles.length - 1; i >= 0; i -= 1) {
    const projectile = state.projectiles[i]
    const target = enemySnapshot.find((enemy) => enemy.id === projectile.targetId && enemy.alive)
    if (!target) {
      state.projectiles.splice(i, 1)
      continue
    }

    const distance = Math.hypot(target.x - projectile.x, target.y - projectile.y)
    const travelDistance = projectile.speed * (STEP_MS / 1000)
    if (distance <= travelDistance + CONFIG.combat.projectileHitRadiusPx) {
      const radius = projectile.splashRadius ?? -1
      const victims = radius >= 0 ? state.enemies.filter((enemy) => enemy.alive && distanceBetween(enemy, target) <= radius) : [target]

      for (const enemy of victims) {
        const result = damageEnemy(
          { hp: enemy.hp, slowFactor: enemy.slowFactor, slowUntil: enemy.slowUntil },
          projectile.damage,
          state.now,
          projectile.slowFactor,
          projectile.slowUntil,
        )
        enemy.hp = result.hp
        enemy.slowFactor = result.slowFactor
        enemy.slowUntil = result.slowUntil
        if (result.killed) {
          enemy.alive = false
          state.totalKills += 1
          state.coins += enemy.reward

          const metric = getWaveMetrics(state, enemy.wave)
          if (metric) metric.kills += 1
        }
      }
      state.projectiles.splice(i, 1)
      continue
    }

    if (distance > 0) {
      projectile.x += ((target.x - projectile.x) / distance) * travelDistance
      projectile.y += ((target.y - projectile.y) / distance) * travelDistance
    }
  }
}

export function advanceEnemies(state: SimState): void {
  for (const enemy of state.enemies) {
    if (!enemy.alive) continue
    const speedScale = enemy.slowUntil > state.now ? enemy.slowFactor : 1
    const moved = advanceEnemyAlongPath(enemy, PATH, enemy.speed * speedScale * (STEP_MS / 1000))
    enemy.pathIndex = moved.pathIndex
    enemy.progress = moved.progress
    enemy.x = moved.x
    enemy.y = moved.y
    if (moved.escaped) {
      enemy.alive = false
      enemy.escaped = true
      state.totalLeaks += 1
      state.lives = Math.max(0, state.lives - enemy.leakDamage)
      const metric = getWaveMetrics(state, enemy.wave)
      if (metric) metric.leaks += 1
    }
  }
  state.enemies = state.enemies.filter((enemy) => enemy.alive)
}

export function buildContext(state: SimState, progress: ReturnType<typeof waveProgressSnapshot>): StrategyContext {
  return {
    runMs: state.now,
    wave: progress.wave,
    totalWaves: progress.totalWaves,
    phase: progress.phase,
    nextEventMs: progress.nextEventMs,
    activeEnemies: state.enemies.length,
    coins: state.coins,
    lives: state.lives,
    towers: state.towers.map(towerSummary),
  }
}

export { waveProgressSnapshot }

