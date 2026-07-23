import * as sdk from '../rabbit/sdk'
import {
  PROFILE_SCHEMA_VERSION,
  PROFILE_STORAGE_KEY,
  createEmptyProfile,
  deserializeProfile,
  ensureOnboardingComplete,
  serializeProfile,
  type ProfileRecord,
} from './profilePersistenceRules'

export interface AsyncStorageLike {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
}

type ProfileMutation = (current: ProfileRecord) => ProfileRecord

const fallbackMemoryStorage = new Map<string, string>()

const sdkStorageAdapter: AsyncStorageLike = {
  async getItem(key: string): Promise<string | null> {
    try {
      return sdk.storage.get(key)
    } catch {
      return fallbackMemoryStorage.get(key) ?? null
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    try {
      sdk.storage.set(key, value)
    } catch {
      fallbackMemoryStorage.set(key, value)
    }
  },
}

let adapter: AsyncStorageLike = sdkStorageAdapter
let loading: Promise<ProfileRecord> | null = null
let cache: ProfileRecord | null = null
let hasCached = false
let mutationQueue: Promise<void> = Promise.resolve()

export function __setProfileStorageAdapter(next: AsyncStorageLike): void {
  adapter = next
  loading = null
  cache = null
  hasCached = false
  mutationQueue = Promise.resolve()
}

function cloneProfile(profile: ProfileRecord): ProfileRecord {
  return {
    schemaVersion: profile.schemaVersion,
    onboardingCompleted: profile.onboardingCompleted,
    wins: profile.wins,
    defeats: profile.defeats,
    bestLives: profile.bestLives,
    bestCoins: profile.bestCoins,
    fastestWinMs: profile.fastestWinMs,
  }
}

async function loadProfileFromStorage(): Promise<ProfileRecord> {
  const stored = await adapter.getItem(PROFILE_STORAGE_KEY)
  const profile = deserializeProfile(stored)

  if (profile.schemaVersion !== PROFILE_SCHEMA_VERSION) {
    profile.schemaVersion = PROFILE_SCHEMA_VERSION
  }

  if (!Number.isFinite(profile.wins)) profile.wins = 0
  if (!Number.isFinite(profile.defeats)) profile.defeats = 0

  cache = cloneProfile(profile)
  hasCached = true
  return cloneProfile(profile)
}

export async function loadProfile(): Promise<ProfileRecord> {
  if (cache && hasCached) return cloneProfile(cache)
  if (!loading) loading = loadProfileFromStorage()
  return cloneProfile(await loading)
}

export function getCachedProfile(): ProfileRecord | null {
  return cache ? cloneProfile(cache) : null
}

export async function persistProfile(profile: ProfileRecord): Promise<ProfileRecord> {
  const safe = profile.schemaVersion === PROFILE_SCHEMA_VERSION ? profile : { ...profile, schemaVersion: PROFILE_SCHEMA_VERSION }
  const payload = serializeProfile(safe)

  try {
    await adapter.setItem(PROFILE_STORAGE_KEY, payload)
  } catch {
    // Storage failures must not block gameplay.
  }

  cache = cloneProfile(safe)
  hasCached = true
  return cloneProfile(safe)
}

export async function updateProfile(mutator: ProfileMutation): Promise<ProfileRecord> {
  const mutation = mutationQueue.then(async () => {
    const loaded = await loadProfile()
    const updated = mutator(loaded)
    if (updated.schemaVersion !== PROFILE_SCHEMA_VERSION) {
      updated.schemaVersion = PROFILE_SCHEMA_VERSION
    }
    return persistProfile(updated)
  })
  mutationQueue = mutation.then(
    () => undefined,
    () => undefined,
  )
  return mutation
}

export function createInitialProfileFallback(): ProfileRecord {
  return createEmptyProfile()
}

export async function ensureProfileInitialized(): Promise<ProfileRecord> {
  if (cache && hasCached) return cloneProfile(cache)
  return loadProfile()
}

export async function markOnboardingComplete(): Promise<ProfileRecord> {
  return updateProfile((previous) => ensureOnboardingComplete(previous, true))
}
