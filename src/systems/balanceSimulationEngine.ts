import { WAVES } from '../data/towerDefense.js'
import { type StrategyDefinition, type SimulatedStrategyResult } from './balanceTypes.js'
import {
  advanceEnemies,
  applyAction,
  buildContext,
  createSimulationState,
  fireTowers,
  getWaveMetrics,
  impactProjectiles,
  MAX_SIM_TIME_MS,
  spawnEnemyIfDue,
  STEP_MS,
  type SimState,
  updateWaveEnd,
  updateWaveStart,
  waveProgressSnapshot,
} from './balanceSimulationMath.js'
import { buildDefeatResult, buildTimeoutResult, buildVictoryResult } from './balanceSimulationOutcome.js'

export function simulateStrategy(strategy: StrategyDefinition): SimulatedStrategyResult {
  const state: SimState = createSimulationState()
  const maxSteps = Math.ceil(MAX_SIM_TIME_MS / STEP_MS)
  const wavesStarted = new Set<number>()

  for (let step = 0; step < maxSteps; step += 1) {
    state.now += STEP_MS

    const progress = waveProgressSnapshot(state.waveState, state.now, state.enemies.length)
    const currentWave = Math.min(progress.wave, WAVES.length)
    const terminalBeforeAction = buildVictoryResult(state, strategy) ?? buildDefeatResult(state, strategy, currentWave)
    if (terminalBeforeAction) return terminalBeforeAction

    updateWaveStart(state, progress.wave)
    if (!wavesStarted.has(progress.wave)) {
      wavesStarted.add(progress.wave)
      updateWaveEnd(state, progress.wave)
    }

    applyAction(state, strategy.decide(buildContext(state, progress)))

    runTick(state, progress.wave)

    const result = buildVictoryResult(state, strategy) ?? buildDefeatResult(state, strategy, currentWave)
    if (result) return result
  }

  return buildTimeoutResult(state, strategy)
}

function runTick(state: SimState, currentWave: number): void {
  spawnEnemyIfDue(state)
  fireTowers(state)
  impactProjectiles(state)
  advanceEnemies(state)

  if (currentWave >= 1) {
    const metrics = getWaveMetrics(state, currentWave)
    if (metrics) {
      metrics.coinsAtEnd = state.coins
      metrics.livesAtEnd = state.lives
    }
  }
}
