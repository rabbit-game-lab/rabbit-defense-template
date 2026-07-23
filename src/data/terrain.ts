import type { TowerType } from './towerDefense.js'

export interface TerrainCell {
  readonly column: number
  readonly row: number
  readonly x: number
  readonly y: number
}

export interface PlacedTowerAnchor extends TerrainCell {
  readonly id: string
  readonly type: TowerType
}

export interface RectangleBlocker {
  readonly kind: 'rectangle'
  readonly id: string
  readonly reason: 'reserved-ui' | 'scenery'
  readonly left: number
  readonly top: number
  readonly right: number
  readonly bottom: number
  readonly dynamic?: 'onboarding'
}

export interface CircleBlocker {
  readonly kind: 'circle'
  readonly id: string
  readonly reason: 'scenery'
  readonly x: number
  readonly y: number
  readonly radius: number
}

export type TerrainBlocker = RectangleBlocker | CircleBlocker

export type PlacementInvalidReason =
  | 'bounds'
  | 'reserved-ui'
  | 'path'
  | 'scenery'
  | 'occupied'
  | 'spacing'
  | 'tower-limit'
  | 'insufficient-funds'

export interface PlacementEvaluation {
  readonly valid: boolean
  readonly cell: TerrainCell
  readonly reason: PlacementInvalidReason | null
  readonly message: string
  readonly requiredSpacingCells: number
  readonly shortfall: number
}

export interface TerrainPlacementRequest {
  readonly x: number
  readonly y: number
  readonly towerType: TowerType
  readonly towerCost: number
  readonly coins: number
  readonly maxTowers: number
  readonly placed: readonly PlacedTowerAnchor[]
  readonly onboardingVisible: boolean
}

/** Permanent world and HUD blockers. Edge tangency is intentionally valid. */
export const TERRAIN_BLOCKERS: readonly TerrainBlocker[] = [
  { kind: 'rectangle', id: 'top-hud', reason: 'reserved-ui', left: 0, top: 0, right: 592, bottom: 58 },
  { kind: 'rectangle', id: 'shop', reason: 'reserved-ui', left: 596, top: 0, right: 800, bottom: 132 },
  { kind: 'rectangle', id: 'bottom-hud', reason: 'reserved-ui', left: 8, top: 406, right: 792, bottom: 480 },
  { kind: 'rectangle', id: 'title-card', reason: 'reserved-ui', left: 15, top: 55, right: 353, bottom: 110 },
  { kind: 'rectangle', id: 'dojo', reason: 'scenery', left: 716, top: 132, right: 800, bottom: 224 },
  { kind: 'rectangle', id: 'onboarding', reason: 'reserved-ui', left: 150, top: 128, right: 650, bottom: 176, dynamic: 'onboarding' },
  { kind: 'circle', id: 'tree-west', reason: 'scenery', x: 50, y: 374, radius: 34 },
  { kind: 'circle', id: 'tree-north', reason: 'scenery', x: 428, y: 100, radius: 34 },
  { kind: 'circle', id: 'tree-south', reason: 'scenery', x: 580, y: 407, radius: 38 },
  { kind: 'circle', id: 'tree-east', reason: 'scenery', x: 732, y: 374, radius: 34 },
] as const
