import type { StrategyContext, StrategyDefinition, StrategyAction } from './balanceTypes.js'
import type { TowerRuntimeSummary } from './balanceTypes.js'
import type { TowerType } from '../data/towerDefense.js'

function hasType(ctx: StrategyContext, towerType: TowerType): boolean {
  return ctx.towers.some((tower) => tower.type === towerType)
}

function nextPadFromTowers(ctx: StrategyContext): number {
  return ctx.towers.length
}

function bestUpgradeable(ctx: StrategyContext): string | null {
  const candidates = ctx.towers.filter((tower): tower is TowerRuntimeSummary =>
    tower.level < tower.maxLevel && ctx.coins >= tower.upgradeCost,
  )

  if (candidates.length === 0) return null
  const ordered = [...candidates].sort((a, b) => {
    if (a.type !== b.type) {
      if (a.type === 'arrow') return -1
      if (b.type === 'arrow') return 1
      if (a.type === 'bomb') return -1
      return 1
    }
    return b.level - a.level
  })

  return ordered[0]?.id ?? null
}

function highestLevelArrows(ctx: StrategyContext): string | null {
  const arrows = ctx.towers.filter((tower) => tower.type === 'arrow' && tower.level < tower.maxLevel)
  if (arrows.length === 0) return null
  const ordered = [...arrows].sort((a, b) => a.level - b.level)
  return ordered[0]?.id ?? null
}

function hasAllRequired(ctx: StrategyContext): boolean {
  return hasType(ctx, 'arrow') && hasType(ctx, 'frost') && hasType(ctx, 'bomb')
}

function planBetweenWavesUpgrade(ctx: StrategyContext): StrategyAction | null {
  if (ctx.phase !== 'between' && ctx.phase !== 'complete' && ctx.wave < 2) return null
  const upgradeTarget = bestUpgradeable(ctx)
  if (!upgradeTarget) return null
  return { kind: 'upgrade', towerId: upgradeTarget }
}

export function createBaselineStrategies(): StrategyDefinition[] {
  const arrowFrost: StrategyDefinition = {
    id: 'arrow-frost',
    name: 'Arrow + Frost',
    decide(ctx) {
      if (!hasType(ctx, 'arrow')) return { kind: 'place', towerType: 'arrow', padIndex: nextPadFromTowers(ctx) }
      if (!hasType(ctx, 'frost')) return { kind: 'place', towerType: 'frost', padIndex: nextPadFromTowers(ctx) }
      return planBetweenWavesUpgrade(ctx)
    },
  }

  const arrowBomb: StrategyDefinition = {
    id: 'arrow-bomb',
    name: 'Arrow + Bombard',
    decide(ctx) {
      if (!hasType(ctx, 'arrow')) return { kind: 'place', towerType: 'arrow', padIndex: nextPadFromTowers(ctx) }
      if (!hasType(ctx, 'bomb')) return { kind: 'place', towerType: 'bomb', padIndex: nextPadFromTowers(ctx) }
      return planBetweenWavesUpgrade(ctx)
    },
  }

  const arrowFocused: StrategyDefinition = {
    id: 'arrow-focused',
    name: 'Arrow upgrades',
    decide(ctx) {
      if (ctx.towers.length < 3) return { kind: 'place', towerType: 'arrow', padIndex: nextPadFromTowers(ctx) }
      if (!hasType(ctx, 'arrow')) return { kind: 'place', towerType: 'arrow', padIndex: nextPadFromTowers(ctx) }

      const target = highestLevelArrows(ctx)
      if (!target) return null
      return { kind: 'upgrade', towerId: target }
    },
  }

  const balancedThree: StrategyDefinition = {
    id: 'balanced-three',
    name: 'Balanced',
    decide(ctx) {
      if (!hasAllRequired(ctx) && nextPadFromTowers(ctx) < 3) {
        const nextType: TowerType = !hasType(ctx, 'arrow') ? 'arrow' : !hasType(ctx, 'frost') ? 'frost' : 'bomb'
        return { kind: 'place', towerType: nextType, padIndex: nextPadFromTowers(ctx) }
      }
      return planBetweenWavesUpgrade(ctx)
    },
  }

  return [arrowFrost, arrowBomb, arrowFocused, balancedThree]
}
