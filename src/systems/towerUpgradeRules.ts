export interface TowerUpgradeStats {
  level: number
  damage: number
  range: number
  fireRateMs: number
  upgradeCost: number
  maxLevel: number
}

export interface TowerUpgradeDeltas {
  damage: number
  range: number
  fireRateMs: number
}

export interface TowerUpgradePreview {
  next: TowerUpgradeStats
  delta: TowerUpgradeDeltas
  cost: number
  summary: string
  maxed?: boolean
}

export type TowerUpgradeRequestOutcome =
  | {
      type: 'no-selection'
      reason: 'no-selection'
    }
  | {
      type: 'insufficient-funds'
      reason: 'insufficient-funds'
      currentCoins: number
      needed: number
    }
  | {
      type: 'max-level'
      reason: 'max-level'
      next: TowerUpgradeStats
      cost: 0
      remainingCoins: number
      upgradeCost: number
      maxed: true
    }
  | {
      type: 'success'
      reason: 'success'
      next: TowerUpgradeStats
      cost: number
      remainingCoins: number
    }

export function computeTowerUpgrade(tower: TowerUpgradeStats): TowerUpgradeStats {
  return {
    level: tower.level + 1,
    damage: Math.round(tower.damage * 1.5),
    range: tower.range + 10,
    fireRateMs: Math.round(tower.fireRateMs * 0.9),
    upgradeCost: Math.round(tower.upgradeCost * 1.5),
    maxLevel: tower.maxLevel,
  }
}

export function createTowerUpgradePreview(tower: TowerUpgradeStats): TowerUpgradePreview {
  if (tower.level >= tower.maxLevel) {
    return {
      next: {
        ...tower,
      },
      delta: {
        damage: 0,
        range: 0,
        fireRateMs: 0,
      },
      cost: 0,
      summary: 'MAX LEVEL',
      maxed: true,
    }
  }

  const next = computeTowerUpgrade(tower)
  return {
    next,
    delta: {
      damage: next.damage - tower.damage,
      range: next.range - tower.range,
      fireRateMs: next.fireRateMs - tower.fireRateMs,
    },
    cost: tower.upgradeCost,
    summary: `+${next.damage - tower.damage} Damage · +${next.range - tower.range} Range · ${next.fireRateMs - tower.fireRateMs}ms fire rate`,
  }
}

export function resolveTowerUpgradeRequest(
  selected: TowerUpgradeStats | null,
  currentCoins: number,
): TowerUpgradeRequestOutcome {
  if (!selected) {
    return { type: 'no-selection', reason: 'no-selection' }
  }

  if (selected.level >= selected.maxLevel) {
    return {
      type: 'max-level',
      reason: 'max-level',
      next: { ...selected },
      cost: 0,
      remainingCoins: currentCoins,
      upgradeCost: selected.upgradeCost,
      maxed: true,
    }
  }

  const next = computeTowerUpgrade(selected)
  const cost = selected.upgradeCost

  if (currentCoins < cost) {
    return {
      type: 'insufficient-funds',
      reason: 'insufficient-funds',
      currentCoins,
      needed: cost,
    }
  }

  return {
    type: 'success',
    reason: 'success',
    next,
    cost,
    remainingCoins: Math.max(0, currentCoins - cost),
  }
}

export function formatTowerUpgradePreview(preview: Pick<TowerUpgradePreview, 'summary'>): string {
  return preview.summary
}
