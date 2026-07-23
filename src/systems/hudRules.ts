import type { WaveProgressSnapshot } from './waveRules'

export interface TimedHudMessage {
  text: string
  expiresAtMs: number
}

export type FeedbackLane = 'critical' | 'action' | 'ambient'

export type HudFeedback = Partial<Record<FeedbackLane, TimedHudMessage>>

export function createTimedHudMessage(text: string, nowMs: number, durationMs: number): TimedHudMessage | undefined {
  const trimmed = text.trim()
  if (trimmed.length === 0 || durationMs <= 0) return undefined
  return {
    text: trimmed,
    expiresAtMs: nowMs + durationMs,
  }
}

export function updateHudFeedback(
  feedback: HudFeedback,
  lane: FeedbackLane,
  text: string,
  nowMs: number,
  durationMs: number,
): HudFeedback {
  const message = createTimedHudMessage(text, nowMs, durationMs)
  if (!message) {
    const { [lane]: _removed, ...remaining } = feedback
    return remaining
  }
  return { ...feedback, [lane]: message }
}

export function resolveFeedbackStatus(
  nowMs: number,
  feedback: HudFeedback,
  fallback: string,
): string {
  for (const lane of ['critical', 'action', 'ambient'] as const) {
    const message = feedback[lane]
    if (isValidMessage(nowMs, message)) return message.text
  }
  return fallback
}

export function resolveHudStatus(
  nowMs: number,
  placementMessage: TimedHudMessage | undefined,
  combatMessage: TimedHudMessage | undefined,
  fallback: string,
): string {
  return resolveFeedbackStatus(
    nowMs,
    {
      action: placementMessage,
      ambient: combatMessage,
    },
    fallback,
  )
}

export function getRunFallbackStatus(hasPlacedTower: boolean): string {
  return hasPlacedTower
    ? 'Defend Hidden Dojo — build or upgrade between raids.'
    : 'Choose a defense, then place it on a clear grass square.'
}

function isValidMessage(nowMs: number, message: TimedHudMessage | undefined): message is TimedHudMessage {
  return Boolean(message && message.expiresAtMs > nowMs)
}

export function formatWaveHud(snapshot: WaveProgressSnapshot, activeEnemies: number): string {
  if (snapshot.phase === 'complete') return 'All raids repelled'

  if (snapshot.phase === 'preparing') {
    if (snapshot.nextEventMs <= 0) return 'Place your first ninja defense'
    return `Raid ${snapshot.wave} starts in ${Math.ceil(snapshot.nextEventMs / 1000)}s`
  }

  if (snapshot.phase === 'active') {
    return `Raid ${snapshot.wave} · ${snapshot.toSpawnInCurrentWave + activeEnemies} left`
  }

  if (activeEnemies === 0) {
    return `Raid ${snapshot.wave} starts in ${Math.ceil(snapshot.nextEventMs / 1000)}s`
  }

  return `Raid ${snapshot.wave - 1} · ${activeEnemies} active · Next ${Math.ceil(snapshot.nextEventMs / 1000)}s`
}
