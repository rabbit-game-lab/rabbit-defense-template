import Phaser from 'phaser'
import { TOWERS, type TowerType } from '../data/towerDefense'
import {
  createBuildPads,
  buildCards,
  nearestFreePad,
  type BuildPad,
} from './gameBoard'
import { computeTowerUpgrade } from './towerDefenseRules'
import { playBuildSfx, playClickSfx } from './audioManager'
import { TowerView, type TowerRuntime } from '../entities/TowerView'

export interface TowerPlacementSnapshot {
  selectedTowerText: string
}

interface TowerPlacementOptions {
  spendCoins: (amount: number) => boolean
  onStatusUpdate: (status: string) => void
  canInteract: () => boolean
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

  getSnapshot(): TowerPlacementSnapshot {
    const selected = this.towers.find((tower) => tower.id === this.selectedTowerId)
    return {
      selectedTowerText: selected ? `${TOWERS[selected.type].name} L${selected.level}` : 'none',
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
    const pad = nearestFreePad(pointer.worldX, pointer.worldY, this.pads)
    this.dragGhost?.destroy()
    this.dragGhost = undefined
    this.draggingType = undefined

    for (const item of this.pads) item.ring.setFillStyle(0xf6d365, 0.08)
    if (!pad) {
      this.options.onStatusUpdate('Drop on an empty golden build circle.')
      return
    }

    this.placeTower(type, pad)
  }

  private placeTower(type: TowerType, pad: BuildPad): void {
    const definition = TOWERS[type]
    if (!this.options.spendCoins(definition.cost)) {
      this.options.onStatusUpdate(`Need ${definition.cost} coins for ${definition.name}.`)
      return
    }

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
    view.container.on('pointerdown', () => this.selectOrUpgradeTower(tower.id))
    this.options.onStatusUpdate(`${definition.name} built. Tap it with enough coins to upgrade.`)
    playBuildSfx()

    if (!this.hasPlacedFirstTower) {
      this.hasPlacedFirstTower = true
      this.options.onFirstTowerPlaced?.()
    }
  }

  private selectOrUpgradeTower(id: string): void {
    if (!this.options.canInteract()) return

    if (this.selectedTowerId !== id) {
      this.selectTower(id)
      return
    }

    const tower = this.towers.find((item) => item.id === id)
    if (!tower) return

    if (!this.options.spendCoins(tower.upgradeCost)) {
      this.options.onStatusUpdate(`Need ${tower.upgradeCost} coins to upgrade.`)
      return
    }

    Object.assign(tower, computeTowerUpgrade(tower))
    tower.view.setLevel(tower.level)
    tower.view.setSelected(true)
    this.options.onStatusUpdate(`${TOWERS[tower.type].name} upgraded to level ${tower.level}.`)
    playBuildSfx()
  }

  private selectTower(id?: string): void {
    this.selectedTowerId = id
    for (const tower of this.towers) tower.view.setSelected(tower.id === id)
  }
}
