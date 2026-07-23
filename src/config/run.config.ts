export const runConfig = {
  startingCoins: 130,
  startingLives: 15,
  buildSpotRadius: 32,
} as const

export type RunConfig = typeof runConfig
