import { CONFIG } from '../game.config'
import { ENEMIES, type EnemyType, WAVES } from '../data/towerDefense'
import {
  createWaveState as createPureWaveState,
  isWaveRunComplete,
  markWaveEnemySpawned,
  nextWaveEnemy,
  scaleEnemyStats,
  type WaveSpawnState,
} from './waveRules'

export type { WaveSpawnState } from './waveRules'

export function createWaveState(
  startAt: number,
  betweenWaveMs = CONFIG.waves.betweenWaveDelayMs,
): WaveSpawnState {
  return createPureWaveState(startAt, betweenWaveMs)
}

export function isFinalWaveComplete(state: WaveSpawnState): boolean {
  return isWaveRunComplete(state, WAVES.length)
}

export function nextEnemyToSpawn(state: WaveSpawnState, now: number): EnemyType | undefined {
  return nextWaveEnemy(state, now, WAVES)
}

export function markEnemySpawned(state: WaveSpawnState, now: number): void {
  markWaveEnemySpawned(state, now, WAVES)
}

export function makeEnemyStats(type: EnemyType, waveIndex: number) {
  return scaleEnemyStats(ENEMIES[type], waveIndex)
}
