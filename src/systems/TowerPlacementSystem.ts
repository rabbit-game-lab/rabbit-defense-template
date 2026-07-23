import Phaser from 'phaser'
import { TOWERS, type TowerType } from '../data/towerDefense'
import { createBuildPads, buildCards, type BuildPad } from './gameBoard'
import {
  createTowerUpgradePreview,
  resolveTowerUpgradeRequest,
  type PlacementDropOutcome,
  type TowerUpgradeRequestOutcome,
  type TowerUpgradeStats,
  type TowerUpgradePreview,
} from './towerDefenseRules'
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
  private readonly dragController: TowerPlacementDragController
  private selectedTowerId?: string
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
        maxed: preview.maxed ?? false,
        upgrade: {
          ...preview,
          cost: preview.cost,
        },
      },
    }
  }

  destroy(): void {
    this.scene.input.off('pointermove', this.handlePointerMove)
    this.scene.input.off('pointerup', this.handlePointerUp)
    this.dragController.clear()
  }

  private startDrag(type: TowerType, pointer: Phaser.Input.Pointer): void {
    if (!this.options.canInteract()) return
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
        this.options.onStatusUpdate(outcome.status)
      } else {
        this.options.onStatusUpdate(`Could not spend ${definition.cost} coins now.`)
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
      maxLevel: definition.maxLevel,
      upgradeCost: definition.upgradeCost,
      nextShotAt: 0,
      view,
    }

    view.setRange(tower.range)
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
      case 'max-level':
        this.options.onStatusUpdate('This tower is already at MAX LEVEL.')
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
    tower!.view.setRange(tower!.range)
    tower!.view.setSelected(true)
    this.options.onStatusUpdate(`${TOWERS[tower!.type].name} upgraded to level ${tower!.level}.`)
    playBuildSfx()

    if (this.options.onTowerUpgraded) {
      this.options.onTowerUpgraded()
    }

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

  private selectTower(id: string): void {
    if (!this.options.canInteract()) return
    this.selectedTowerId = id
    for (const tower of this.towers) tower.view.setSelected(tower.id === id)
  }
}
