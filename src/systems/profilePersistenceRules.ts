export const PROFILE_STORAGE_KEY = 'rabbit-defense-profile'
export const PROFILE_SCHEMA_VERSION = 1

export interface ProfileRecord {
  schemaVersion: number
  onboardingCompleted: boolean
  wins: number
  defeats: number
  bestLives: number
  bestCoins: number
  fastestWinMs: number
}

export interface PersistedProfileRecord {
  v: number
  o: 0 | 1
  w: number
  d: number
  l: number
  c: number
  f: number
}

export function createEmptyProfile(): ProfileRecord {
  return {
    schemaVersion: PROFILE_SCHEMA_VERSION,
    onboardingCompleted: false,
    wins: 0,
    defeats: 0,
    bestLives: 0,
    bestCoins: 0,
    fastestWinMs: 0,
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function clampNonNegativeNumber(value: unknown, fallback = 0): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return fallback
  return Math.floor(value)
}

export function hydrateProfileFromLegacy(value: Record<string, unknown>): ProfileRecord {
  const output = createEmptyProfile()

  if (typeof value.schemaVersion === 'number') {
    output.schemaVersion = value.schemaVersion
  }

  if (typeof value.onboardingCompleted === 'boolean') {
    output.onboardingCompleted = value.onboardingCompleted
  }

  if (typeof value.wins === 'number') {
    output.wins = clampNonNegativeNumber(value.wins)
  }
  if (typeof value.defeats === 'number') {
    output.defeats = clampNonNegativeNumber(value.defeats)
  }
  if (typeof value.bestLives === 'number') {
    output.bestLives = clampNonNegativeNumber(value.bestLives)
  }
  if (typeof value.bestCoins === 'number') {
    output.bestCoins = clampNonNegativeNumber(value.bestCoins)
  }
  if (typeof value.fastestWinMs === 'number') {
    output.fastestWinMs = clampNonNegativeNumber(value.fastestWinMs)
  }

  return output
}

function hydrateCompact(value: PersistedProfileRecord): ProfileRecord {
  return {
    schemaVersion: value.v ?? PROFILE_SCHEMA_VERSION,
    onboardingCompleted: value.o === 1,
    wins: clampNonNegativeNumber(value.w),
    defeats: clampNonNegativeNumber(value.d),
    bestLives: clampNonNegativeNumber(value.l),
    bestCoins: clampNonNegativeNumber(value.c),
    fastestWinMs: clampNonNegativeNumber(value.f),
  }
}

function migrateProfile(raw: ProfileRecord): ProfileRecord {
  return {
    ...createEmptyProfile(),
    ...raw,
    schemaVersion: PROFILE_SCHEMA_VERSION,
  }
}

export function deserializeProfile(raw: string | null): ProfileRecord {
  if (!raw) return createEmptyProfile()
  try {
    const parsed = JSON.parse(raw) as unknown

    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      const legacy = parsed as Record<string, unknown>
      if (Array.isArray((legacy as never)['_']) || typeof legacy === 'object') {
        if (
          (legacy as Record<string, unknown>).v === undefined &&
          (legacy as Record<string, unknown>).o === undefined &&
          (legacy as Record<string, unknown>).w === undefined
        ) {
          return hydrateProfileFromLegacy(legacy)
        }
      }

      if (typeof legacy.v === 'number' && [0, 1, 2].includes(legacy.v)) {
        return migrateProfile(hydrateCompact(legacy as unknown as PersistedProfileRecord))
      }

      return hydrateProfileFromLegacy(legacy)
    }

    if (Array.isArray(parsed) && parsed.length >= 7 && parsed[0] === PROFILE_SCHEMA_VERSION) {
      const compact = parsed as unknown[]
      return hydrateCompact({
        v: Number(compact[0] ?? PROFILE_SCHEMA_VERSION),
        o: compact[1] ? 1 : 0,
        w: Number(compact[2] ?? 0),
        d: Number(compact[3] ?? 0),
        l: Number(compact[4] ?? 0),
        c: Number(compact[5] ?? 0),
        f: Number(compact[6] ?? 0),
      })
    }
  } catch {
    return createEmptyProfile()
  }

  return createEmptyProfile()
}

export function serializeProfile(profile: ProfileRecord): string {
  const compact: PersistedProfileRecord = {
    v: PROFILE_SCHEMA_VERSION,
    o: profile.onboardingCompleted ? 1 : 0,
    w: profile.wins,
    d: profile.defeats,
    l: profile.bestLives,
    c: profile.bestCoins,
    f: profile.fastestWinMs,
  }
  return JSON.stringify(compact)
}

export interface RunResultForPersistence {
  outcome: 'victory' | 'defeat'
  wavesCleared: number
  wavesReached: number
  kills: number
  leaks: number
  livesRemaining: number
  coinsRemaining: number
  durationMs: number
}

export function applyRunResultToProfile(profile: ProfileRecord, result: RunResultForPersistence): ProfileRecord {
  const next: ProfileRecord = { ...profile }

  if (result.outcome === 'victory') {
    next.wins += 1
    if (result.livesRemaining > next.bestLives) next.bestLives = result.livesRemaining
    if (result.coinsRemaining > next.bestCoins) next.bestCoins = result.coinsRemaining
    if (next.fastestWinMs === 0 || result.durationMs < next.fastestWinMs) {
      next.fastestWinMs = result.durationMs
    }
  } else {
    next.defeats += 1
  }

  if (result.wavesCleared > profile.wins + profile.defeats) {
    // no-op placeholder branch kept for future richer metrics (not persisted today)
  }

  return next
}

export interface RunSessionProfileResult {
  profile: ProfileRecord
  wasUpdated: boolean
}

export function ensureOnboardingComplete(profile: ProfileRecord, complete = true): ProfileRecord {
  if (profile.onboardingCompleted === complete) return profile
  return { ...profile, onboardingCompleted: complete }
}

export function mergeProfileRecord(next: ProfileRecord, previous: ProfileRecord): ProfileRecord {
  if (next.schemaVersion > previous.schemaVersion) {
    return next
  }
  return { ...previous, ...next, schemaVersion: PROFILE_SCHEMA_VERSION }
}
