export const BOOT_SCENE_KEY = 'BootScene'
export const MAIN_MENU_SCENE_KEY = 'MainMenuScene'
export const GAME_SCENE_KEY = 'GameScene'
export const UI_SCENE_KEY = 'UIScene'

export const EXPECTED_SCENE_ORDER = [BOOT_SCENE_KEY, MAIN_MENU_SCENE_KEY, GAME_SCENE_KEY, UI_SCENE_KEY] as const

export interface SceneStartDecision {
  type: 'start'
  nextScene: typeof MAIN_MENU_SCENE_KEY
}

export function resolveBootNextScene(audioInitialized: boolean): SceneStartDecision | { type: 'wait' } {
  return audioInitialized ? { type: 'start', nextScene: MAIN_MENU_SCENE_KEY } : { type: 'wait' }
}

export interface MenuStartIntent {
  isStarting: boolean
  optionsOpen: boolean
  gameSceneActive?: boolean
}

export interface MenuLifecycleState {
  isStarting: boolean
  isDestroyed: boolean
  focusedButton: 'play' | 'options'
}

export function createMenuLifecycleState(): MenuLifecycleState {
  return {
    isStarting: false,
    isDestroyed: false,
    focusedButton: 'play',
  }
}

export type MenuActionResult =
  | 'start'
  | 'block-already-starting'
  | 'block-options-open'
  | 'block-game-active'

export function resolveMenuStartAction(intent: MenuStartIntent): MenuActionResult {
  if (intent.isStarting) return 'block-already-starting'
  if (intent.optionsOpen) return 'block-options-open'
  if (intent.gameSceneActive) return 'block-game-active'
  return 'start'
}

export interface MenuStartTransition {
  didTransition: boolean
  reason: MenuActionResult
}

export function resolveMenuStartTransition(intent: MenuStartIntent): MenuStartTransition {
  const reason = resolveMenuStartAction(intent)
  return {
    didTransition: reason === 'start',
    reason,
  }
}

export interface MenuOptionsIntent {
  optionsOpen: boolean
  isStarting: boolean
}

export type MenuOptionsActionResult = 'open' | 'block-starting' | 'already-open'

export function resolveMenuOptionsAction(intent: MenuOptionsIntent): MenuOptionsActionResult {
  if (intent.isStarting) return 'block-starting'
  if (intent.optionsOpen) return 'already-open'
  return 'open'
}

export interface MenuCloseIntent {
  optionsOpen: boolean
}

export function resolveMenuEscapeAction(intent: MenuCloseIntent): 'close-options' | 'ignore' {
  return intent.optionsOpen ? 'close-options' : 'ignore'
}

export function isRestartSceneConfigured(restartSceneKey: string): restartSceneKey is typeof MAIN_MENU_SCENE_KEY {
  return restartSceneKey === MAIN_MENU_SCENE_KEY
}
