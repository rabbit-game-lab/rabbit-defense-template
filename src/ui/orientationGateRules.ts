export interface ViewportSize {
  width: number
  height: number
}

export interface ResponsiveViewportPolicy {
  logicalWidth: number
  logicalHeight: number
  minimumLandscapeWidth: number
  minimumLandscapeHeight: number
}

export type ViewportPresentation = 'portrait-gate' | 'landscape-supported' | 'landscape-compact'

export interface ResponsiveViewportLayout {
  presentation: ViewportPresentation
  shouldBlockInput: boolean
  scale: number
  canvasWidth: number
  canvasHeight: number
  offsetX: number
  offsetY: number
}

export type GameplayPauseStatus = 'running' | 'paused' | 'inactive'
export type OrientationGateEffect = 'none' | 'pause-gameplay' | 'resume-gameplay'

export interface OrientationGateState {
  active: boolean
  ownsGameplayPause: boolean
}

export interface OrientationGateTransition {
  state: OrientationGateState
  effect: OrientationGateEffect
}

function finiteNonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0
}

export function calculateResponsiveViewport(
  viewport: ViewportSize,
  policy: ResponsiveViewportPolicy,
): ResponsiveViewportLayout {
  const width = finiteNonNegative(viewport.width)
  const height = finiteNonNegative(viewport.height)
  const logicalWidth = Math.max(1, finiteNonNegative(policy.logicalWidth))
  const logicalHeight = Math.max(1, finiteNonNegative(policy.logicalHeight))
  const isPortrait = height > width
  const isSupportedLandscape =
    !isPortrait &&
    width >= finiteNonNegative(policy.minimumLandscapeWidth) &&
    height >= finiteNonNegative(policy.minimumLandscapeHeight)
  const scale = Math.min(width / logicalWidth, height / logicalHeight)
  const canvasWidth = logicalWidth * scale
  const canvasHeight = logicalHeight * scale

  return {
    presentation: isPortrait
      ? 'portrait-gate'
      : isSupportedLandscape
        ? 'landscape-supported'
        : 'landscape-compact',
    shouldBlockInput: isPortrait,
    scale,
    canvasWidth,
    canvasHeight,
    offsetX: (width - canvasWidth) / 2,
    offsetY: (height - canvasHeight) / 2,
  }
}

export function createOrientationGateState(): OrientationGateState {
  return { active: false, ownsGameplayPause: false }
}

export function resolveOrientationGate(
  current: OrientationGateState,
  shouldBlockInput: boolean,
  gameplayStatus: GameplayPauseStatus,
): OrientationGateTransition {
  if (shouldBlockInput) {
    if (gameplayStatus === 'running') {
      return {
        state: { active: true, ownsGameplayPause: true },
        effect: 'pause-gameplay',
      }
    }

    return {
      state: {
        active: true,
        ownsGameplayPause: current.ownsGameplayPause,
      },
      effect: 'none',
    }
  }

  const shouldResume = current.ownsGameplayPause && gameplayStatus === 'paused'
  return {
    state: createOrientationGateState(),
    effect: shouldResume ? 'resume-gameplay' : 'none',
  }
}
