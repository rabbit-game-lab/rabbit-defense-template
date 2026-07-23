export type StrategyAction =
  | { kind: 'place'; towerType: 'arrow' | 'frost' | 'bomb'; padIndex: number }
  | { kind: 'upgrade'; towerId: string }

export interface StrategyContext {
  runMs: number
  wave: number
  totalWaves: number
  phase: 'preparing' | 'active' | 'between' | 'complete'
  nextEventMs: number
  activeEnemies: number
  coins: number
  lives: number
  towers: readonly TowerRuntimeSummary[]
}

export interface StrategyDefinition {
  id: string
  name: string
  decide(context: StrategyContext): StrategyAction | null
}

export interface StrategyPurchase {
  type: string
  cost: number
  upgradeLevel: number
  wave: number
}

export interface SimWaveMetrics {
  wave: number
  coinsAtStart: number
  coinsAtEnd: number
  livesAtStart: number
  livesAtEnd: number
  kills: number
  leaks: number
  purchases: StrategyPurchase[]
}

export interface SimulatedStrategyResult {
  strategy: string
  strategyName: string
  outcome: 'victory' | 'defeat'
  finalCoins: number
  finalLives: number
  totalKills: number
  totalLeaks: number
  wavesCleared: number
  wavesReached: number
  finalWave: number
  waveSnapshots: SimWaveMetrics[]
  finalTowers: TowerRuntimeSummary[]
  elapsedMs: number
}

export interface TowerRuntimeSummary {
  id: string
  type: 'arrow' | 'frost' | 'bomb'
  level: number
  damage: number
  range: number
  fireRateMs: number
  upgradeCost: number
  maxLevel: number
}
