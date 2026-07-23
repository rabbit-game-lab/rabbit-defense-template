export type PauseMenuState =
  | 'running'
  | 'paused'
  | 'options'
  | 'confirm-restart'
  | 'confirm-menu'

export type PauseMenuAction =
  | 'toggle-pause'
  | 'resume'
  | 'open-options'
  | 'close-options'
  | 'request-restart'
  | 'request-menu'
  | 'cancel'
  | 'confirm-restart'
  | 'confirm-menu'

export type PauseMenuEffect =
  | 'none'
  | 'pause-game'
  | 'resume-game'
  | 'restart-run'
  | 'go-main-menu'

interface PauseMenuTransition {
  nextState: PauseMenuState
  effect: PauseMenuEffect
}

type PauseMenuDefinition = Record<string, PauseMenuTransition>

const TRANSITION_MATRIX: Record<PauseMenuState, PauseMenuDefinition> = {
  running: {
    'toggle-pause': { nextState: 'paused', effect: 'pause-game' },
  },
  paused: {
    'toggle-pause': { nextState: 'running', effect: 'resume-game' },
    resume: { nextState: 'running', effect: 'resume-game' },
    'open-options': { nextState: 'options', effect: 'none' },
    'request-restart': { nextState: 'confirm-restart', effect: 'none' },
    'request-menu': { nextState: 'confirm-menu', effect: 'none' },
  },
  options: {
    'toggle-pause': { nextState: 'paused', effect: 'none' },
    'close-options': { nextState: 'paused', effect: 'none' },
    cancel: { nextState: 'paused', effect: 'none' },
  },
  'confirm-restart': {
    cancel: { nextState: 'paused', effect: 'none' },
    'toggle-pause': { nextState: 'paused', effect: 'none' },
    'confirm-restart': { nextState: 'running', effect: 'restart-run' },
  },
  'confirm-menu': {
    cancel: { nextState: 'paused', effect: 'none' },
    'toggle-pause': { nextState: 'paused', effect: 'none' },
    'confirm-menu': { nextState: 'running', effect: 'go-main-menu' },
  },
}

export function resolvePauseMenuAction(state: PauseMenuState, action: string): PauseMenuState {
  return TRANSITION_MATRIX[state]?.[action]?.nextState ?? state
}

export function resolvePauseMenuEffect(state: PauseMenuState, action: string): PauseMenuEffect {
  return TRANSITION_MATRIX[state]?.[action]?.effect ?? 'none'
}
