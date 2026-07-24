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
  /**
   * What: Death burst geometry and the number of sparks flung on a kill.
   * Feel: A satisfying pop that confirms the defeat without cluttering the lane.
   * Range: burst 120–400ms, sparks 0–8.
   * Related: killSparkCount honors Reduced Effects like every motion cue.
   * Units: milliseconds and sparks.
   */
  killBurstMs: 260,
  killSparkCount: 5,
  /**
   * What: Floating "+ryo" reward text lifetime and how far it rises.
   * Feel: A brief upward drift that ties the coin gain to the enemy that paid it.
   * Range: 300–900ms, rise 12–40px.
   * Related: killBurstMs.
   * Units: milliseconds and logical pixels.
   */
  coinPopMs: 620,
  coinPopRisePx: 26,
  /**
   * What: Camera shake felt when a raider breaches the dojo or the boss arrives.
   * Feel: A small, quickly-settling jolt — presence, not disorientation.
   * Range: 120–320ms, intensity 0.002–0.008.
   * Related: gated by Reduced Effects.
   * Units: milliseconds and normalized shake amplitude.
   */
  leakShakeMs: 200,
  leakShakeIntensity: 0.006,
  bossShakeMs: 260,
  bossShakeIntensity: 0.005,
} as const

export type EffectsConfig = typeof effectsConfig
