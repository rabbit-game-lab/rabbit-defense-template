import Phaser from 'phaser'
import { CONFIG } from '../game.config'
import { TOWERS, type TowerType } from '../data/towerDefense'
import {
  createBuildPads,
  buildCards,
  type BuildPad,
} from './gameBoard'
import {
  createTowerUpgradePreview,
  resolvePlacementDrop,
  resolveTowerUpgradeRequest,
  type PlacementDropOutcome,
  type BuildPadState,
  findNearestPadWithinRadius,
  type TowerPlacementCostLike,
  type TowerUpgradeRequestOutcome,
  type TowerUpgradeStats,
  type TowerUpgradePreview,
} from './towerDefenseRules'
import { playBuildSfx, playClickSfx } from './audioManager'
import { TowerView, type TowerRuntime } from '../entities/TowerView'

const PAD_FREE_COLOR = 0xf6d365
const PAD_OCCUPIED_COLOR = 0xc63d2f
const PAD_HOVER_COLOR = 0x4dd17a
const GHOST_VALID_COLOR = 0x62f27d
const GHOST_INVALID_COLOR = 0xe24d4d
const PAD_BASE_ALPHA = 0.08
const PAD_HOVER_ALPHA = 0.22
const PAD_OCCUPIED_ALPHA = 0.2

export interface TowerPlacementSelectedTower {
  id: string
  name: string
  type: TowerType
  level: number
  damage: number
  range: number
  fireRateMs: number
  upgradeCost: number
  affordable: boolean
  upgrade: TowerUpgradePreview
}

export interface TowerPlacementSnapshot {
  selectedTower: TowerPlacementSelectedTower | null
}

interface TowerPlacementOptions {
  canInteract: () => boolean
  getCurrentCoins: () => number
  spendCoins: (amount: number) => boolean
  onStatusUpdate: (status: string) => void
  onTowerPlaced?: (towerType: TowerType) => void
  onTowerUpgraded?: () => void
}

export default class TowerPlacementSystem {
  private readonly scene: Phaser.Scene
  private readonly options: TowerPlacementOptions
  private readonly pads: BuildPad[]
  private readonly towers: TowerRuntime[] = []
  private draggingType?: TowerType
  private dragGhost?: Phaser.GameObjects.Container
  private dragGhostRange?: Phaser.GameObjects.Arc
  private dragGhostBody?: Phaser.GameObjects.Rectangle
  private dragGhostRoof?: Phaser.GameObjects.Triangle
  private selectedTowerId?: string
  private nextId = 1

  private readonly handlePointerMove = (pointer: Phaser.Input.Pointer): void => this.moveDragGhost(pointer)
  private readonly handlePointerUp = (pointer: Phaser.Input.Pointer): void => this.finishDrag(pointer)

  constructor(scene: Phaser.Scene, options: TowerPlacementOptions) {
    this.scene = scene
    this.options = options
    this.pads = createBuildPads(scene)
    buildCards(scene, (type, pointer) => this.startDrag(type, pointer))
    scene.input.on('pointermove', this.handlePointerMove)
    scene.input.on('pointerup', this.handlePointerUp)
  }

  getTowers(): readonly TowerRuntime[] {
    return this.towers
  }

  getSnapshot(currentCoins = 0): TowerPlacementSnapshot {
    const selected = this.towers.find((tower) => tower.id === this.selectedTowerId)
    if (!selected) return { selectedTower: null }

    const preview = createTowerUpgradePreview(selected)
    const upgradeRequest = this.resolveUpgradeRequest(selected, currentCoins)

    return {
      selectedTower: {
        id: selected.id,
        name: TOWERS[selected.type].name,
        type: selected.type,
        level: selected.level,
        damage: selected.damage,
        range: selected.range,
        fireRateMs: selected.fireRateMs,
        upgradeCost: selected.upgradeCost,
        affordable: upgradeRequest.type === 'success',
        upgrade: {
          ...preview,
          cost: selected.upgradeCost,
        },
      },
    }
  }

  destroy(): void {
    this.scene.input.off('pointermove', this.handlePointerMove)
    this.scene.input.off('pointerup', this.handlePointerUp)
    this.clearGhostAndHighlights()
    this.draggingType = undefined
  }

  private startDrag(type: TowerType, pointer: Phaser.Input.Pointer): void {
    if (!this.options.canInteract()) return

    this.draggingType = type
    const tower = TOWERS[type]
    this.clearGhostAndHighlights()

    this.dragGhost = this.scene.add.container(pointer.worldX, pointer.worldY)
    this.dragGhostRange = this.scene.add.circle(0, 0, tower.range, 0x000000, 0.08).setStrokeStyle(1, 0x000000, 0.18)
    this.dragGhostBody = this.scene.add.rectangle(0, 2, 22, 26, tower.color, 0.82)
    this.dragGhostRoof = this.scene.add.triangle(0, -16, -15, 8, 15, 8, 0, -12, tower.topColor)
    this.dragGhost.add([this.dragGhostRange, this.dragGhostBody, this.dragGhostRoof])
    this.setGhostColor(false)
    playClickSfx()
    this.updateDragVisuals(pointer)
  }

  private moveDragGhost(pointer: Phaser.Input.Pointer): void {
    this.updateDragVisuals(pointer)
  }

  private updateDragVisuals(pointer: Phaser.Input.Pointer): void {
    if (!this.dragGhost || !this.dragGhostRange || !this.dragGhostBody || !this.dragGhostRoof) return
    if (!this.draggingType || !this.options.canInteract()) {
      this.clearDrag('')
      return
    }

    this.dragGhost.setPosition(pointer.worldX, pointer.worldY)
    const canPlace = this.resolveCurrentDragOutcome(pointer.worldX, pointer.worldY).type === 'success'
    this.updatePadHighlights(pointer.worldX, pointer.worldY, canPlace)
    this.setGhostColor(canPlace)
  }

  private finishDrag(pointer: Phaser.Input.Pointer): void {
    if (!this.draggingType) return
    if (!this.options.canInteract()) {
      this.options.onStatusUpdate('Drag cancelled.')
      this.clearGhostAndHighlights()
      this.draggingType = undefined
      return
    }

    const type = this.draggingType
    const definition = TOWERS[type]
    const outcome = this.resolveCurrentDragOutcome(pointer.worldX, pointer.worldY, definition)

    if (outcome.type === 'success') {
      const pad = this.resolvePadFromState(outcome)
      if (!pad) {
        this.options.onStatusUpdate('Drag cancelled — drop on a glowing circle.')
      } else if (this.options.spendCoins(definition.cost)) {
        this.placeTower(definition, pad)
        this.options.onStatusUpdate(outcome.status)
      } else {
        this.options.onStatusUpdate(`Could not spend ${definition.cost} coins now.`)
      }
    } else {
      this.options.onStatusUpdate(outcome.status)
    }

    this.clearGhostAndHighlights()
    this.draggingType = undefined
  }

  private clearGhostAndHighlights(): void {
    if (this.dragGhost) this.dragGhost.destroy()
    this.dragGhost = undefined
    this.dragGhostRange = undefined
    this.dragGhostBody = undefined
    this.dragGhostRoof = undefined
    for (const item of this.pads) {
      item.ring.setFillStyle(PAD_FREE_COLOR, PAD_BASE_ALPHA)
      item.ring.setStrokeStyle(2, PAD_FREE_COLOR, 0.35)
    }
  }

  private clearDrag(status: string): void {
    this.options.onStatusUpdate(status)
    this.clearGhostAndHighlights()
  }

  private resolveCurrentDragOutcome(
    worldX: number,
    worldY: number,
    definition?: typeof TOWERS[keyof typeof TOWERS],
  ): PlacementDropOutcome {
    const activeDefinition = definition ?? (this.draggingType ? TOWERS[this.draggingType] : undefined)
    if (!activeDefinition) {
      return {
        type: 'cancelled',
        reason: 'outside-range',
        target: undefined,
        spendAmount: 0,
        nextCoins: this.options.getCurrentCoins(),
        status: 'Drag cancelled — drop on a glowing circle.',
      }
    }

    const padState: readonly BuildPadState[] = this.pads.map((pad) => ({
      x: pad.x,
      y: pad.y,
      occupied: Boolean(pad.occupiedBy),
    }))

    const request: TowerPlacementCostLike = {
      towerName: activeDefinition.name,
      cost: activeDefinition.cost,
    }

    return resolvePlacementDrop({ x: worldX, y: worldY }, padState, CONFIG.run.buildSpotRadius, request, this.options.getCurrentCoins())
  }

  private updatePadHighlights(worldX: number, worldY: number, canPlace: boolean): void {
    const padState: readonly BuildPadState[] = this.pads.map((pad) => ({
      x: pad.x,
      y: pad.y,
      occupied: Boolean(pad.occupiedBy),
    }))
    const nearest = findNearestPadWithinRadius({ x: worldX, y: worldY }, padState, CONFIG.run.buildSpotRadius)

    for (const pad of this.pads) {
      const isOccupied = Boolean(pad.occupiedBy)
      const isValidTarget = Boolean(
        canPlace && nearest.validPad && nearest.validPad.x === pad.x && nearest.validPad.y === pad.y && !pad.occupiedBy,
      )
      const isBlockedTarget = Boolean(
        !canPlace && nearest.validPad && nearest.validPad.x === pad.x && nearest.validPad.y === pad.y,
      )

      if (isValidTarget) {
        pad.ring.setFillStyle(PAD_HOVER_COLOR, PAD_HOVER_ALPHA)
        pad.ring.setStrokeStyle(2, PAD_HOVER_COLOR, 0.58)
      } else if (isOccupied || isBlockedTarget) {
        pad.ring.setFillStyle(PAD_OCCUPIED_COLOR, PAD_OCCUPIED_ALPHA)
        pad.ring.setStrokeStyle(2, PAD_OCCUPIED_COLOR, 0.5)
      } else {
        pad.ring.setFillStyle(PAD_FREE_COLOR, PAD_BASE_ALPHA)
        pad.ring.setStrokeStyle(2, PAD_FREE_COLOR, 0.35)
      }
    }

    if (!nearest.validPad) {
      const nearestOccupied = nearest.nearestPad?.occupied ? nearest.nearestPad : undefined
      if (nearestOccupied) {
        const pad = this.pads.find((entry) => entry.x === nearestOccupied.x && entry.y === nearestOccupied.y)
        if (pad) {
          pad.ring.setFillStyle(PAD_OCCUPIED_COLOR, PAD_OCCUPIED_ALPHA)
          pad.ring.setStrokeStyle(2, PAD_OCCUPIED_COLOR, 0.5)
        }
      }
    }
  }

  private setGhostColor(valid: boolean): void {
    if (!this.dragGhostRange || !this.dragGhostBody || !this.dragGhostRoof) return
    const color = valid ? GHOST_VALID_COLOR : GHOST_INVALID_COLOR
    const stroke = valid ? 0x3dbd5c : GHOST_INVALID_COLOR

    this.dragGhostRange.setFillStyle(color, 0.1).setStrokeStyle(1, stroke, 0.36)
    this.dragGhostBody.setFillStyle(color, 0.82)
    this.dragGhostRoof.setFillStyle(stroke, 1)
  }

  private resolvePadFromState(outcome: PlacementDropOutcome): BuildPad | undefined {
    if (outcome.type !== 'success') return undefined
    const selected = outcome.target
    return this.pads.find((pad) => pad.x === selected.x && pad.y === selected.y)
  }

  private placeTower(definition: typeof TOWERS[keyof typeof TOWERS], pad: BuildPad): void {
    const view = new TowerView(this.scene, definition, pad.x, pad.y)
    const tower: TowerRuntime = {
      ...definition,
      id: `tower-${this.nextId++}`,
      x: pad.x,
      y: pad.y,
      level: 1,
      upgradeCost: definition.upgradeCost,
      nextShotAt: 0,
      view,
    }

    pad.occupiedBy = tower.id
    this.towers.push(tower)
    this.selectTower(tower.id)
    view.container.setInteractive(new Phaser.Geom.Rectangle(-22, -26, 44, 52), Phaser.Geom.Rectangle.Contains)
    view.container.on('pointerdown', () => this.selectTower(tower.id))
    playBuildSfx()

    if (this.options.onTowerPlaced) {
      this.options.onTowerPlaced(definition.type)
    }
  }

  upgradeSelectedTower(): boolean {
    if (!this.options.canInteract()) {
      this.options.onStatusUpdate('Cannot upgrade right now.')
      return false
    }

    const tower = this.towers.find((item) => item.id === this.selectedTowerId)
    const outcome = this.resolveUpgradeRequest(tower ?? null, this.options.getCurrentCoins())

    switch (outcome.type) {
      case 'no-selection':
        this.options.onStatusUpdate('Select a tower first to upgrade it.')
        return false
      case 'insufficient-funds':
        this.options.onStatusUpdate(`Need ${outcome.needed} coins to upgrade.`)
        return false
      case 'success':
        break
    }

    if (!this.options.spendCoins(outcome.cost)) {
      this.options.onStatusUpdate('Could not upgrade now. Try again.')
      return false
    }

    Object.assign(tower as TowerUpgradeStats, outcome.next)
    tower!.view.setLevel(tower!.level)
    tower!.view.setSelected(true)
    this.options.onStatusUpdate(`${TOWERS[tower!.type].name} upgraded to level ${tower!.level}.`)
    playBuildSfx()
    if (this.options.onTowerUpgraded) {
      this.options.onTowerUpgraded()
    }
    return true
  }

  private resolveUpgradeRequest(tower: TowerRuntime | null, currentCoins: number): TowerUpgradeRequestOutcome {
    if (!tower) return resolveTowerUpgradeRequest(null, currentCoins)

    const selected: TowerUpgradeStats = {
      level: tower.level,
      damage: tower.damage,
      range: tower.range,
      fireRateMs: tower.fireRateMs,
      upgradeCost: tower.upgradeCost,
    }

    return resolveTowerUpgradeRequest(selected, currentCoins)
  }

  private selectTower(id: string): void {
    if (!this.options.canInteract()) return
    this.selectedTowerId = id
    for (const tower of this.towers) tower.view.setSelected(tower.id === id)
  }
}
