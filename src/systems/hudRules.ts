import type { WaveProgressSnapshot } from './waveRules'

export interface TimedHudMessage {
  text: string
  expiresAtMs: number
}

export function createTimedHudMessage(text: string, nowMs: number, durationMs: number): TimedHudMessage | undefined {
  const trimmed = text.trim()
  if (trimmed.length === 0 || durationMs <= 0) return undefined
  return {
    text: trimmed,
    expiresAtMs: nowMs + durationMs,
  }
}

export function resolveHudStatus(
  nowMs: number,
  placementMessage: TimedHudMessage | undefined,
  combatMessage: TimedHudMessage | undefined,
  fallback: string,
): string {
  if (isValidMessage(nowMs, placementMessage)) return placementMessage!.text
  if (isValidMessage(nowMs, combatMessage)) return combatMessage!.text
  return fallback
}

export function getRunFallbackStatus(hasPlacedTower: boolean): string {
  return hasPlacedTower
    ? 'Defend the keep — build or upgrade between waves.'
    : 'Drag a tower from the shop to a build circle.'
}

function isValidMessage(nowMs: number, message: TimedHudMessage | undefined): message is TimedHudMessage {
  return Boolean(message && message.expiresAtMs > nowMs)
}

export function formatWaveHud(snapshot: WaveProgressSnapshot, activeEnemies: number): string {
  if (snapshot.phase === 'complete') return 'All waves cleared'

  if (snapshot.phase === 'preparing') {
    if (snapshot.nextEventMs <= 0) return 'Build your first tower'
    return `Wave ${snapshot.wave} starts in ${Math.ceil(snapshot.nextEventMs / 1000)}s`
  }

  if (snapshot.phase === 'active') {
    return `Wave ${snapshot.wave} · ${snapshot.toSpawnInCurrentWave + activeEnemies} left`
  }

  if (activeEnemies === 0) {
    return `Wave ${snapshot.wave} starts in ${Math.ceil(snapshot.nextEventMs / 1000)}s`
  }

  return `Wave ${snapshot.wave - 1} · ${activeEnemies} active · Next ${Math.ceil(snapshot.nextEventMs / 1000)}s`
}
