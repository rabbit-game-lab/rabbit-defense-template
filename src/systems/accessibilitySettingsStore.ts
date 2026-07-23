import * as sdk from '../rabbit/sdk.js'
import {
  ACCESSIBILITY_SETTINGS_STORAGE_KEY,
  type AccessibilitySettings,
  createDefaultAccessibilitySettings,
  deserializeAccessibilitySettings,
  normalizeAccessibilitySettings,
  serializeAccessibilitySettings,
} from './accessibilitySettingsRules.js'

export interface AccessibilityStorageLike {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
}

function getSystemReducedMotionPreference(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

const fallbackMemoryStorage = new Map<string, string>()
const sdkStorageAdapter: AccessibilityStorageLike = {
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

let adapter: AccessibilityStorageLike = sdkStorageAdapter
let settings = createDefaultAccessibilitySettings(getSystemReducedMotionPreference())
let isLoaded = false
let loadPromise: Promise<AccessibilitySettings> | null = null
let stateGeneration = 0

function clone(value: AccessibilitySettings): AccessibilitySettings {
  return { reducedEffects: value.reducedEffects }
}

export function __setAccessibilitySettingsStorageAdapter(next: AccessibilityStorageLike): void {
  adapter = next
  settings = createDefaultAccessibilitySettings(getSystemReducedMotionPreference())
  isLoaded = false
  loadPromise = null
  stateGeneration += 1
}

export function getAccessibilitySettings(): AccessibilitySettings {
  return clone(settings)
}

export function isReducedEffectsEnabled(): boolean {
  return settings.reducedEffects
}

export async function loadAccessibilitySettings(): Promise<AccessibilitySettings> {
  if (isLoaded) return clone(settings)
  if (loadPromise) return clone(await loadPromise)

  const observedGeneration = stateGeneration
  const request: Promise<AccessibilitySettings> = adapter
    .getItem(ACCESSIBILITY_SETTINGS_STORAGE_KEY)
    .catch(() => null)
    .then(async (raw) => {
      if (observedGeneration !== stateGeneration) {
        if (isLoaded) return clone(settings)
        loadPromise = null
        return loadAccessibilitySettings()
      }
      settings = deserializeAccessibilitySettings(raw, getSystemReducedMotionPreference())
      isLoaded = true
      return clone(settings)
    })
    .finally(() => {
      if (loadPromise === request) loadPromise = null
    })

  loadPromise = request
  return clone(await request)
}

export async function saveAccessibilitySettings(
  next: AccessibilitySettings,
): Promise<AccessibilitySettings> {
  settings = normalizeAccessibilitySettings(next, getSystemReducedMotionPreference())
  isLoaded = true
  stateGeneration += 1

  try {
    await adapter.setItem(
      ACCESSIBILITY_SETTINGS_STORAGE_KEY,
      serializeAccessibilitySettings(settings),
    )
  } catch {
    // Persistence failure must not block settings changes.
  }

  return clone(settings)
}

export async function setReducedEffects(enabled: boolean): Promise<AccessibilitySettings> {
  return saveAccessibilitySettings({ reducedEffects: enabled })
}
