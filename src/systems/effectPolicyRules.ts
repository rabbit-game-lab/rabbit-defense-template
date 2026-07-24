import { CONFIG } from '../game.config.js'

export const MAX_ACTIVE_PROJECTILE_TRAILS = CONFIG.effects.maxTrails
export const PROJECTILE_TRAIL_SAMPLE_MS = CONFIG.effects.trailSampleMs
export const MAX_PLACEMENT_SPARKS = CONFIG.effects.placementSparkCount

export type BattlefieldEffect =
  | 'particles'
  | 'projectile-trail'
  | 'firing-pulse'
  | 'tween'
  | 'flash'
  | 'halo'
  | 'camera-shake'
  | 'static-warning'
  | 'placement-validity'
  | 'range-indicator'
  | 'hp-change'
  | 'announcement'
  | 'result-content'

const REDUCED_EFFECTS_SAFE = new Set<BattlefieldEffect>([
  'static-warning',
  'placement-validity',
  'range-indicator',
  'hp-change',
  'announcement',
  'result-content',
])

export function isEffectAllowed(effect: BattlefieldEffect, reducedEffects: boolean): boolean {
  return !reducedEffects || REDUCED_EFFECTS_SAFE.has(effect)
}

export function shouldSampleProjectileTrail(
  nowMs: number,
  lastSampleMs: number | null,
  activeTrailCount: number,
  reducedEffects: boolean,
): boolean {
  if (!isEffectAllowed('projectile-trail', reducedEffects)) return false
  if (activeTrailCount >= MAX_ACTIVE_PROJECTILE_TRAILS) return false
  return lastSampleMs === null || nowMs - lastSampleMs >= PROJECTILE_TRAIL_SAMPLE_MS
}

export function clampPlacementSparkCount(requested: number, reducedEffects: boolean): number {
  if (!isEffectAllowed('particles', reducedEffects) || !Number.isFinite(requested)) return 0
  return Math.min(MAX_PLACEMENT_SPARKS, Math.max(0, Math.floor(requested)))
}
