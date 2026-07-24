import Phaser from 'phaser'
import { CONFIG } from '../game.config'
import { SHOP_TOWER_ORDER, TOWERS, type TowerDefinition, type TowerType } from '../data/towerDefense'
import type { PlacementEvaluation, PlacedTowerAnchor } from '../data/terrain'
import { buildCards, type ShopCard } from './gameBoard'
import { evaluateTerrainPlacement } from './terrainPlacementRules'
import { createTowerUpgradePreview, cycleTargetMode, resolveTowerUpgradeRequest, TARGET_MODE_LABELS, type TargetMode, type TowerUpgradeStats } from './towerDefenseRules'
import { refundForTower } from './towerEconomyRules'
import { playBuildSfx, playClickSfx } from './audioManager'
import { TowerView, type TowerRuntime } from '../entities/TowerView'
import { TerrainPlacementPreview } from './TerrainPlacementPreview'

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
  upgrade: ReturnType<typeof createTowerUpgradePreview>
  maxed: boolean
  sellRefund: number
  sellEnabled: boolean
  targetMode: TargetMode
  targetModeLabel: string
}

export interface TowerPlacementSnapshot {
  selectedTower: TowerPlacementSelectedTower | null
  pendingTowerType: TowerType | null
  cursor: PlacementEvaluation | null
  anchors: PlacedTowerAnchor[]
  towerCount: number
  towerMaximum: number
  spacingLabels: Record<TowerType, string>
  shop: Array<{ type: TowerType; name: string; role: string; cost: number; affordable: boolean; shortfall: number }>
  towerIds: string[]
}

interface TowerPlacementOptions {
  canInteract: () => boolean
  getCurrentCoins: () => number
  getOnboardingVisible: () => boolean
  spendCoins: (amount: number) => boolean
  onStatusUpdate: (status: string) => void
  onTowerPlaced?: (towerType: TowerType, x: number, y: number) => void
  onTowerChosen?: (towerType: TowerType) => void
  onTowerSelected?: (towerId: string) => void
  onTowerUpgraded?: () => void
  onTowerSold?: (amount: number) => void
}

interface CardGesture {
  type: TowerType
  pointerId: number
  startX: number
  startY: number
  dragging: boolean
}

export default class TowerPlacementSystem {
  private readonly towers: TowerRuntime[] = []
  private readonly preview: TerrainPlacementPreview
  private readonly shopCards: ShopCard[]
  private selectedTowerId?: string
  private pendingTowerType?: TowerType
  private cursorX = 16 + CONFIG.placement.cellSize * CONFIG.placement.cursorStartColumn
  private cursorY = 16 + CONFIG.placement.cellSize * CONFIG.placement.cursorStartRow
  private cursorEvaluation: PlacementEvaluation | null = null
  private cardGesture?: CardGesture
  private suppressedPointerId?: number
  private nextId = 1

  constructor(private readonly scene: Phaser.Scene, private readonly options: TowerPlacementOptions) {
    this.preview = new TerrainPlacementPreview(scene)
    this.shopCards = buildCards(scene, (type, pointer) => this.startCardGesture(type, pointer))
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
      cursor: this.cursorEvaluation,
      anchors: this.getAnchors(),
      towerCount: this.towers.length,
      towerMaximum: CONFIG.placement.maxTowers,
      spacingLabels: {
        arrow: '1 empty square',
        frost: '1 empty square',
        bomb: '2 empty squares',
      },
      shop: SHOP_TOWER_ORDER.map((type) => {
        const tower = TOWERS[type]
        return { type, name: tower.name, role: tower.description, cost: tower.cost, affordable: currentCoins >= tower.cost, shortfall: Math.max(0, tower.cost - currentCoins) }
      }),
      towerIds: this.towers.map((tower) => tower.id),
    }
  }

  beginPlacement(type: TowerType): boolean {
    if (!this.options.canInteract()) return false
    this.pendingTowerType = type
    this.options.onTowerChosen?.(type)
    const definition = TOWERS[type]
    this.options.onStatusUpdate(
      this.options.getCurrentCoins() >= definition.cost
        ? `${definition.name} ready — choose a clear grass square (${this.spacingLabel(type)}).`
        : `${definition.name}: need ${definition.cost - this.options.getCurrentCoins()} more ryo.`,
    )
    this.previewPlacementAt(this.cursorX, this.cursorY)
    return true
  }

  cancelPlacement(): boolean {
    const hadPending = Boolean(this.pendingTowerType || this.cardGesture)
    this.pendingTowerType = undefined
    this.cardGesture = undefined
    this.cursorEvaluation = null
    this.preview.hide()
    if (hadPending) this.options.onStatusUpdate('Placement cancelled.')
    return hadPending
  }

  previewPlacementAt(x: number, y: number): PlacementEvaluation | null {
    if (!this.pendingTowerType) return null
    const definition = TOWERS[this.pendingTowerType]
    const evaluation = evaluateTerrainPlacement({
      x,
      y,
      towerType: definition.type,
      towerCost: definition.cost,
      coins: this.options.getCurrentCoins(),
      maxTowers: CONFIG.placement.maxTowers,
      placed: this.getAnchors(),
      onboardingVisible: this.options.getOnboardingVisible(),
    })
    this.cursorX = evaluation.cell.x
    this.cursorY = evaluation.cell.y
    this.cursorEvaluation = evaluation
    this.preview.show(definition.type, evaluation)
    return evaluation
  }

  placePendingAt(x: number, y: number): boolean {
    if (!this.options.canInteract() || !this.pendingTowerType) return false
    const type = this.pendingTowerType
    const evaluation = this.previewPlacementAt(x, y)
    if (!evaluation?.valid) {
      if (evaluation) this.options.onStatusUpdate(evaluation.message)
      return false
    }
    const definition = TOWERS[type]
    if (!this.options.spendCoins(definition.cost)) {
      this.previewPlacementAt(x, y)
      this.options.onStatusUpdate(`Need ${Math.max(0, definition.cost - this.options.getCurrentCoins())} more ryo.`)
      return false
    }
    this.placeTower(definition, evaluation.cell.x, evaluation.cell.y)
    this.pendingTowerType = undefined
    this.cursorEvaluation = null
    this.preview.hide()
    this.options.onStatusUpdate(`${definition.name} placed on grass.`)
    return true
  }

  movePlacementCursor(dx: number, dy: number): PlacementEvaluation | null {
    return this.previewPlacementAt(
      Phaser.Math.Clamp(this.cursorX + dx * CONFIG.placement.cellSize, 0, CONFIG.screen.width),
      Phaser.Math.Clamp(this.cursorY + dy * CONFIG.placement.cellSize, 0, CONFIG.screen.height),
    )
  }

  confirmPlacementAtCursor(): boolean {
    return this.placePendingAt(this.cursorX, this.cursorY)
  }

  focusShopCard(index: number): void {
    this.shopCards.forEach((card, cardIndex) => card.setKeyboardFocus(cardIndex === index))
  }

  selectTower(id: string): boolean {
    if (!this.options.canInteract()) return false
    const tower = this.towers.find((candidate) => candidate.id === id)
    if (!tower) return false
    this.selectedTowerId = id
    this.towers.forEach((candidate) => candidate.view.setSelected(candidate.id === id))
    this.options.onTowerSelected?.(id)
    return true
  }

  upgradeSelectedTower(): boolean {
    if (!this.options.canInteract()) return this.reject('Cannot upgrade right now.')
    const tower = this.towers.find((item) => item.id === this.selectedTowerId)
    const outcome = resolveTowerUpgradeRequest(tower ? this.toUpgradeStats(tower) : null, this.options.getCurrentCoins())
    if (outcome.type === 'no-selection') return this.reject('Select a defense first to upgrade it.')
    if (outcome.type === 'insufficient-funds') return this.reject(`Need ${outcome.needed} ryo to upgrade.`)
    if (outcome.type === 'max-level') return this.reject('This defense is already at MAX LEVEL.')
    if (!this.options.spendCoins(outcome.cost)) return this.reject('Could not upgrade now. Try again.')
    Object.assign(tower!, outcome.next)
    tower!.investedCost += outcome.cost
    tower!.view.setLevel(tower!.level)
    tower!.view.setRange(tower!.range)
    tower!.view.setSelected(true)
    this.options.onStatusUpdate(`${TOWERS[tower!.type].name} upgraded to level ${tower!.level}.`)
    playBuildSfx()
    this.options.onTowerUpgraded?.()
    return true
  }

  cycleSelectedTowerTargetMode(step = 1): boolean {
    if (!this.options.canInteract()) return this.reject('Select a defense first to set its targeting.')
    const tower = this.towers.find((item) => item.id === this.selectedTowerId)
    if (!tower) return this.reject('Select a defense first to set its targeting.')
    tower.targetMode = cycleTargetMode(tower.targetMode, step)
    this.options.onStatusUpdate(`${TOWERS[tower.type].name} now targets ${TARGET_MODE_LABELS[tower.targetMode]}.`)
    playClickSfx()
    return true
  }

  sellSelectedTower(): boolean {
    if (!this.options.canInteract()) return this.reject('Cannot sell now.')
    const tower = this.towers.find((item) => item.id === this.selectedTowerId)
    if (!tower) return this.reject('Select a defense first to sell it.')
    const refund = refundForTower(tower, CONFIG.run.refundRatio)
    this.towers.splice(this.towers.indexOf(tower), 1)
    tower.view.destroy()
    this.selectedTowerId = undefined
    this.options.onTowerSold?.(refund)
    this.options.onStatusUpdate(`Sold ${TOWERS[tower.type].name} for ${refund} ryo. Grass square freed.`)
    return true
  }

  destroy(): void {
    this.scene.input.off('pointermove', this.handlePointerMove)
    this.scene.input.off('pointerup', this.handlePointerUp)
    this.scene.input.off('pointerupoutside', this.handlePointerUp)
    this.scene.input.off('gameout', this.handleGameOut)
    this.preview.destroy()
    this.towers.forEach((tower) => tower.view.destroy())
    this.towers.length = 0
  }

  private placeTower(definition: TowerDefinition, x: number, y: number): void {
    const view = new TowerView(this.scene, definition, x, y)
    const tower: TowerRuntime = { ...definition, id: `tower-${this.nextId++}`, x, y, level: 1, investedCost: definition.cost, nextShotAt: 0, targetMode: 'first', view }
    view.setRange(tower.range)
    this.towers.push(tower)
    this.selectTower(tower.id)
    view.container.setInteractive(new Phaser.Geom.Rectangle(-22, -26, 44, 52), Phaser.Geom.Rectangle.Contains)
    view.container.on('pointerdown', (pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation()
      this.suppressedPointerId = pointer.id
      this.selectTower(tower.id)
    })
    playBuildSfx()
    this.options.onTowerPlaced?.(definition.type, x, y)
  }

  private readonly handlePointerMove = (pointer: Phaser.Input.Pointer): void => {
    if (this.cardGesture?.pointerId === pointer.id) {
      const distance = Phaser.Math.Distance.Between(this.cardGesture.startX, this.cardGesture.startY, pointer.worldX, pointer.worldY)
      if (distance > CONFIG.placement.dragThresholdPx) this.cardGesture.dragging = true
      if (!this.cardGesture.dragging) return
    }
    if (this.pendingTowerType) this.previewPlacementAt(pointer.worldX, pointer.worldY)
  }

  private readonly handlePointerUp = (pointer: Phaser.Input.Pointer): void => {
    if (this.suppressedPointerId === pointer.id) {
      this.suppressedPointerId = undefined
      return
    }
    if (this.cardGesture?.pointerId === pointer.id) {
      const shouldPlace = this.cardGesture.dragging
      this.cardGesture = undefined
      if (shouldPlace) this.placePendingAt(pointer.worldX, pointer.worldY)
      return
    }
    if (this.pendingTowerType) this.placePendingAt(pointer.worldX, pointer.worldY)
  }

  private readonly handleGameOut = (): void => {
    if (!this.cardGesture?.dragging) return
    this.preview.hide()
  }

  private startCardGesture(type: TowerType, pointer: Phaser.Input.Pointer): void {
    if (!this.beginPlacement(type)) return
    playClickSfx()
    this.cardGesture = { type, pointerId: pointer.id, startX: pointer.worldX, startY: pointer.worldY, dragging: false }
  }

  private getAnchors(): PlacedTowerAnchor[] {
    return this.towers.map((tower) => ({
      id: tower.id,
      type: tower.type,
      x: tower.x,
      y: tower.y,
      column: Math.round((tower.x - 16) / CONFIG.placement.cellSize),
      row: Math.round((tower.y - 16) / CONFIG.placement.cellSize),
    }))
  }

  private createSelectedTowerSnapshot(tower: TowerRuntime, coins: number): TowerPlacementSelectedTower {
    const upgrade = createTowerUpgradePreview(this.toUpgradeStats(tower))
    const maxed = tower.level >= tower.maxLevel
    return {
      id: tower.id, name: TOWERS[tower.type].name, type: tower.type, level: tower.level,
      damage: tower.damage, range: tower.range, fireRateMs: tower.fireRateMs,
      upgradeCost: tower.upgradeCost, affordable: !maxed && coins >= tower.upgradeCost,
      upgrade, maxed, sellRefund: refundForTower(tower, CONFIG.run.refundRatio), sellEnabled: true,
      targetMode: tower.targetMode, targetModeLabel: TARGET_MODE_LABELS[tower.targetMode],
    }
  }

  private toUpgradeStats(tower: TowerRuntime): TowerUpgradeStats {
    return { level: tower.level, damage: tower.damage, range: tower.range, fireRateMs: tower.fireRateMs, upgradeCost: tower.upgradeCost, maxLevel: tower.maxLevel }
  }

  private spacingLabel(type: TowerType): string {
    return type === 'bomb' ? 'keep 2 empty squares' : 'keep 1 empty square'
  }

  private reject(message: string): false {
    this.options.onStatusUpdate(message)
    return false
  }
}
