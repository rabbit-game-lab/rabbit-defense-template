import type { BuildPadState } from './towerDefenseRules'

export interface DragGhostVisual {
  validColor: number
  invalidColor: number
  strokeColor: number
  rangeAlpha: number
}

export interface DragGhostColorState {
  rangeFillColor: number
  rangeStrokeColor: number
  bodyFillColor: number
  roofFillColor: number
}

export interface PadCircleStyle {
  fillColor: number
  fillAlpha: number
  strokeColor: number
  strokeAlpha: number
}

export const PAD_FREE_COLOR = 0xf6d365
export const PAD_OCCUPIED_COLOR = 0xc63d2f
export const PAD_HOVER_COLOR = 0x4dd17a
export const PAD_BASE_ALPHA = 0.08
export const PAD_HOVER_ALPHA = 0.22
export const PAD_OCCUPIED_ALPHA = 0.2

const GHOST_VALID_COLOR = 0x62f27d
const GHOST_INVALID_COLOR = 0xe24d4d

export function computeDragGhostStyle(valid: boolean): DragGhostColorState {
  const base = valid ? GHOST_VALID_COLOR : GHOST_INVALID_COLOR
  return {
    rangeFillColor: base,
    rangeStrokeColor: valid ? 0x3dbd5c : GHOST_INVALID_COLOR,
    bodyFillColor: base,
    roofFillColor: base,

  }
}

export function createDragGhostVisual(): DragGhostVisual {
  return {
    validColor: GHOST_VALID_COLOR,
    invalidColor: GHOST_INVALID_COLOR,
    strokeColor: 0x3dbd5c,
    rangeAlpha: 0.1,
  }
}

export function computePadVisualStyle(
  pad: { x: number; y: number; occupied: boolean },
  nearestPad: BuildPadState | undefined,
  canPlace: boolean,
): PadCircleStyle {
  const nearestCoordinatesMatch = nearestPad && pad.x === nearestPad.x && pad.y === nearestPad.y

  if (nearestCoordinatesMatch && canPlace && !pad.occupied) {
    return {
      fillColor: PAD_HOVER_COLOR,
      fillAlpha: PAD_HOVER_ALPHA,
      strokeColor: PAD_HOVER_COLOR,
      strokeAlpha: 0.58,
    }
  }

  if (pad.occupied || (nearestCoordinatesMatch && !canPlace)) {
    return {
      fillColor: PAD_OCCUPIED_COLOR,
      fillAlpha: PAD_OCCUPIED_ALPHA,
      strokeColor: PAD_OCCUPIED_COLOR,
      strokeAlpha: 0.5,
    }
  }

  return {
    fillColor: PAD_FREE_COLOR,
    fillAlpha: PAD_BASE_ALPHA,
    strokeColor: PAD_FREE_COLOR,
    strokeAlpha: 0.35,
  }
}

export function computeTowerLevelScale(level: number): number {
  return 1 + Math.max(0, level - 1) * 0.08
}
