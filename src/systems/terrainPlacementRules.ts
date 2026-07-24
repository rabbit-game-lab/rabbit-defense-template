import { CONFIG } from '../game.config.js'
import { PATH } from '../data/towerDefense.js'
import {
  TERRAIN_BLOCKERS,
  type PlacementEvaluation,
  type PlacementInvalidReason,
  type RectangleBlocker,
  type TerrainCell,
  type TerrainPlacementRequest,
} from '../data/terrain.js'

const CELL_SIZE = CONFIG.placement.cellSize
const HALF_CELL = CELL_SIZE / 2
const COLUMN_COUNT = Math.floor(CONFIG.screen.width / CELL_SIZE)
const ROW_COUNT = Math.floor(CONFIG.screen.height / CELL_SIZE)

export function snapToTerrainCell(x: number, y: number): TerrainCell {
  const column = clamp(Math.floor(x / CELL_SIZE), 0, COLUMN_COUNT - 1)
  const row = clamp(Math.floor(y / CELL_SIZE), 0, ROW_COUNT - 1)
  return {
    column,
    row,
    x: HALF_CELL + column * CELL_SIZE,
    y: HALF_CELL + row * CELL_SIZE,
  }
}

export function terrainCellId(cell: Pick<TerrainCell, 'column' | 'row'>): string {
  return `terrain:${cell.column}:${cell.row}`
}

export function parseTerrainCellId(id: string): TerrainCell | null {
  const match = /^terrain:(\d+):(\d+)$/.exec(id)
  if (!match) return null
  const column = Number(match[1])
  const row = Number(match[2])
  if (column >= COLUMN_COUNT || row >= ROW_COUNT) return null
  return snapToTerrainCell(column * CELL_SIZE, row * CELL_SIZE)
}

export function placementReasonMessage(
  reason: PlacementInvalidReason | null,
  shortfall = 0,
): string {
  switch (reason) {
    case null:
      return 'Clear grass square — ready to build.'
    case 'bounds':
      return 'Choose a grass square inside the battlefield.'
    case 'reserved-ui':
      return 'That square is reserved for battlefield controls.'
    case 'path':
      return 'Towers cannot block the enemy road.'
    case 'scenery':
      return 'That grass square is blocked by scenery.'
    case 'occupied':
      return 'A tower already occupies that grass square.'
    case 'spacing':
      return 'Leave the required empty grass squares between towers.'
    case 'tower-limit':
      return `Tower limit reached (${CONFIG.placement.maxTowers}). Sell a tower to build another.`
    case 'insufficient-funds':
      return `Need ${Math.max(0, shortfall)} more ryo to build this tower.`
  }
}

export function evaluateTerrainPlacement(request: TerrainPlacementRequest): PlacementEvaluation {
  const cell = snapToTerrainCell(request.x, request.y)
  const requiredSpacingCells = CONFIG.placement.spacingCells[request.towerType]
  const shortfall = Math.max(0, request.towerCost - request.coins)
  const reason = findInvalidReason(request, cell, requiredSpacingCells)
  return {
    valid: reason === null,
    cell,
    reason,
    message: placementReasonMessage(reason, shortfall),
    requiredSpacingCells,
    shortfall,
  }
}

function findInvalidReason(
  request: TerrainPlacementRequest,
  cell: TerrainCell,
  requiredSpacingCells: number,
): PlacementInvalidReason | null {
  if (!isPointInWorld(request.x, request.y)) return 'bounds'

  for (const reason of ['reserved-ui', 'path', 'scenery'] as const) {
    if (reason === 'path' && isCellTooCloseToPath(cell)) return reason
    if (
      reason !== 'path' &&
      TERRAIN_BLOCKERS.some((blocker) => {
        if (blocker.reason !== reason) return false
        if (
          blocker.kind === 'rectangle' &&
          blocker.dynamic === 'onboarding' &&
          !request.onboardingVisible
        ) {
          return false
        }
        return blocker.kind === 'rectangle'
          ? cellOverlapsRectangle(cell, blocker)
          : cellOverlapsCircle(cell, blocker)
      })
    ) {
      return reason
    }
  }

  if (request.placed.some((placed) => placed.column === cell.column && placed.row === cell.row)) {
    return 'occupied'
  }
  if (
    request.placed.some((placed) => {
      const pairSpacing = Math.max(
        requiredSpacingCells,
        CONFIG.placement.spacingCells[placed.type],
      )
      return chebyshevCellDistance(cell, placed) < pairSpacing
    })
  ) {
    return 'spacing'
  }
  if (request.placed.length >= request.maxTowers) return 'tower-limit'
  if (request.coins < request.towerCost) return 'insufficient-funds'
  return null
}

export function chebyshevCellDistance(
  first: Pick<TerrainCell, 'column' | 'row'>,
  second: Pick<TerrainCell, 'column' | 'row'>,
): number {
  return Math.max(
    Math.abs(first.column - second.column),
    Math.abs(first.row - second.row),
  )
}

export function distanceToSegment(
  point: { readonly x: number; readonly y: number },
  start: { readonly x: number; readonly y: number },
  end: { readonly x: number; readonly y: number },
): number {
  const segmentX = end.x - start.x
  const segmentY = end.y - start.y
  const lengthSquared = segmentX * segmentX + segmentY * segmentY
  if (lengthSquared === 0) return Math.hypot(point.x - start.x, point.y - start.y)
  const projection = clamp(
    ((point.x - start.x) * segmentX + (point.y - start.y) * segmentY) /
      lengthSquared,
    0,
    1,
  )
  return Math.hypot(
    point.x - (start.x + projection * segmentX),
    point.y - (start.y + projection * segmentY),
  )
}

export function cellOverlapsRectangle(cell: TerrainCell, blocker: RectangleBlocker): boolean {
  return (
    cell.x - HALF_CELL < blocker.right &&
    cell.x + HALF_CELL > blocker.left &&
    cell.y - HALF_CELL < blocker.bottom &&
    cell.y + HALF_CELL > blocker.top
  )
}

export function cellOverlapsCircle(
  cell: TerrainCell,
  blocker: { readonly x: number; readonly y: number; readonly radius: number },
): boolean {
  const closestX = clamp(blocker.x, cell.x - HALF_CELL, cell.x + HALF_CELL)
  const closestY = clamp(blocker.y, cell.y - HALF_CELL, cell.y + HALF_CELL)
  return Math.hypot(blocker.x - closestX, blocker.y - closestY) < blocker.radius
}

function isCellTooCloseToPath(cell: TerrainCell): boolean {
  return pointOverlapsPath(cell, PATH, CONFIG.placement.pathClearancePx)
}

export function pointOverlapsPath(
  point: { readonly x: number; readonly y: number },
  path: readonly { readonly x: number; readonly y: number }[],
  clearancePx: number,
): boolean {
  for (let index = 0; index < path.length - 1; index += 1) {
    if (distanceToSegment(point, path[index], path[index + 1]) < clearancePx) {
      return true
    }
  }
  return false
}

function isPointInWorld(x: number, y: number): boolean {
  return (
    Number.isFinite(x) &&
    Number.isFinite(y) &&
    x >= 0 &&
    y >= 0 &&
    x < CONFIG.screen.width &&
    y < CONFIG.screen.height
  )
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}
