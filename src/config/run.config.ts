export const runConfig = {
  /**
   * Refund ratio for selling a tower (base 60% by default).
   * A lower value makes tower selling less lucrative and increases risk.
   */
  refundRatio: 0.6,
  startingCoins: 130,
  startingLives: 15,
  /**
   * What: Ryo awarded for fully clearing a raid, on top of per-kill rewards.
   * Feel: A reliable between-wave payout that rewards defending without leaks
   *       and funds the next upgrade; later raids pay a little more.
   * Range: base 0–40, perWave 0–15.
   * Related: startingCoins and tower upgradeCost.
   * Units: ryo (base is a flat grant; perWave scales by zero-based raid index).
   */
  waveClearBonus: {
    base: 12,
    perWave: 4,
  },
  /**
   * What: Per-level multipliers applied when a tower is upgraded. Uniform across
   *       all tower types today.
   * Feel: damageMultiplier dominates — it is what makes upgrading a tower compete
   *       with buying a new one. costMultiplier is the brake that stops a single
   *       maxed tower from being strictly correct.
   * Range: damageMultiplier 1.1–2.0, rangeBonus 0–30, fireRateMultiplier 0.7–1.0,
   *        costMultiplier 1.1–2.5.
   * Related: TOWERS[].upgradeCost and TOWERS[].maxLevel in data/towerDefense.ts.
   * Units: multipliers are ratios applied to the previous level; rangeBonus is px.
   *        fireRateMultiplier is below 1 because it scales a delay, not a rate.
   */
  upgrade: {
    damageMultiplier: 1.5,
    rangeBonus: 10,
    fireRateMultiplier: 0.9,
    costMultiplier: 1.5,
  },
  /**
   * What: Battle-speed multipliers cycled by the speed button and the F key.
   * Feel: Lets a confident player skip the between-raid lull without touching
   *       balance — every rule is time-scaled, so outcomes are unchanged.
   * Range: 2–4 entries, each 1–4. The first entry is the starting speed.
   * Related: GameScene.toggleGameSpeed.
   * Units: multiplier applied to delta time.
   */
  speedSteps: [1, 2] as readonly number[],
} as const

export type RunConfig = typeof runConfig
