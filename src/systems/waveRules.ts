export interface WaveLike<TEnemy> {
  enemies: readonly TEnemy[]
  spawnEveryMs: number
}

export type WavePhase = 'preparing' | 'active' | 'between' | 'complete'

export interface WaveSpawnState {
  waveIndex: number
  nextEnemyIndex: number
  nextSpawnAt: number
  betweenWaveUntil: number
  betweenWaveMs: number
  firstWaveReadyAt: number
  firstWaveDelayMs: number
}

export interface ScalableEnemy {
  hp: number
  reward: number
}

export interface WaveProgressSnapshot {
  wave: number
  totalWaves: number
  phase: WavePhase
  toSpawnInCurrentWave: number
  nextEventMs: number
}

export function createWaveState(
  startAt: number,
  betweenWaveMs: number,
  firstWaveDelayMs = 3000,
): WaveSpawnState {
  return {
    waveIndex: 0,
    nextEnemyIndex: 0,
    nextSpawnAt: startAt,
    betweenWaveUntil: 0,
    betweenWaveMs,
    firstWaveReadyAt: Number.POSITIVE_INFINITY,
    firstWaveDelayMs,
  }
}

export function prepareFirstWave(state: WaveSpawnState, now: number): void {
  if (state.waveIndex !== 0 || state.nextEnemyIndex !== 0) return
  if (state.firstWaveReadyAt !== Number.POSITIVE_INFINITY) return

  state.firstWaveReadyAt = now + state.firstWaveDelayMs
  state.nextSpawnAt = state.firstWaveReadyAt
}

export function isWaveRunComplete(state: WaveSpawnState, totalWaves: number): boolean {
  return state.waveIndex >= totalWaves
}

export function nextWaveEnemy<TEnemy>(
  state: WaveSpawnState,
  now: number,
  waves: readonly WaveLike<TEnemy>[],
): TEnemy | undefined {
  if (isWaveRunComplete(state, waves.length)) return undefined
  if (state.waveIndex === 0 && now < state.firstWaveReadyAt) return undefined
  if (now < state.nextSpawnAt || now < state.betweenWaveUntil) return undefined
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
  if (state.waveIndex === 0 && state.nextEnemyIndex === 1) {
    state.firstWaveReadyAt = 0
  }
  state.nextSpawnAt = now + wave.spawnEveryMs
  if (state.nextEnemyIndex >= wave.enemies.length) {
    state.waveIndex += 1
    state.nextEnemyIndex = 0
    state.betweenWaveUntil = now + state.betweenWaveMs
    state.nextSpawnAt = state.betweenWaveUntil
  }
}

export function createWaveProgressSnapshot<TEnemy>(
  state: WaveSpawnState,
  now: number,
  waves: readonly WaveLike<TEnemy>[],
  activeEnemyCount: number,
): WaveProgressSnapshot {
  if (isWaveRunComplete(state, waves.length)) {
    return {
      wave: waves.length,
      totalWaves: waves.length,
      phase: activeEnemyCount > 0 ? 'active' : 'complete',
      toSpawnInCurrentWave: 0,
      nextEventMs: 0,
    }
  }

  if (
    state.waveIndex === 0 &&
    state.firstWaveReadyAt !== Number.POSITIVE_INFINITY &&
    now < state.firstWaveReadyAt
  ) {
    return {
      wave: state.waveIndex + 1,
      totalWaves: waves.length,
      phase: 'preparing',
      toSpawnInCurrentWave: waves[state.waveIndex]?.enemies.length ?? 0,
      nextEventMs: Math.max(0, state.nextSpawnAt - now),
    }
  }

  if (state.waveIndex === 0 && state.firstWaveReadyAt === Number.POSITIVE_INFINITY) {
    return {
      wave: state.waveIndex + 1,
      totalWaves: waves.length,
      phase: 'preparing',
      toSpawnInCurrentWave: waves[state.waveIndex]?.enemies.length ?? 0,
      nextEventMs: Math.max(0, state.nextSpawnAt - now),
    }
  }

  if (now < state.betweenWaveUntil) {
    return {
      wave: state.waveIndex + 1,
      totalWaves: waves.length,
      phase: 'between',
      toSpawnInCurrentWave: waves[state.waveIndex]?.enemies.length ?? 0,
      nextEventMs: Math.max(0, state.betweenWaveUntil - now),
    }
  }

  return {
    wave: state.waveIndex + 1,
    totalWaves: waves.length,
    phase: 'active',
    toSpawnInCurrentWave: (waves[state.waveIndex]?.enemies.length ?? 0) - state.nextEnemyIndex,
    nextEventMs: Math.max(0, state.nextSpawnAt - now),
  }
}

export interface WaveEnemyGroup<TEnemy> {
  type: TEnemy
  count: number
}

/**
 * Groups a wave's enemy list into ordered {type, count} runs for a compact
 * "what's coming" preview. First-appearance order is preserved so the label
 * reads the way the raid actually unfolds. Returns [] for an out-of-range index.
 */
export function summarizeWave<TEnemy>(
  waves: readonly WaveLike<TEnemy>[],
  waveIndex: number,
): WaveEnemyGroup<TEnemy>[] {
  const wave = waves[waveIndex]
  if (!wave) return []

  const groups: WaveEnemyGroup<TEnemy>[] = []
  for (const enemy of wave.enemies) {
    const existing = groups.find((group) => group.type === enemy)
    if (existing) existing.count += 1
    else groups.push({ type: enemy, count: 1 })
  }
  return groups
}

export function scaleEnemyStats<TEnemy extends ScalableEnemy>(base: TEnemy, waveIndex: number): TEnemy {
  const scale = 1 + waveIndex * 0.18
  return {
    ...base,
    hp: Math.round(base.hp * scale),
    reward: base.reward + Math.floor(waveIndex * 2),
  }
}
