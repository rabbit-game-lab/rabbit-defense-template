export const waveConfig = {
  betweenWaveDelayMs: 2600,
  firstWavePrepareDelayMs: 3000,
} as const

export type WaveConfig = typeof waveConfig
