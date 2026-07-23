import assert from 'node:assert/strict'
import {
  advanceEnemyAlongPath,
  canAffordTower,
  chooseTowerTarget,
  computeTowerUpgrade,
  damageEnemy,
  distanceBetween,
  refundForTower,
  spendCoins,
} from '../.tmp-tests/src/systems/towerDefenseRules.js'

const path = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 100 },
]

assert.equal(canAffordTower(100, { cost: 75 }), true, 'player can buy affordable tower')
assert.equal(canAffordTower(50, { cost: 75 }), false, 'player cannot buy tower without coins')
assert.equal(spendCoins(100, 75), 25, 'spending subtracts tower cost')
assert.equal(refundForTower({ cost: 80, level: 2, upgradeCost: 50 }), 78, 'sell refund includes half base+upgrade spend')

assert.equal(distanceBetween({ x: 0, y: 0 }, { x: 3, y: 4 }), 5, 'distance uses euclidean length')

assert.deepEqual(
  advanceEnemyAlongPath({ x: 0, y: 0, pathIndex: 0, progress: 0 }, path, 60),
  { x: 60, y: 0, pathIndex: 0, progress: 60, escaped: false },
  'enemy advances along first path segment',
)

assert.deepEqual(
  advanceEnemyAlongPath({ x: 80, y: 0, pathIndex: 0, progress: 80 }, path, 50),
  { x: 100, y: 30, pathIndex: 1, progress: 30, escaped: false },
  'enemy carries leftover movement into next segment',
)

assert.equal(
  advanceEnemyAlongPath({ x: 100, y: 90, pathIndex: 1, progress: 90 }, path, 20).escaped,
  true,
  'enemy escapes after passing final waypoint',
)

const enemies = [
  { id: 'tank', x: 180, y: 100, hp: 30, pathIndex: 0, progress: 70, escaped: false },
  { id: 'runner', x: 120, y: 100, hp: 10, pathIndex: 0, progress: 95, escaped: false },
  { id: 'dead', x: 110, y: 100, hp: 0, pathIndex: 0, progress: 120, escaped: false },
]
assert.equal(
  chooseTowerTarget({ x: 100, y: 100, range: 90 }, enemies)?.id,
  'runner',
  'tower targets living enemy furthest along path inside range',
)

assert.deepEqual(damageEnemy({ hp: 12, slowedUntil: 0 }, 15, 500), { hp: 0, killed: true, slowedUntil: 500 })
assert.deepEqual(computeTowerUpgrade({ level: 1, damage: 8, range: 90, fireRateMs: 700, upgradeCost: 50 }), {
  level: 2,
  damage: 12,
  range: 100,
  fireRateMs: 630,
  upgradeCost: 75,
})

console.log('towerDefenseRules tests passed')
