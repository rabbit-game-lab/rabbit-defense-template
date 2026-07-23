import Phaser from 'phaser'
import { TOWERS, type TowerType } from '../data/towerDefense'
import {
  createBuildPads,
  buildCards,
  nearestFreePad,
  type BuildPad,
} from './gameBoard'
import {
  createTowerUpgradePreview,
  resolveTowerUpgradeRequest,
  type TowerUpgradeRequestOutcome,
  type TowerUpgradeStats,
  type TowerUpgradePreview,
} from './towerDefenseRules'
import { playBuildSfx, playClickSfx } from './audioManager'
import { TowerView, type TowerRuntime } from '../entities/TowerView'

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
  onFirstTowerPlaced?: () => void
}

export default class TowerPlacementSystem {
  private readonly scene: Phaser.Scene
  private readonly options: TowerPlacementOptions
  private readonly pads: BuildPad[]
  private readonly towers: TowerRuntime[] = []
  private draggingType?: TowerType
  private dragGhost?: Phaser.GameObjects.Container
  private selectedTowerId?: string
  private nextId = 1
  private hasPlacedFirstTower = false

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
    this.dragGhost?.destroy()
    this.dragGhost = undefined
    this.draggingType = undefined
  }

  private startDrag(type: TowerType, pointer: Phaser.Input.Pointer): void {
    if (!this.options.canInteract()) return

    this.draggingType = type
    this.dragGhost?.destroy()
    const tower = TOWERS[type]

    this.dragGhost = this.scene.add.container(pointer.worldX, pointer.worldY)
    this.dragGhost.add([
      this.scene.add.circle(0, 0, tower.range, 0xffffff, 0.08).setStrokeStyle(1, 0xffffff, 0.18),
      this.scene.add.rectangle(0, 2, 22, 26, tower.color, 0.82),
      this.scene.add.triangle(0, -16, -15, 8, 15, 8, 0, -12, tower.topColor),
    ])
    playClickSfx()
  }

  private moveDragGhost(pointer: Phaser.Input.Pointer): void {
    if (!this.dragGhost || !this.options.canInteract()) return
    this.dragGhost.setPosition(pointer.worldX, pointer.worldY)

    const pad = nearestFreePad(pointer.worldX, pointer.worldY, this.pads)
    for (const item of this.pads) item.ring.setFillStyle(0xf6d365, item === pad ? 0.22 : 0.08)
  }

  private finishDrag(pointer: Phaser.Input.Pointer): void {
    if (!this.draggingType || !this.options.canInteract()) return

    const type = this.draggingType
    const definition = TOWERS[type]
    const pad = nearestFreePad(pointer.worldX, pointer.worldY, this.pads)

    this.dragGhost?.destroy()
    this.dragGhost = undefined
    this.draggingType = undefined

    for (const item of this.pads) item.ring.setFillStyle(0xf6d365, 0.08)
    if (!pad) {
      this.options.onStatusUpdate('Drop on an empty golden build circle.')
      return
    }

    const currentCoins = this.options.getCurrentCoins()
    if (currentCoins < definition.cost) {
      this.options.onStatusUpdate(`Need ${definition.cost} coins for ${definition.name}.`)
      return
    }

    if (!this.options.spendCoins(definition.cost)) {
      this.options.onStatusUpdate(`Need ${definition.cost} coins for ${definition.name}.`)
      return
    }

    this.placeTower(definition, pad)
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
    this.options.onStatusUpdate(`${definition.name} built. Tap to select it.`)
    playBuildSfx()

    if (!this.hasPlacedFirstTower) {
      this.hasPlacedFirstTower = true
      this.options.onFirstTowerPlaced?.()
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
