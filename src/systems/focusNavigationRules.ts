export type GameplayFocusRegion = 'shop' | 'terrain' | 'towers' | 'actions' | 'pause'

export interface GameplayFocusTarget {
  readonly id: string
  readonly region: GameplayFocusRegion
  readonly enabled: boolean
}

export function cycleFocusTarget(
  targets: readonly GameplayFocusTarget[],
  currentId: string | null,
  step: 1 | -1,
): GameplayFocusTarget | null {
  const enabled = targets.filter((target) => target.enabled)
  if (enabled.length === 0) return null
  const currentIndex = enabled.findIndex((target) => target.id === currentId)
  if (currentIndex < 0) return step === 1 ? enabled[0] : enabled[enabled.length - 1]
  return enabled[(currentIndex + step + enabled.length) % enabled.length]
}

export function cycleFocusInRegion(
  targets: readonly GameplayFocusTarget[],
  region: GameplayFocusRegion,
  currentId: string | null,
  step: 1 | -1,
): GameplayFocusTarget | null {
  return cycleFocusTarget(
    targets.filter((target) => target.region === region),
    currentId,
    step,
  )
}

export function reconcileFocusTarget(
  targets: readonly GameplayFocusTarget[],
  preferredId: string | null,
  fallbackRegion?: GameplayFocusRegion,
): GameplayFocusTarget | null {
  const preferred = targets.find((target) => target.enabled && target.id === preferredId)
  if (preferred) return preferred
  const fallback = fallbackRegion
    ? targets.find((target) => target.enabled && target.region === fallbackRegion)
    : undefined
  return fallback ?? targets.find((target) => target.enabled) ?? null
}
