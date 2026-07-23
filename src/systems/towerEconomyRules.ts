export interface TowerPlacementCostLike {
  towerName: string
  cost: number
}

export interface TowerEconomyLike {
  cost: number
  level: number
  upgradeCost: number
  investedCost?: number
}

export type PlacementOutOfRangeReason = 'outside-range' | 'occupied-pad' | 'insufficient-funds'

export function canAffordTower(coins: number, tower: { cost: number }): boolean {
  return coins >= tower.cost
}

export function spendCoins(coins: number, cost: number): number {
  return Math.max(0, coins - cost)
}

export function refundForTower(tower: TowerEconomyLike, refundRatio = 0.6): number {
  const investedCost =
    tower.investedCost === undefined
      ? tower.cost + Math.max(0, tower.level - 1) * tower.upgradeCost
      : Math.max(0, tower.investedCost)

  return Math.floor(investedCost * refundRatio)
}
