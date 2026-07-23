import * as sdk from '../rabbit/sdk.js'
import {
  AUDIO_SETTINGS_STORAGE_KEY,
  createDefaultAudioSettings,
  type AudioSettings,
  deserializeAudioSettings,
  normalizeAudioSettings,
  serializeAudioSettings,
} from './audioSettingsRules.js'

export interface AsyncStorageLike {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
}


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
let cache: AudioSettings | null = null
let cacheReady = false
let loading: Promise<AudioSettings> | null = null
let loadGeneration = 0
let stateGeneration = 0

export function __setAudioSettingsStorageAdapter(next: AsyncStorageLike): void {
  adapter = next
  cache = null
  cacheReady = false
  loading = null
  stateGeneration += 1
}

function cloneAudioSettings(settings: AudioSettings): AudioSettings {
  return {
    muted: settings.muted,
    soundVolume: settings.soundVolume,
  }
}

async function loadAudioSettingsFromStorage(): Promise<AudioSettings> {
  const raw = await adapter.getItem(AUDIO_SETTINGS_STORAGE_KEY).catch(() => null)
  const loaded = deserializeAudioSettings(raw)
  const normalized = normalizeAudioSettings(loaded)
  return cloneAudioSettings(normalized)
}

export async function loadAudioSettings(): Promise<AudioSettings> {
  if (cacheReady && cache) return cloneAudioSettings(cache)
  if (loading) return cloneAudioSettings(await loading)

  const observedStateGeneration = stateGeneration
  loadGeneration += 1
  const observedLoadGeneration = loadGeneration

  const request: Promise<AudioSettings> = loadAudioSettingsFromStorage()
    .then(async (loaded) => {
      if (stateGeneration !== observedStateGeneration || observedLoadGeneration !== loadGeneration) {
        if (cacheReady && cache) return cloneAudioSettings(cache)

        // Retry against the latest adapter/state when this request became stale.
        cache = null
        cacheReady = false
        loading = null
        return loadAudioSettings()
      }

      cache = cloneAudioSettings(loaded)
      cacheReady = true
      return cloneAudioSettings(cache)
    })
    .finally(() => {
      if (loading === request) loading = null
    })

  loading = request
  return cloneAudioSettings(await request)
}

export function getCachedAudioSettings(): AudioSettings | null {
  return cacheReady && cache ? cloneAudioSettings(cache) : null
}

export async function saveAudioSettings(next: AudioSettings): Promise<AudioSettings> {
  const safe = normalizeAudioSettings(next)
  stateGeneration += 1

  try {
    const payload = serializeAudioSettings(safe)
    await adapter.setItem(AUDIO_SETTINGS_STORAGE_KEY, payload)
  } catch {
    // Storage failures should not block callers.
  }

  cache = cloneAudioSettings(safe)
  cacheReady = true
  loadGeneration += 1

  return cloneAudioSettings(safe)
}

export async function resetAudioSettings(): Promise<AudioSettings> {
  return saveAudioSettings(createDefaultAudioSettings())
}

