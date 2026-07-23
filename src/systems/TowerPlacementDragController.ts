import Phaser from 'phaser'
import { CONFIG } from '../game.config'
import { TOWER_TEXTURE_KEYS } from '../data/assets'
import { TOWERS, type TowerType } from '../data/towerDefense'
import type { BuildPad } from './gameBoard'
import {
  computePadVisualStyle,
  computeDragGhostStyle,
  PAD_BASE_ALPHA,
  PAD_FREE_COLOR,
} from './towerPlacementVisuals'
import { resolvePlacementDrop, type BuildPadState, type PlacementDropOutcome, type TowerPlacementCostLike } from './towerDefenseRules'

interface DragControllerConfig {
  canInteract: () => boolean
  getCurrentCoins: () => number
  onStatusUpdate: (status: string) => void
}

export interface DragFinishResult {
  outcome: PlacementDropOutcome
  towerType: TowerType
}

export default class TowerPlacementDragController {
  private readonly scene: Phaser.Scene
  private readonly pads: BuildPad[]
  private readonly options: DragControllerConfig
  private draggingType?: TowerType
  private dragGhost?: Phaser.GameObjects.Container
  private dragGhostRange?: Phaser.GameObjects.Arc
  private dragGhostSprite?: Phaser.GameObjects.Image

  constructor(scene: Phaser.Scene, pads: BuildPad[], options: DragControllerConfig) {
    this.scene = scene
    this.pads = pads
    this.options = options
  }

  isDragging(): boolean {
    return Boolean(this.draggingType)
  }

  clear(): void {
    this.draggingType = undefined
    this.clearGhostAndHighlights()
  }

  destroy(): void {
    this.draggingType = undefined
    this.clearGhostAndHighlights(false)
  }

  startDrag(type: TowerType, pointer: Phaser.Input.Pointer): void {
    if (!this.options.canInteract()) return

    this.draggingType = type
    const definition = TOWERS[type]
    this.clearGhostAndHighlights()

    const ghostVisual = computeDragGhostStyle(false)
    this.dragGhost = this.scene.add.container(pointer.worldX, pointer.worldY)
    this.dragGhostRange = this.scene.add
      .circle(0, 0, definition.range, ghostVisual.rangeFillColor, 0.1)
      .setStrokeStyle(1, ghostVisual.rangeStrokeColor, 0.18)
    this.dragGhostSprite = this.scene.add.image(0, 0, TOWER_TEXTURE_KEYS[type]).setAlpha(0.9)
    this.dragGhost.add([this.dragGhostRange, this.dragGhostSprite])
    this.setGhostColor(false)

    this.move(pointer)
  }

  move(pointer: Phaser.Input.Pointer): void {
    if (!this.draggingType || !this.dragGhost || !this.dragGhostRange || !this.dragGhostSprite) return

    if (!this.options.canInteract()) {
      this.options.onStatusUpdate('')
      this.clear()
      return
    }

    this.dragGhost.setPosition(pointer.worldX, pointer.worldY)
    const outcome = this.resolveCurrentDragOutcome(pointer.worldX, pointer.worldY)
    const canPlace = outcome.type === 'success'

    this.updatePadHighlights(pointer.worldX, pointer.worldY, canPlace)
    this.setGhostColor(canPlace)
  }

  finish(pointer: Phaser.Input.Pointer): DragFinishResult | undefined {
    if (!this.draggingType) return undefined

    if (!this.options.canInteract()) {
      return undefined
    }

    const outcome = this.resolveCurrentDragOutcome(pointer.worldX, pointer.worldY)
    const towerType = this.draggingType
    this.clear()
    return { outcome, towerType }
  }

  resolveCurrentDragOutcome(worldX: number, worldY: number): PlacementDropOutcome {
    if (!this.draggingType) {
      return {
        type: 'cancelled',
        reason: 'outside-range',
        target: undefined,
        spendAmount: 0,
        nextCoins: this.options.getCurrentCoins(),
        status: 'Drag cancelled — drop on a glowing circle.',
      }
    }

    const definition = TOWERS[this.draggingType]
    const padState: readonly BuildPadState[] = this.pads.map((pad) => ({
      x: pad.x,
      y: pad.y,
      occupied: Boolean(pad.occupiedBy),
    }))
    const request: TowerPlacementCostLike = {
      towerName: definition.name,
      cost: definition.cost,
    }

    return resolvePlacementDrop(
      { x: worldX, y: worldY },
      padState,
      CONFIG.run.buildSpotRadius,
      request,
      this.options.getCurrentCoins(),
    )
  }

  private updatePadHighlights(worldX: number, worldY: number, canPlace: boolean): void {
    const padState: readonly BuildPadState[] = this.pads.map((pad) => ({
      x: pad.x,
      y: pad.y,
      occupied: Boolean(pad.occupiedBy),
    }))
    const nearest = this.findNearestPad({ x: worldX, y: worldY }, padState)

    for (const pad of this.pads) {
      const style = computePadVisualStyle({ x: pad.x, y: pad.y, occupied: Boolean(pad.occupiedBy) }, nearest, canPlace)
      pad.ring.setFillStyle(style.fillColor, style.fillAlpha)
      pad.ring.setStrokeStyle(2, style.strokeColor, style.strokeAlpha)
      const isNearest = nearest?.x === pad.x && nearest?.y === pad.y
      pad.marker.setText(pad.occupiedBy ? '×' : isNearest && !canPlace ? '!' : '＋')
      pad.marker.setColor(isNearest && !canPlace ? '#ffaaa0' : '#fff4cf')
    }
  }

  private setGhostColor(valid: boolean): void {
    if (!this.dragGhostRange || !this.dragGhostSprite) return
    const state = computeDragGhostStyle(valid)

    this.dragGhostRange
      .setFillStyle(state.rangeFillColor, 0.1)
      .setStrokeStyle(1, state.rangeStrokeColor, 0.36)
    this.dragGhostSprite.setTint(valid ? 0xffffff : 0xe28b8b)
  }

  private clearGhostAndHighlights(resetPads = true): void {
    if (this.dragGhost) this.dragGhost.destroy()
    this.dragGhost = undefined
    this.dragGhostRange = undefined
    this.dragGhostSprite = undefined

    if (!resetPads) return
    for (const pad of this.pads) {
      pad.ring.setFillStyle(PAD_FREE_COLOR, PAD_BASE_ALPHA)
      pad.ring.setStrokeStyle(2, PAD_FREE_COLOR, 0.35)
      pad.marker.setText(pad.occupiedBy ? '×' : '＋').setColor('#fff4cf')
    }
  }

  private findNearestPad(pointer: PointLike, pads: readonly BuildPadState[]): BuildPadState | undefined {
    let nearest: BuildPadState | undefined
    let nearestDistance = Infinity

    for (const pad of pads) {
      const distance = Phaser.Math.Distance.BetweenPoints(pointer, pad)
      if (distance >= nearestDistance) continue
      nearest = pad
      nearestDistance = distance
    }

    return nearestDistance <= CONFIG.run.buildSpotRadius ? nearest : undefined
  }
}

interface PointLike {
  x: number
  y: number
}
