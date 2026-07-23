import { CONFIG } from '../game.config.js'

export interface AudioSettings {
  muted: boolean
  soundVolume: number
}

export const AUDIO_SETTINGS_STORAGE_KEY = 'rabbit-defense-audio-settings'

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function createDefaultAudioSettings(): AudioSettings {
  return {
    muted: false,
    soundVolume: CONFIG.audio.sfxVolume,
  }
}

export function normalizeAudioSettings(input: unknown): AudioSettings {
  const defaults = createDefaultAudioSettings()
  if (!isObject(input)) return defaults

  const next: AudioSettings = {
    muted: defaults.muted,
    soundVolume: defaults.soundVolume,
  }

  if (typeof input.muted === 'boolean') next.muted = input.muted
  if (typeof input.soundVolume === 'number' && Number.isFinite(input.soundVolume)) {
    next.soundVolume = Math.max(0, Math.min(1, input.soundVolume))
  }

  return next
}

export function deserializeAudioSettings(raw: string | null): AudioSettings {
  if (!raw) return createDefaultAudioSettings()
  try {
    const parsed = JSON.parse(raw) as unknown
    return normalizeAudioSettings(parsed)
  } catch {
    return createDefaultAudioSettings()
  }
}

export function serializeAudioSettings(settings: AudioSettings): string {
  const normalized = normalizeAudioSettings(settings)
  return JSON.stringify(normalized)
}
