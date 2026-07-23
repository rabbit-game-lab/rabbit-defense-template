import { createDefaultAudioSettings, type AudioSettings } from './audioSettingsRules.js'

export interface LoadPersistedAudioSettings {
  (): Promise<AudioSettings>
}

export interface ApplyAudioSettings {
  (settings: AudioSettings): void
}

export interface InitializeAudioStartupDeps {
  loadAudioSettings: LoadPersistedAudioSettings
  applyAudioSettings: ApplyAudioSettings
}

export async function initializePersistedAudioSettings({ loadAudioSettings, applyAudioSettings }: InitializeAudioStartupDeps): Promise<void> {
  let settings = createDefaultAudioSettings()

  try {
    settings = await loadAudioSettings()
  } catch {
    settings = createDefaultAudioSettings()
  }

  applyAudioSettings(settings)
}
