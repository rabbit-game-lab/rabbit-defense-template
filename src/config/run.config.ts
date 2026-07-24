export const runConfig = {
  /**
   * Refund ratio for selling a tower (base 60% by default).
   * A lower value makes tower selling less lucrative and increases risk.
   */
  refundRatio: 0.6,
  startingCoins: 130,
  startingLives: 15,
  buildSpotRadius: 32,
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
} as const

export type RunConfig = typeof runConfig
