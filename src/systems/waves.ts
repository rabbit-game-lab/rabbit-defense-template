import { CONFIG } from '../game.config'
import { ENEMIES, type EnemyType, WAVES } from '../data/towerDefense'
import {
  createWaveState as createPureWaveState,
  isWaveRunComplete,
  markWaveEnemySpawned,
  nextWaveEnemy,
  prepareFirstWave,
  scaleEnemyStats,
  createWaveProgressSnapshot,
  type WaveSpawnState,
  type WaveProgressSnapshot,
} from './waveRules'

export type { WaveSpawnState } from './waveRules'
export type { WaveProgressSnapshot } from './waveRules'

export function createWaveState(
  startAt: number,
  betweenWaveMs = CONFIG.waves.betweenWaveDelayMs,
  firstWaveDelayMs = CONFIG.waves.firstWavePrepareDelayMs,
): WaveSpawnState {
  return createPureWaveState(startAt, betweenWaveMs, firstWaveDelayMs)
}

export function prepareFirstWaveForCombat(state: WaveSpawnState, now: number): void {
  prepareFirstWave(state, now)
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

export function waveProgressSnapshot(state: WaveSpawnState, now: number, activeEnemyCount: number): WaveProgressSnapshot {
  return createWaveProgressSnapshot(state, now, WAVES, activeEnemyCount)
}

export function makeEnemyStats(type: EnemyType, waveIndex: number) {
  return scaleEnemyStats(ENEMIES[type], waveIndex)
}
