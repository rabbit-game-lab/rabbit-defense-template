export const runConfig = {
  /**
   * Refund ratio for selling a tower (base 60% by default).
   * A lower value makes tower selling less lucrative and increases risk.
   */
  refundRatio: 0.6,
  startingCoins: 130,
  startingLives: 15,
  buildSpotRadius: 32,
} as const

export type RunConfig = typeof runConfig
