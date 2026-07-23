import Phaser from 'phaser'
import { CONFIG } from '../game.config'
import { SHOP_TOWER_ORDER, TOWERS, type TowerType } from '../data/towerDefense'
import { createBuildPads, buildCards, type BuildPad } from './gameBoard'
import {
  createTowerUpgradePreview,
  resolveTowerUpgradeRequest,
  type PlacementDropOutcome,
  type TowerUpgradeRequestOutcome,
  type TowerUpgradeStats,
  type TowerUpgradePreview,
} from './towerDefenseRules'
import { refundForTower } from './towerEconomyRules'
import { playBuildSfx, playClickSfx } from './audioManager'
import { TowerView, type TowerRuntime } from '../entities/TowerView'
import TowerPlacementDragController from './TowerPlacementDragController'

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
  maxed: boolean
  sellRefund: number
  sellEnabled: boolean
}

export interface TowerPlacementSnapshot {
  selectedTower: TowerPlacementSelectedTower | null
  pendingTowerType: TowerType | null
  shop: Array<{
    type: TowerType
    name: string
    role: string
    cost: number
    affordable: boolean
    shortfall: number
  }>
  pads: Array<{ id: string; occupied: boolean }>
  towerIds: string[]
}

interface TowerPlacementOptions {
  canInteract: () => boolean
  getCurrentCoins: () => number
  spendCoins: (amount: number) => boolean
  onStatusUpdate: (status: string) => void
  onTowerPlaced?: (towerType: TowerType) => void
  onTowerChosen?: (towerType: TowerType) => void
  onTowerSelected?: (towerId: string) => void
  onTowerUpgraded?: () => void
  onTowerSold?: (amount: number) => void
}

export default class TowerPlacementSystem {
  private readonly scene: Phaser.Scene
  private readonly options: TowerPlacementOptions
  private readonly pads: BuildPad[]
  private readonly towers: TowerRuntime[] = []
  private readonly dragController: TowerPlacementDragController
  private selectedTowerId?: string
  private pendingTowerType?: TowerType
  private nextId = 1

  private readonly handlePointerMove = (pointer: Phaser.Input.Pointer): void => {
    this.dragController.move(pointer)
  }

  private readonly handlePointerUp = (pointer: Phaser.Input.Pointer): void => {
    this.finishDrag(pointer)
  }

  constructor(scene: Phaser.Scene, options: TowerPlacementOptions) {
    this.scene = scene
    this.options = options
    this.pads = createBuildPads(scene)
    this.dragController = new TowerPlacementDragController(scene, this.pads, {
      canInteract: this.options.canInteract,
      getCurrentCoins: this.options.getCurrentCoins,
      onStatusUpdate: this.options.onStatusUpdate,
    })

    buildCards(scene, (type, pointer) => this.startDrag(type, pointer))
    for (const pad of this.pads) {
      pad.ring
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          if (this.pendingTowerType) this.placeOnPad(pad.id)
        })
    }
    scene.input.on('pointermove', this.handlePointerMove)
    scene.input.on('pointerup', this.handlePointerUp)
    scene.input.on('pointerupoutside', this.handlePointerUp)
    scene.input.on('gameout', this.handleGameOut)
  }

  getTowers(): readonly TowerRuntime[] {
    return this.towers
  }

  getSnapshot(currentCoins = 0): TowerPlacementSnapshot {
    const selected = this.towers.find((tower) => tower.id === this.selectedTowerId)
    return {
      selectedTower: selected ? this.createSelectedTowerSnapshot(selected, currentCoins) : null,
      pendingTowerType: this.pendingTowerType ?? null,
      shop: SHOP_TOWER_ORDER.map((type) => {
        const tower = TOWERS[type]
        return {
          type,
          name: tower.name,
          role: tower.description,
          cost: tower.cost,
          affordable: currentCoins >= tower.cost,
          shortfall: Math.max(0, tower.cost - currentCoins),
        }
      }),
      pads: this.pads.map((pad) => ({ id: pad.id, occupied: Boolean(pad.occupiedBy) })),
      towerIds: this.towers.map((tower) => tower.id),
    }
  }

  destroy(): void {
    this.scene.input.off('pointermove', this.handlePointerMove)
    this.scene.input.off('pointerup', this.handlePointerUp)
    this.scene.input.off('pointerupoutside', this.handlePointerUp)
    this.scene.input.off('gameout', this.handleGameOut)
    this.dragController.destroy()
    for (const tower of this.towers) tower.view.destroy()
    this.towers.length = 0
  }

  private startDrag(type: TowerType, pointer: Phaser.Input.Pointer): void {
    if (!this.options.canInteract()) return
    this.beginPlacement(type)
    playClickSfx()
    this.dragController.startDrag(type, pointer)
  }

  private finishDrag(pointer: Phaser.Input.Pointer): void {
    const result = this.dragController.finish(pointer)
    if (!result) {
      if (!this.options.canInteract() && this.dragController.isDragging()) {
        this.dragController.clear()
        this.options.onStatusUpdate('Drag cancelled.')
      }
      return
    }

    const { outcome, towerType } = result
    const definition = TOWERS[towerType]

    if (outcome.type === 'success') {
      const pad = this.resolvePadFromState(outcome)
      if (!pad) {
        this.options.onStatusUpdate('Drag cancelled — drop on a glowing circle.')
        return
      }

      if (this.options.spendCoins(definition.cost)) {
        this.placeTower(definition, pad)
        this.pendingTowerType = undefined
        this.options.onStatusUpdate(outcome.status)
      } else {
        this.options.onStatusUpdate(`Could not spend ${definition.cost} ryo now.`)
      }
      return
    }

    this.options.onStatusUpdate(outcome.status)
  }

  private placeTower(definition: typeof TOWERS[keyof typeof TOWERS], pad: BuildPad): void {
    const view = new TowerView(this.scene, definition, pad.x, pad.y)
    const tower: TowerRuntime = {
      ...definition,
      id: `tower-${this.nextId++}`,
      x: pad.x,
      y: pad.y,
      level: 1,
      investedCost: definition.cost,
      maxLevel: definition.maxLevel,
      upgradeCost: definition.upgradeCost,
      nextShotAt: 0,
      view,
    }

    view.setRange(tower.range)
    pad.occupiedBy = tower.id
    pad.marker.setText('×').setAlpha(0.55)
    this.towers.push(tower)
    this.selectTower(tower.id)
    view.container.setInteractive(new Phaser.Geom.Rectangle(-22, -26, 44, 52), Phaser.Geom.Rectangle.Contains)
    view.container.on('pointerdown', () => this.selectTower(tower.id))
    playBuildSfx()

    if (this.options.onTowerPlaced) {
      this.options.onTowerPlaced(definition.type)
    }
  }

  beginPlacement(type: TowerType): boolean {
    if (!this.options.canInteract()) return false
    const definition = TOWERS[type]
    this.pendingTowerType = type
    this.options.onTowerChosen?.(type)
    this.options.onStatusUpdate(
      this.options.getCurrentCoins() >= definition.cost
        ? `${definition.name} ready — tap a free seal.`
        : `${definition.name}: need ${definition.cost - this.options.getCurrentCoins()} more ryo.`,
    )
    return true
  }

  cancelPlacement(): boolean {
    const hadPendingPlacement = Boolean(this.pendingTowerType || this.dragController.isDragging())
    this.pendingTowerType = undefined
    this.dragController.clear()
    if (hadPendingPlacement) this.options.onStatusUpdate('Placement cancelled.')
    return hadPendingPlacement
  }

  placeOnPad(padId: string): boolean {
    if (!this.options.canInteract() || !this.pendingTowerType) return false
    const pad = this.pads.find((candidate) => candidate.id === padId)
    const definition = TOWERS[this.pendingTowerType]
    if (!pad) {
      this.options.onStatusUpdate('That build seal is unavailable.')
      return false
    }
    if (pad.occupiedBy) {
      this.options.onStatusUpdate('That seal is occupied — choose a free circle.')
      return false
    }
    if (!this.options.spendCoins(definition.cost)) {
      this.options.onStatusUpdate(`Need ${definition.cost - this.options.getCurrentCoins()} more ryo.`)
      return false
    }
    this.placeTower(definition, pad)
    this.pendingTowerType = undefined
    this.dragController.clear()
    this.options.onStatusUpdate(`${definition.name} placed.`)
    return true
  }

  selectTower(id: string): boolean {
    if (!this.options.canInteract()) return false
    const tower = this.towers.find((candidate) => candidate.id === id)
    if (!tower) return false
    this.selectedTowerId = id
    for (const candidate of this.towers) candidate.view.setSelected(candidate.id === id)
    this.options.onTowerSelected?.(id)
    return true
  }

  focusPad(padId: string): boolean {
    if (!this.options.canInteract() || !this.pendingTowerType) return false
    let found = false
    for (const pad of this.pads) {
      const focused = pad.id === padId
      found ||= focused
      pad.marker.setText(pad.occupiedBy ? '×' : focused ? '◎' : '＋')
      pad.ring.setStrokeStyle(focused ? 3 : 2, focused ? 0xffffff : 0xf6d365, focused ? 0.9 : 0.42)
    }
    return found
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
        this.options.onStatusUpdate('Select a defense first to upgrade it.')
        return false
      case 'insufficient-funds':
        this.options.onStatusUpdate(`Need ${outcome.needed} ryo to upgrade.`)
        return false
      case 'max-level':
        this.options.onStatusUpdate('This defense is already at MAX LEVEL.')
        return false
      case 'success':
        break
    }

    if (!this.options.spendCoins(outcome.cost)) {
      this.options.onStatusUpdate('Could not upgrade now. Try again.')
      return false
    }

    Object.assign(tower as TowerUpgradeStats, outcome.next)
    tower!.investedCost = Math.max(0, tower!.investedCost + outcome.cost)
    tower!.view.setLevel(tower!.level)
    tower!.view.setRange(tower!.range)
    tower!.view.setSelected(true)
    this.options.onStatusUpdate(`${TOWERS[tower!.type].name} upgraded to level ${tower!.level}.`)
    playBuildSfx()

    if (this.options.onTowerUpgraded) {
      this.options.onTowerUpgraded()
    }

    return true
  }

  sellSelectedTower(): boolean {
    if (!this.options.canInteract()) {
      this.options.onStatusUpdate('Cannot sell now.')
      return false
    }

    const selected = this.towers.find((item) => item.id === this.selectedTowerId)
    if (!selected) {
      this.options.onStatusUpdate('Select a defense first to sell it.')
      return false
    }

    const pad = this.findPadByTowerId(selected.id)
    if (pad) pad.occupiedBy = undefined
    if (pad) pad.marker.setText('＋').setAlpha(0.75)

    const refund = refundForTower(selected, CONFIG.run.refundRatio)
    this.towers.splice(this.towers.indexOf(selected), 1)
    selected.view.destroy()
    this.selectedTowerId = undefined

    if (this.options.onTowerSold) this.options.onTowerSold(refund)
    this.options.onStatusUpdate(`Sold ${TOWERS[selected.type].name} for ${refund} ryo.`)
    return true
  }

  private resolvePadFromState(outcome: PlacementDropOutcome): BuildPad | undefined {
    if (outcome.type !== 'success') return undefined
    const selected = outcome.target
    return this.pads.find((pad) => pad.x === selected.x && pad.y === selected.y)
  }

  private resolveUpgradeRequest(tower: TowerRuntime | null, currentCoins: number): TowerUpgradeRequestOutcome {
    if (!tower) return resolveTowerUpgradeRequest(null, currentCoins)

    const selected: TowerUpgradeStats = {
      level: tower.level,
      damage: tower.damage,
      range: tower.range,
      fireRateMs: tower.fireRateMs,
      upgradeCost: tower.upgradeCost,
      maxLevel: tower.maxLevel,
    }

    return resolveTowerUpgradeRequest(selected, currentCoins)
  }

  private findPadByTowerId(towerId: string): BuildPad | undefined {
    return this.pads.find((pad) => pad.occupiedBy === towerId)
  }

  private createSelectedTowerSnapshot(selected: TowerRuntime, currentCoins: number): TowerPlacementSelectedTower {
    const preview = createTowerUpgradePreview(selected)
    const upgradeRequest = this.resolveUpgradeRequest(selected, currentCoins)
    return {
      id: selected.id,
      name: TOWERS[selected.type].name,
      type: selected.type,
      level: selected.level,
      damage: selected.damage,
      range: selected.range,
      fireRateMs: selected.fireRateMs,
      upgradeCost: selected.upgradeCost,
      affordable: upgradeRequest.type === 'success',
      maxed: preview.maxed ?? false,
      sellEnabled: this.options.canInteract(),
      sellRefund: refundForTower(selected, CONFIG.run.refundRatio),
      upgrade: { ...preview, cost: preview.cost },
    }
  }

  private readonly handleGameOut = (): void => {
    if (!this.dragController.isDragging()) return
    this.dragController.clear()
    this.options.onStatusUpdate('Drag cancelled — pointer left the game.')
  }
}
