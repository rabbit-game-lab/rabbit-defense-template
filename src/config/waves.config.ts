export const waveConfig = {
  betweenWaveDelayMs: 2600,
  firstWavePrepareDelayMs: 3000,
  /**
   * What: Per-raid scaling applied to every enemy's base stats at spawn time.
   * Feel: hpScalePerWave is the whole difficulty curve — raising it makes later
   *       raids demand upgrades rather than more towers. rewardPerWave keeps the
   *       economy pace with it so late raids can still fund a response.
   * Range: hpScalePerWave 0.05–0.40, rewardPerWave 0–6.
   * Related: run.startingCoins, run.waveClearBonus, tower upgradeCost.
   * Units: hpScalePerWave is a fraction added per zero-based raid index
   *        (hp × (1 + index × hpScalePerWave)); rewardPerWave is flat ryo per index.
   */
  difficulty: {
    hpScalePerWave: 0.18,
    rewardPerWave: 2,
  },
} as const

export type WaveConfig = typeof waveConfig
