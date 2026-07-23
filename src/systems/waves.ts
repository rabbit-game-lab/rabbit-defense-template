import { ENEMIES, type EnemyType, WAVES } from '../data/towerDefense'

export interface WaveSpawnState {
  waveIndex: number
  nextEnemyIndex: number
  nextSpawnAt: number
  betweenWaveUntil: number
}

export function createWaveState(startAt: number): WaveSpawnState {
  return { waveIndex: 0, nextEnemyIndex: 0, nextSpawnAt: startAt, betweenWaveUntil: 0 }
}

export function isFinalWaveComplete(state: WaveSpawnState): boolean {
  return state.waveIndex >= WAVES.length
}

export function nextEnemyToSpawn(state: WaveSpawnState, now: number): EnemyType | undefined {
  if (isFinalWaveComplete(state) || now < state.nextSpawnAt || now < state.betweenWaveUntil) return undefined
  return WAVES[state.waveIndex]?.enemies[state.nextEnemyIndex]
}

export function markEnemySpawned(state: WaveSpawnState, now: number): void {
  const wave = WAVES[state.waveIndex]
  state.nextEnemyIndex += 1
  state.nextSpawnAt = now + wave.spawnEveryMs
  if (state.nextEnemyIndex >= wave.enemies.length) {
    state.waveIndex += 1
    state.nextEnemyIndex = 0
    state.betweenWaveUntil = now + 2600
    state.nextSpawnAt = state.betweenWaveUntil
  }
}

export function makeEnemyStats(type: EnemyType, waveIndex: number) {
  const base = ENEMIES[type]
  const scale = 1 + waveIndex * 0.18
  return {
    ...base,
    hp: Math.round(base.hp * scale),
    reward: base.reward + Math.floor(waveIndex * 2),
  }
}
