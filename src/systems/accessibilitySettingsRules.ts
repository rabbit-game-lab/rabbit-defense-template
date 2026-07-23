export interface AccessibilitySettings {
  reducedEffects: boolean
}

export const ACCESSIBILITY_SETTINGS_STORAGE_KEY = 'rabbit-defense-accessibility-settings'

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function createDefaultAccessibilitySettings(prefersReducedMotion = false): AccessibilitySettings {
  return {
    reducedEffects: prefersReducedMotion,
  }
}

export function normalizeAccessibilitySettings(
  input: unknown,
  prefersReducedMotion = false,
): AccessibilitySettings {
  const defaults = createDefaultAccessibilitySettings(prefersReducedMotion)
  if (!isObject(input)) return defaults

  return {
    reducedEffects:
      typeof input.reducedEffects === 'boolean'
        ? input.reducedEffects
        : defaults.reducedEffects,
  }
}

export function deserializeAccessibilitySettings(
  raw: string | null,
  prefersReducedMotion = false,
): AccessibilitySettings {
  if (!raw) return createDefaultAccessibilitySettings(prefersReducedMotion)

  try {
    return normalizeAccessibilitySettings(JSON.parse(raw) as unknown, prefersReducedMotion)
  } catch {
    return createDefaultAccessibilitySettings(prefersReducedMotion)
  }
}

export function serializeAccessibilitySettings(settings: AccessibilitySettings): string {
  return JSON.stringify(normalizeAccessibilitySettings(settings))
}
