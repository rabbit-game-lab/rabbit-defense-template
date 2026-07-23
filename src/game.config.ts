import { audioConfig } from './config/audio.config'
import { combatConfig } from './config/combat.config'
import { renderConfig } from './config/render.config'
import { runConfig } from './config/run.config'
import { screenConfig } from './config/screen.config'
import { uiConfig } from './config/ui.config'
import { waveConfig } from './config/waves.config'
import { worldConfig } from './config/world.config'

export const CONFIG = {
  screen: screenConfig,
  render: renderConfig,
  world: worldConfig,
  run: runConfig,
  ui: uiConfig,
  waves: waveConfig,
  combat: combatConfig,
  audio: audioConfig,
} as const

export type { AudioConfig, CombatConfig, RenderConfig, RunConfig, ScreenConfig, UiConfig, WaveConfig, WorldConfig } from './config'
