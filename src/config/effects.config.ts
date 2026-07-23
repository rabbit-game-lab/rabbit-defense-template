export const effectsConfig = {
  /**
   * What: Maximum number of fading projectile trail samples alive at once.
   * Feel: Keeps busy waves readable and avoids unbounded display objects.
   * Range: 16–96.
   * Related: trailSampleMs, trailLifetimeMs.
   * Units: trail marks.
   */
  maxTrails: 48,
  /**
   * What: Minimum time between trail samples for one projectile.
   * Feel: Suggests motion without drawing continuous beams.
   * Range: 30–100.
   * Related: maxTrails, trailLifetimeMs.
   * Units: milliseconds.
   */
  trailSampleMs: 50,
  /**
   * What: Time before a projectile trail mark fully fades.
   * Feel: Fast and restrained, with only recent movement visible.
   * Range: 80–300.
   * Related: maxTrails, trailSampleMs.
   * Units: milliseconds.
   */
  trailLifetimeMs: 170,
  /**
   * What: Duration of placement, impact, pulse, and warning motion.
   * Feel: Crisp feedback that does not obscure tower-defense decisions.
   * Range: 80–700.
   * Related: placementSparkCount.
   * Units: milliseconds.
   */
  placementRingMs: 300,
  impactRingMs: 240,
  towerPulseMs: 80,
  bossHaloMs: 620,
  resultFeedbackMs: 700,
  /**
   * What: Maximum sparks emitted after a successful placement.
   * Feel: A small confirmation flourish rather than a particle shower.
   * Range: 0–6.
   * Related: placementRingMs.
   * Units: sparks.
   */
  placementSparkCount: 6,
} as const

export type EffectsConfig = typeof effectsConfig
