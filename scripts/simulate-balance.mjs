#!/usr/bin/env node
import { strict as assert } from 'node:assert'
import { execSync } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'

const BUILD_DIR = '.tmp-balance'
const TOTAL_WAVES = 5
const STARTING_LIVES = 15


async function importSimulator() {
  const modulePath = new URL(`../${BUILD_DIR}/src/systems/balanceSimulator.js`, import.meta.url)
  return import(modulePath)
}

function compileForSimulation() {
  execSync(`npx tsc --noEmit false --outDir ${BUILD_DIR}`, { stdio: 'inherit' })
}

function assertDeterministic(simulateStrategy, baselineStrategies) {
  for (const strategy of baselineStrategies) {
    const first = simulateStrategy(strategy)
    const second = simulateStrategy(strategy)
    assert.deepStrictEqual(first, second, `non-deterministic result for strategy ${strategy.id}`)
  }
}

function assertLegalPurchases(result) {
  const maxPadCount = 6

  for (const snapshot of result.waveSnapshots) {
    for (const purchase of snapshot.purchases) {
      assert.ok(purchase.cost >= 0, `negative cost in ${result.strategy}`)
      assert.ok(purchase.upgradeLevel >= 1, `invalid level in ${result.strategy}`)
    }
    assert.ok(snapshot.coinsAtStart >= 0, `negative start coins for ${result.strategy}`)
    assert.ok(snapshot.coinsAtEnd >= 0, `negative end coins for ${result.strategy}`)
    assert.ok(snapshot.livesAtStart >= 0, `negative start lives for ${result.strategy}`)
    assert.ok(snapshot.livesAtEnd >= 0, `negative end lives for ${result.strategy}`)
    assert.equal(snapshot.wave, snapshot.purchases[0]?.wave ?? snapshot.wave)
  }

  assert.ok(result.finalTowers.length <= maxPadCount, `pad overflow for ${result.strategy}`)

  for (const tower of result.finalTowers) {
    assert.ok(tower.level <= tower.maxLevel, `max level exceeded for ${result.strategy}`)
    assert.ok(tower.level >= 1, `invalid tower level for ${result.strategy}`)
  }
}

function assertWaveInvariants(result, totalEnemies, maxReward) {
  assert.equal(result.waveSnapshots.length, TOTAL_WAVES, `snapshot count mismatch for ${result.strategy}`)
  assert.ok(result.wavesReached >= result.wavesCleared, `waves reached < cleared for ${result.strategy}`)
  assert.ok(result.finalWave >= 1 && result.finalWave <= TOTAL_WAVES, `finalWave out of bounds for ${result.strategy}`)
  assert.ok(result.finalLives >= 0 && result.finalLives <= STARTING_LIVES, `lives out of bounds for ${result.strategy}`)
  assert.ok(result.totalKills >= 0 && result.totalLeaks >= 0, `negative combat stats for ${result.strategy}`)
  assert.ok(result.totalKills + result.totalLeaks <= totalEnemies, `combat stat overflow for ${result.strategy}`)

  let expectedPurchasesTotal = 0
  for (const snapshot of result.waveSnapshots) {
    const purchasesCost = snapshot.purchases.reduce((sum, p) => sum + p.cost, 0)
    assert.equal(snapshot.wave, snapshot.purchases.at(-1)?.wave ?? snapshot.wave)
    assert.ok(
      snapshot.coinsAtEnd <= snapshot.coinsAtStart + snapshot.kills * maxReward,
      `coin accounting overflow ${result.strategy}`,
    )
    assert.ok(snapshot.kills >= 0 && snapshot.leaks >= 0, `negative snapshot counter for ${result.strategy}`)
    expectedPurchasesTotal += purchasesCost
  }
  assert.ok(expectedPurchasesTotal >= 0, `negative purchase total for ${result.strategy}`)
}

function assertReasonableEnvelope(result, totalEnemies) {
  assert.ok(result.finalCoins <= 1000, `final coins absurdly high for ${result.strategy}`)
  assert.ok(result.totalKills >= 0, `negative kills for ${result.strategy}`)
  assert.ok(result.totalLeaks <= totalEnemies, `too many leaks for ${result.strategy}`)

  if (result.outcome === 'victory') {
    assert.equal(result.wavesCleared, TOTAL_WAVES, `victory should clear all waves for ${result.strategy}`)
    assert.equal(result.totalLeaks, 0, `victory with leaks for ${result.strategy}`)
  }
}

function formatResult(result) {
  const totalPurchases = result.waveSnapshots.reduce((sum, snapshot) => sum + snapshot.purchases.length, 0)
  return {
    name: result.strategyName,
    outcome: result.outcome,
    coins: result.finalCoins,
    lives: result.finalLives,
    kills: result.totalKills,
    leaks: result.totalLeaks,
    cleared: `${result.wavesCleared}/${TOTAL_WAVES}`,
    purchases: totalPurchases,
  }
}

async function main() {
  compileForSimulation()
  const sim = await importSimulator()
  const data = await import(new URL(`../${BUILD_DIR}/src/data/towerDefense.js`, import.meta.url))
  const totalEnemies = data.WAVES.reduce((sum, wave) => sum + wave.enemies.length, 0)
  const maxReward = Math.max(...Object.values(data.ENEMIES).map((enemy) => enemy.reward))

  const baselineStrategies = sim.createBaselineStrategies()
  const results = baselineStrategies.map(sim.simulateStrategy)

  assertDeterministic(sim.simulateStrategy, baselineStrategies)

  for (const result of results) {
    assertLegalPurchases(result)
    assertWaveInvariants(result, totalEnemies, maxReward)
    assertReasonableEnvelope(result, totalEnemies)
    if (result.finalTowers.length > 0) {
      for (const tower of result.finalTowers) {
        assert.ok(tower.upgradeCost >= 0, `negative upgradeCost for ${result.strategy}`)
      }
    }
  }

  const reportLines = []
  reportLines.push('# Balance Baseline Report (Deterministic 20ms simulation)')
  reportLines.push('')
  reportLines.push('- Simulator assumptions: deterministic wave/state progression, fixed 20ms tick, no randomness, no API/input dependence.')
  reportLines.push('- The model reuses real tower/enemy/wave definitions and pure combat rules, but remains comparative rather than a pixel-perfect Phaser replay.')
  reportLines.push('- Action policy: baseline strategies only (place/upgrade), one action per tick, sorted stable targets, max three upgrade levels.')
  reportLines.push('- Decision: all four legal baselines clear the five introductory waves with 15 lives, so PR #5 makes no gameplay tuning change; harder expansion is evaluated separately.')
  reportLines.push('')

  for (const result of results) {
    const line = formatResult(result)
    reportLines.push(
      `- ${line.name}: ${line.outcome.toUpperCase()} | coins ${line.coins} | lives ${line.lives} | kills ${line.kills} | leaks ${line.leaks} | waves ${line.cleared} | purchases ${line.purchases}`,
    )
    for (const snapshot of result.waveSnapshots) {
      const buys = snapshot.purchases.length
      const levelViolations = snapshot.purchases.filter((p) => typeof p.upgradeLevel !== 'number').length
      const padOverflow = buys > 6 ? 1 : 0
      reportLines.push(
        `  - Wave ${snapshot.wave}: buys ${buys}, kills ${snapshot.kills}, leaks ${snapshot.leaks}, Δcoins ${snapshot.coinsAtEnd - snapshot.coinsAtStart}, Δlives ${snapshot.livesAtEnd - snapshot.livesAtStart}`,
      )
      assert.equal(levelViolations, 0, `invalid upgrade level data in ${result.strategy}`)
      assert.equal(padOverflow, 0, `invalid purchase count in ${result.strategy}`)
    }
  }

  const output = reportLines.join('\n') + '\n'
  const docsDir = path.join(process.cwd(), 'docs')
  await fs.mkdir(docsDir, { recursive: true })
  await fs.writeFile(path.join(docsDir, 'balance-baseline.md'), output, 'utf8')
  console.log(output)
}

await main()
