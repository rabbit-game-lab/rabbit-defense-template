import assert from 'node:assert/strict'
import {
  advanceEnemyAlongPath,
  canAffordTower,
  chooseTowerTarget,
  computeTowerUpgrade,
  createTowerUpgradePreview,
  resolveTowerUpgradeRequest,
  damageEnemy,
  distanceBetween,
  evaluateSlowImpact,
  formatTowerUpgradePreview,
  refundForTower,
  spendCoins,
} from '../.tmp-tests/src/systems/towerDefenseRules.js'

import {
  createRunState,
  finishRun,
  getRunStatus,
  isRunActive,
} from '../.tmp-tests/src/systems/runState.js'

import {
  createWaveState,
  prepareFirstWave,
  createWaveProgressSnapshot,
  isWaveRunComplete,
  markWaveEnemySpawned,
  nextWaveEnemy,
  scaleEnemyStats,
} from '../.tmp-tests/src/systems/waveRules.js'

const path = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 100 },
]

assert.equal(canAffordTower(100, { cost: 75 }), true)
assert.equal(canAffordTower(50, { cost: 75 }), false)
assert.equal(spendCoins(100, 75), 25)
assert.equal(refundForTower({ cost: 80, level: 2, upgradeCost: 50 }), 78)
assert.equal(distanceBetween({ x: 0, y: 0 }, { x: 3, y: 4 }), 5)
assert.deepEqual(
  advanceEnemyAlongPath({ x: 0, y: 0, pathIndex: 0, progress: 0 }, path, 60),
  { x: 60, y: 0, pathIndex: 0, progress: 60, escaped: false },
)
assert.deepEqual(
  advanceEnemyAlongPath({ x: 80, y: 0, pathIndex: 0, progress: 80 }, path, 50),
  { x: 100, y: 30, pathIndex: 1, progress: 30, escaped: false },
)
assert.equal(advanceEnemyAlongPath({ x: 100, y: 90, pathIndex: 1, progress: 90 }, path, 20).escaped, true)

const enemies = [
  { id: 'tank', x: 180, y: 100, hp: 30, pathIndex: 0, progress: 70, escaped: false },
  { id: 'runner', x: 120, y: 100, hp: 10, pathIndex: 0, progress: 95, escaped: false },
  { id: 'dead', x: 110, y: 100, hp: 0, pathIndex: 0, progress: 120, escaped: false },
]
assert.equal(chooseTowerTarget({ x: 100, y: 100, range: 90 }, enemies)?.id, 'runner')

assert.deepEqual(
  evaluateSlowImpact({ slowFactor: 1, slowUntil: 0 }, { slowFactor: 0.55, slowUntil: 1200 }, 100),
  { slowFactor: 0.55, slowUntil: 1200 },
  'fresh slow applies its configured factor',
)
assert.deepEqual(
  evaluateSlowImpact({ slowFactor: 0.55, slowUntil: 500 }, { slowFactor: 0.8, slowUntil: 1400 }, 600),
  { slowFactor: 0.8, slowUntil: 1400 },
  'expired slow cannot leak its stronger factor into a new impact',
)
assert.deepEqual(
  evaluateSlowImpact({ slowFactor: 0.55, slowUntil: 900 }, { slowFactor: 0.8, slowUntil: 1500 }, 500),
  { slowFactor: 0.55, slowUntil: 1500 },
  'active stronger slow keeps its factor and extends expiry',
)
assert.deepEqual(
  evaluateSlowImpact({ slowFactor: 0.8, slowUntil: 900 }, { slowFactor: 0.55, slowUntil: 700 }, 500),
  { slowFactor: 0.55, slowUntil: 900 },
  'incoming stronger slow uses the strongest factor and longest expiry',
)
assert.deepEqual(
  damageEnemy({ hp: 12, slowFactor: 0.55, slowUntil: 500 }, 15, 600),
  { hp: 0, killed: true, slowFactor: 1, slowUntil: 0 },
  'damage clears expired slow state',
)
assert.deepEqual(computeTowerUpgrade({ level: 1, damage: 8, range: 90, fireRateMs: 700, upgradeCost: 50 }), {
  level: 2,
  damage: 12,
  range: 100,
  fireRateMs: 630,
  upgradeCost: 75,
})

const upgradePreview = createTowerUpgradePreview({
  level: 1,
  damage: 8,
  range: 90,
  fireRateMs: 700,
  upgradeCost: 55,
})
assert.deepEqual(upgradePreview, {
  next: {
    level: 2,
    damage: 12,
    range: 100,
    fireRateMs: 630,
    upgradeCost: 83,
  },
  delta: {
    damage: 4,
    range: 10,
    fireRateMs: -70,
  },
  cost: 55,
  summary: '+4 Damage · +10 Range · -70ms fire rate',
})

const noSelection = resolveTowerUpgradeRequest(null, 999)
assert.equal(noSelection.type, 'no-selection')
assert.equal(noSelection.reason, 'no-selection')

const unaffordable = resolveTowerUpgradeRequest(
  {
    level: 1,
    damage: 8,
    range: 90,
    fireRateMs: 700,
    upgradeCost: 60,
  },
  40,
)
assert.equal(unaffordable.type, 'insufficient-funds')
assert.equal(unaffordable.reason, 'insufficient-funds')
assert.equal(unaffordable.needed, 60)

const affordableUpgrade = resolveTowerUpgradeRequest(
  {
    level: 1,
    damage: 8,
    range: 90,
    fireRateMs: 700,
    upgradeCost: 60,
  },
  60,
)
assert.equal(affordableUpgrade.type, 'success')
assert.equal(affordableUpgrade.reason, 'success')
assert.deepEqual(affordableUpgrade.next, {
  level: 2,
  damage: 12,
  range: 100,
  fireRateMs: 630,
  upgradeCost: 90,
})
assert.equal(affordableUpgrade.cost, 60)
assert.equal(affordableUpgrade.remainingCoins, 0)

assert.equal(formatTowerUpgradePreview(upgradePreview), '+4 Damage · +10 Range · -70ms fire rate')

const waves = [
  { enemies: ['a', 'b'], spawnEveryMs: 100 },
  { enemies: ['c'], spawnEveryMs: 50 },
]
const waveState = createWaveState(1000, 300, 3000)
assert.equal(nextWaveEnemy(waveState, 1000, waves), undefined, 'first wave is blocked until a tower is placed')
assert.equal(createWaveProgressSnapshot(waveState, 1000, waves, 0).phase, 'preparing', 'snapshot starts in preparing')
prepareFirstWave(waveState, 1500)
assert.equal(createWaveProgressSnapshot(waveState, 3000, waves, 0).phase, 'preparing', 'snapshot remains in preparing during first countdown')
assert.equal(nextWaveEnemy(waveState, 4499, waves), undefined, 'first tower signal schedules delayed first spawn')
assert.equal(createWaveProgressSnapshot(waveState, 4499, waves, 0).nextEventMs, 1, 'countdown stays deterministic before first wave')
assert.equal(nextWaveEnemy(waveState, 4500, waves), 'a', 'deterministic first-wave countdown of 3000ms')
markWaveEnemySpawned(waveState, 4500, waves)
assert.equal(createWaveProgressSnapshot(waveState, 4500, waves, 0).phase, 'active', 'first spawn puts wave in active phase')
assert.equal(nextWaveEnemy(waveState, 4599, waves), undefined)
assert.equal(nextWaveEnemy(waveState, 4600, waves), 'b')
markWaveEnemySpawned(waveState, 4600, waves)
assert.equal(waveState.waveIndex, 1)
assert.equal(waveState.betweenWaveUntil, 4900)
assert.equal(createWaveProgressSnapshot(waveState, 4850, waves, 0).phase, 'between', 'between phase is explicit and timed')
assert.equal(createWaveProgressSnapshot(waveState, 4850, waves, 0).nextEventMs, 50, 'next event countdown tracks delay before next wave')
assert.equal(nextWaveEnemy(waveState, 4899, waves), undefined)
assert.equal(nextWaveEnemy(waveState, 4900, waves), 'c', 'configured cooldown gates the next wave')
markWaveEnemySpawned(waveState, 4900, waves)
assert.equal(isWaveRunComplete(waveState, waves.length), true)
const completeSnapshot = createWaveProgressSnapshot(waveState, 9999, waves, 0)
assert.equal(completeSnapshot.phase, 'complete', 'complete phase at no waves left and no active enemies')
assert.equal(completeSnapshot.nextEventMs, 0)
assert.equal(completeSnapshot.toSpawnInCurrentWave, 0)
assert.equal(nextWaveEnemy(waveState, 9999, waves), undefined)
assert.deepEqual(scaleEnemyStats({ hp: 26, reward: 9 }, 0), { hp: 26, reward: 9 })
assert.deepEqual(scaleEnemyStats({ hp: 26, reward: 9 }, 2), { hp: 35, reward: 13 })

const running = createRunState(100)
assert.equal(isRunActive(running), true)
assert.equal(getRunStatus(running), 'running')
const victory = finishRun(running, 'victory', 500)
assert.equal(victory.didTransition, true)
assert.deepEqual(victory.state, { status: 'won', startedAt: 100, endedAt: 500 })
const repeated = finishRun(victory.state, 'defeat', 900)
assert.equal(repeated.didTransition, false, 'terminal transition is idempotent')
assert.equal(repeated.state, victory.state, 'repeated finish preserves the original object and outcome')

console.log('towerDefenseRules, waveRules, and runState tests passed')
