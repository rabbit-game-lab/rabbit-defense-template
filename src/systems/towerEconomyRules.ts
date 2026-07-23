export interface TowerPlacementCostLike {
  towerName: string
  cost: number
}

export interface TowerEconomyLike {
  cost: number
  level: number
  upgradeCost: number
}

export type PlacementOutOfRangeReason = 'outside-range' | 'occupied-pad' | 'insufficient-funds'

export function canAffordTower(coins: number, tower: { cost: number }): boolean {
  return coins >= tower.cost
}

export function spendCoins(coins: number, cost: number): number {
  return Math.max(0, coins - cost)
}

export function refundForTower(tower: TowerEconomyLike): number {
  const spent = tower.cost + Math.max(0, tower.level - 1) * tower.upgradeCost
  return Math.floor(spent * 0.6)
}
