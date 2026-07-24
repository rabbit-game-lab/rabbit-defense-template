import { audioConfig } from './config/audio.config.js'
import { combatConfig } from './config/combat.config.js'
import { effectsConfig } from './config/effects.config.js'
import { placementConfig } from './config/placement.config.js'
import { renderConfig } from './config/render.config.js'
import { runConfig } from './config/run.config.js'
import { screenConfig } from './config/screen.config.js'
import { uiConfig } from './config/ui.config.js'
import { waveConfig } from './config/waves.config.js'
import { worldConfig } from './config/world.config.js'

export const CONFIG = {
  screen: screenConfig,
  render: renderConfig,
  world: worldConfig,
  run: runConfig,
  ui: uiConfig,
  waves: waveConfig,
  combat: combatConfig,
  effects: effectsConfig,
  placement: placementConfig,
  audio: audioConfig,
} as const

export type { AudioConfig, CombatConfig, EffectsConfig, PlacementConfig, RenderConfig, RunConfig, ScreenConfig, UiConfig, WaveConfig, WorldConfig } from './config/index.js'
