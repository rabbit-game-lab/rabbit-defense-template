import { CONFIG } from '../game.config.js'
import { ENEMIES, type EnemyType, WAVES } from '../data/towerDefense.js'
import {
  createWaveState as createPureWaveState,
  isWaveRunComplete,
  markWaveEnemySpawned,
  nextWaveEnemy,
  prepareFirstWave,
  scaleEnemyStats,
  summarizeWave,
  createWaveProgressSnapshot,
  type WaveEnemyGroup,
  type WaveSpawnState,
  type WaveProgressSnapshot,
} from './waveRules.js'

export type { WaveSpawnState } from './waveRules.js'
export type { WaveProgressSnapshot } from './waveRules.js'
export type { WaveEnemyGroup } from './waveRules.js'

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

export function summarizeWaveEnemies(waveIndex: number): WaveEnemyGroup<EnemyType>[] {
  return summarizeWave(WAVES, waveIndex)
}
