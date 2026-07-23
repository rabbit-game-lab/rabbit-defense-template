import type { WaveProgressSnapshot } from './waveRules'

export type RunOutcome = 'victory' | 'defeat'

export interface RunResultTracker {
  readonly startMs: number
  readonly kills: number
  readonly leaks: number
}

export interface RunResultSnapshot {
  outcome: RunOutcome
  durationMs: number
  wavesReached: number
  wavesCleared: number
  kills: number
  leaks: number
  livesRemaining: number
  coinsRemaining: number
}

export interface RunWaveStats {
  wavesReached: number
  wavesCleared: number
}

export function createRunResultTracker(nowMs: number): RunResultTracker {
  return { startMs: nowMs, kills: 0, leaks: 0 }
}

export function recordKill(state: RunResultTracker, count = 1): RunResultTracker {
  const increment = Math.max(0, Math.floor(count))
  if (increment <= 0) return state
  return { ...state, kills: state.kills + increment }
}

export function recordLeak(state: RunResultTracker, count = 1): RunResultTracker {
  const increment = Math.max(0, Math.floor(count))
  if (increment <= 0) return state
  return { ...state, leaks: state.leaks + increment }
}

export function deriveWaveStats(snapshot: WaveProgressSnapshot): RunWaveStats {
  if (snapshot.totalWaves <= 0) {
    return { wavesReached: 0, wavesCleared: 0 }
  }

  if (snapshot.phase === 'preparing') {
    return {
      wavesReached: 0,
      wavesCleared: 0,
    }
  }

  if (snapshot.phase === 'complete') {
    return {
      wavesReached: snapshot.totalWaves,
      wavesCleared: snapshot.totalWaves,
    }
  }

  return {
    wavesReached: Math.min(snapshot.wave, snapshot.totalWaves),
    wavesCleared: Math.max(0, snapshot.wave - 1),
  }
}

export function buildRunResult(
  tracker: RunResultTracker,
  nowMs: number,
  outcome: RunOutcome,
  snapshot: WaveProgressSnapshot,
  livesRemaining: number,
  coinsRemaining: number,
): RunResultSnapshot {
  const { wavesReached, wavesCleared } = deriveWaveStats(snapshot)
  return {
    outcome,
    durationMs: Math.max(0, nowMs - tracker.startMs),
    wavesReached,
    wavesCleared,
    kills: tracker.kills,
    leaks: tracker.leaks,
    livesRemaining,
    coinsRemaining,
  }
}
