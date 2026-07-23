import { WAVES } from '../data/towerDefense.js'
import type { SimulatedStrategyResult, StrategyDefinition } from './balanceTypes.js'
import type { SimState } from './balanceSimulationMath.js'
import { getWaveMetrics, towerSummary, updateWaveEnd } from './balanceSimulationMath.js'

export function buildDefeatResult(state: SimState, strategy: StrategyDefinition, currentWave: number): SimulatedStrategyResult | null {
  if (state.lives > 0) return null
  return {
    strategy: strategy.id,
    strategyName: strategy.name,
    outcome: 'defeat',
    finalCoins: state.coins,
    finalLives: 0,
    totalKills: state.totalKills,
    totalLeaks: state.totalLeaks,
    wavesCleared: Math.max(0, state.waveState.waveIndex - (state.enemies.length > 0 ? 1 : 0)),
    wavesReached: Math.max(1, Math.min(state.waveState.waveIndex, WAVES.length)),
    finalWave: Math.max(1, Math.min(currentWave, WAVES.length)),
    waveSnapshots: state.waveSnapshots,
    finalTowers: state.towers.map(towerSummary),
    elapsedMs: state.now,
  }
}

export function buildVictoryResult(state: SimState, strategy: StrategyDefinition): SimulatedStrategyResult | null {
  if (!(state.waveState.waveIndex >= WAVES.length && state.enemies.length === 0)) return null
  const wavesCleared = WAVES.length
  updateWaveEnd(state, wavesCleared)
  return {
    strategy: strategy.id,
    strategyName: strategy.name,
    outcome: 'victory',
    finalCoins: state.coins,
    finalLives: state.lives,
    totalKills: state.totalKills,
    totalLeaks: state.totalLeaks,
    wavesCleared,
    wavesReached: wavesCleared,
    finalWave: wavesCleared,
    waveSnapshots: state.waveSnapshots,
    finalTowers: state.towers.map(towerSummary),
    elapsedMs: state.now,
  }
}

export function buildTimeoutResult(state: SimState, strategy: StrategyDefinition): SimulatedStrategyResult {
  const reached = Math.min(state.waveState.waveIndex, WAVES.length)
  return {
    strategy: strategy.id,
    strategyName: strategy.name,
    outcome: reached >= WAVES.length ? 'victory' : 'defeat',
    finalCoins: state.coins,
    finalLives: state.lives,
    totalKills: state.totalKills,
    totalLeaks: state.totalLeaks,
    wavesCleared: reached,
    wavesReached: reached,
    finalWave: Math.min(reached + 1, WAVES.length),
    waveSnapshots: state.waveSnapshots,
    finalTowers: state.towers.map(towerSummary),
    elapsedMs: state.now,
  }
}
