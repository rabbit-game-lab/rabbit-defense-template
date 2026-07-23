// Pure first-session tutorial transitions; session persistence stays in GameScene.
export type OnboardingStep = 'objective' | 'place' | 'upgrade' | 'complete'
export type OnboardingEvent = 'objective-viewed' | 'tower-placed' | 'tower-upgraded' | 'skip'

export interface OnboardingRuleConfig {
  objectiveAutoAdvanceMs: number
}

export interface OnboardingState {
  readonly step: OnboardingStep
  readonly autoAdvanceAtMs: number
}

export interface OnboardingTransition {
  readonly state: OnboardingState
  readonly didTransition: boolean
}

const ONBOARDING_INSTRUCTIONS: Record<OnboardingStep, string> = {
  objective: 'Objective: defend Hidden Dojo, then place and upgrade ninja defenses to survive all raids.',
  place: 'Place one defense on a glowing build seal.',
  upgrade: 'Upgrade your selected defense to continue.',
  complete: '',
} as const

export function createOnboardingState(
  nowMs: number,
  config: OnboardingRuleConfig,
  completedInSession = false,
): OnboardingState {
  if (config.objectiveAutoAdvanceMs <= 0) {
    throw new Error('onboarding objectiveAutoAdvanceMs must be greater than zero')
  }

  return {
    step: completedInSession ? 'complete' : 'objective',
    autoAdvanceAtMs: nowMs + config.objectiveAutoAdvanceMs,
  }
}

export function getOnboardingInstruction(step: OnboardingStep): string {
  return ONBOARDING_INSTRUCTIONS[step]
}

export function applyObjectiveAutoAdvance(state: OnboardingState, nowMs: number): OnboardingTransition {
  if (state.step !== 'objective' || nowMs < state.autoAdvanceAtMs) {
    return { state, didTransition: false }
  }

  return applyOnboardingEvent(state, 'objective-viewed', nowMs)
}

export function applyOnboardingPlayerAction(
  state: OnboardingState,
  event: Extract<OnboardingEvent, 'tower-placed' | 'tower-upgraded'>,
  nowMs: number,
): OnboardingTransition {
  let currentState = state
  let didTransition = false

  if (event === 'tower-placed' && currentState.step === 'objective') {
    const acknowledgedObjective = applyOnboardingEvent(
      { ...currentState, autoAdvanceAtMs: nowMs },
      'objective-viewed',
      nowMs,
    )
    currentState = acknowledgedObjective.state
    didTransition = acknowledgedObjective.didTransition
  }

  const actionTransition = applyOnboardingEvent(currentState, event, nowMs)
  return {
    state: actionTransition.state,
    didTransition: didTransition || actionTransition.didTransition,
  }
}

export function applyOnboardingEvent(
  state: OnboardingState,
  event: OnboardingEvent,
  nowMs: number,
): OnboardingTransition {
  if (state.step === 'complete') {
    return { state, didTransition: false }
  }

  if (event === 'skip') {
    return {
      state: {
        ...state,
        step: 'complete',
      },
      didTransition: true,
    }
  }

  switch (state.step) {
    case 'objective':
      if (event === 'objective-viewed' && nowMs >= state.autoAdvanceAtMs) {
        return { state: { ...state, step: 'place' }, didTransition: true }
      }
      return { state, didTransition: false }
    case 'place':
      if (event === 'tower-placed') {
        return { state: { ...state, step: 'upgrade' }, didTransition: true }
      }
      return { state, didTransition: false }
    case 'upgrade':
      if (event === 'tower-upgraded') {
        return { state: { ...state, step: 'complete' }, didTransition: true }
      }
      return { state, didTransition: false }
    default:
      return { state, didTransition: false }
  }
}
