export const placementConfig = {
  /**
   * What: Width and height of one invisible terrain grid cell.
   * Feel: Small enough for precise layouts without visual clutter.
   * Range: 24–48.
   * Related: cursorStartColumn, cursorStartRow, dragThresholdPx.
   * Units: logical pixels.
   */
  cellSize: 32,
  /**
   * What: Maximum number of defenses that may be placed.
   * Feel: Preserves the original six-site economy and difficulty.
   * Range: 1–12.
   * Related: tower spacing and startingCoins.
   * Units: towers.
   */
  maxTowers: 6,
  /**
   * What: Pointer travel required before a card gesture becomes a drag shortcut.
   * Feel: Taps arm placement while intentional movement drags a preview.
   * Range: 4–16.
   * Related: cellSize.
   * Units: logical pixels.
   */
  dragThresholdPx: 8,
  /**
   * What: Half-width reserved around the enemy path center line.
   * Feel: Towers sit fully on grass without crowding raiders.
   * Range: 22–48.
   * Related: cellSize and PATH.
   * Units: logical pixels.
   */
  pathClearancePx: 38,
  /**
   * What: Default keyboard terrain cursor column and row.
   * Feel: Starts on central grass near the first useful build area.
   * Range: columns 0–24, rows 0–14.
   * Related: cellSize.
   * Units: grid cells.
   */
  cursorStartColumn: 6,
  cursorStartRow: 5,
  /**
   * What: Minimum Chebyshev center distance by tower type.
   * Feel: Arrow/Frost leave one empty square; Mortar leaves two.
   * Range: 2–4.
   * Related: cellSize and maxTowers.
   * Units: grid cells.
   */
  spacingCells: {
    arrow: 2,
    frost: 2,
    bomb: 3,
  },
  /**
   * What: Local placement-preview geometry and opacity.
   * Feel: Clear at the chosen square without revealing a full grid.
   * Range: 1–4 stroke, 0–1 alpha.
   * Related: cellSize.
   * Units: logical pixels and alpha.
   */
  previewStrokePx: 2,
  previewFillAlpha: 0.14,
} as const

export type PlacementConfig = typeof placementConfig
