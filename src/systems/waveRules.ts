export interface WaveLike<TEnemy> {
  enemies: readonly TEnemy[]
  spawnEveryMs: number
}

export interface WaveSpawnState {
  waveIndex: number
  nextEnemyIndex: number
  nextSpawnAt: number
  betweenWaveUntil: number
  betweenWaveMs: number
}

export interface ScalableEnemy {
  hp: number
  reward: number
}

export function createWaveState(startAt: number, betweenWaveMs: number): WaveSpawnState {
  return { waveIndex: 0, nextEnemyIndex: 0, nextSpawnAt: startAt, betweenWaveUntil: 0, betweenWaveMs }
}

export function isWaveRunComplete(state: WaveSpawnState, totalWaves: number): boolean {
  return state.waveIndex >= totalWaves
}

export function nextWaveEnemy<TEnemy>(
  state: WaveSpawnState,
  now: number,
  waves: readonly WaveLike<TEnemy>[],
): TEnemy | undefined {
  if (isWaveRunComplete(state, waves.length) || now < state.nextSpawnAt || now < state.betweenWaveUntil) return undefined
  return waves[state.waveIndex]?.enemies[state.nextEnemyIndex]
}

export function markWaveEnemySpawned<TEnemy>(
  state: WaveSpawnState,
  now: number,
  waves: readonly WaveLike<TEnemy>[],
): void {
  const wave = waves[state.waveIndex]
  if (!wave) return

  state.nextEnemyIndex += 1
  state.nextSpawnAt = now + wave.spawnEveryMs
  if (state.nextEnemyIndex >= wave.enemies.length) {
    state.waveIndex += 1
    state.nextEnemyIndex = 0
    state.betweenWaveUntil = now + state.betweenWaveMs
    state.nextSpawnAt = state.betweenWaveUntil
  }
}

export function scaleEnemyStats<TEnemy extends ScalableEnemy>(base: TEnemy, waveIndex: number): TEnemy {
  const scale = 1 + waveIndex * 0.18
  return {
    ...base,
    hp: Math.round(base.hp * scale),
    reward: base.reward + Math.floor(waveIndex * 2),
  }
}
