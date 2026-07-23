export type RunOutcome = 'victory' | 'defeat'
export type RunStatus = 'running' | 'won' | 'lost'

export interface RunState {
  status: RunStatus
  endedAt?: number
  startedAt?: number
}

export interface RunTransition {
  state: RunState
  didTransition: boolean
}

export function createRunState(now = 0): RunState {
  return { status: 'running', endedAt: undefined, startedAt: now }
}

export function isRunActive(state: RunState): boolean {
  return state.status === 'running'
}

export function getRunStatus(state: RunState): RunStatus {
  return state.status
}

export function finishRun(state: RunState, outcome: RunOutcome, now: number): RunTransition {
  if (state.status !== 'running') {
    return { state, didTransition: false }
  }

  return {
    state: {
      ...state,
      status: outcome === 'victory' ? 'won' : 'lost',
      endedAt: now,
    },
    didTransition: true,
  }
}


