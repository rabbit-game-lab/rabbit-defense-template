import Phaser from 'phaser'
import { SHOP_TOWER_ORDER, type TowerType } from '../data/towerDefense'
import type { HudState } from '../scenes/GameScene'
import {
  cycleFocusInRegion,
  cycleFocusTarget,
  reconcileFocusTarget,
  type GameplayFocusRegion,
  type GameplayFocusTarget,
} from '../systems/focusNavigationRules'
import type { SceneButtonHandle } from './createSceneButton'

/** The gameplay methods this controller drives on GameScene. */
export interface GameSceneBridge {
  getHudState(): HudState
  upgradeSelectedTower(): boolean
  sellSelectedTower(): boolean
  cycleSelectedTowerTargetMode(step?: number): boolean
  toggleGameSpeed(): number
  skipOnboarding(): void
  setUiBlocked(blocked: boolean): void
  beginPlacement(type: TowerType): boolean
  cancelPlacement(): boolean
  movePlacementCursor(dx: number, dy: number): unknown
  confirmPlacementAtCursor(): boolean
  selectTower(towerId: string): boolean
  focusShopCard(index: number): void
}

export interface GameplayFocusDeps {
  getGameScene(): (Phaser.Scene & GameSceneBridge) | null
  /** True while a pause/result/orientation modal owns input. */
  isModalOpen(): boolean
  /** Forward a key to the modal that currently owns input. */
  forwardToModal(event: KeyboardEvent): void
  /** Two-step sell confirmation lives in UIScene because rendering reads it too. */
  requestSell(): void
  /** Clears a pending sell confirmation; true when it consumed the Escape. */
  clearSellConfirmation(): boolean
  buttons(): {
    upgrade?: SceneButtonHandle
    sell?: SceneButtonHandle
    target?: SceneButtonHandle
    pause?: SceneButtonHandle
  }
}

const ACTION_COUNT = 3

/**
 * Owns keyboard focus for gameplay: which region is active, the index within it,
 * and the key routing that moves between them. Extracted from UIScene so the
 * scene renders and this decides where input goes.
 */
export class GameplayFocusController {
  private readonly deps: GameplayFocusDeps
  private shopIndex = 0
  private towerIndex = 0
  private actionIndex = 0
  private region: GameplayFocusRegion = 'shop'
  private regionBeforeModal: GameplayFocusRegion = 'shop'
  private hintsVisible = false

  constructor(deps: GameplayFocusDeps) {
    this.deps = deps
  }

  get activeRegion(): GameplayFocusRegion {
    return this.region
  }

  get keyboardHintsVisible(): boolean {
    return this.hintsVisible
  }

  /**
   * Focusable targets in Tab order. Regions with nothing in them are simply absent,
   * which is what keeps empty regions out of the Tab cycle.
   */
  private buildTargets(hud: HudState): GameplayFocusTarget[] {
    const targets: GameplayFocusTarget[] = SHOP_TOWER_ORDER.map((_, index) => ({
      id: `shop:${index}`,
      region: 'shop' as const,
      enabled: true,
    }))
    targets.push({ id: 'terrain', region: 'terrain', enabled: true })
    hud.placement.towerIds.forEach((_, index) => {
      targets.push({ id: `tower:${index}`, region: 'towers', enabled: true })
    })
    if (hud.selectedTower) {
      for (let index = 0; index < ACTION_COUNT; index += 1) {
        targets.push({ id: `action:${index}`, region: 'actions', enabled: true })
      }
    }
    targets.push({ id: 'pause', region: 'pause', enabled: true })
    return targets
  }

  private currentId(): string {
    if (this.region === 'shop') return `shop:${this.shopIndex}`
    if (this.region === 'towers') return `tower:${this.towerIndex}`
    if (this.region === 'actions') return `action:${this.actionIndex}`
    return this.region
  }

  /** Applies a resolved target back onto region + per-region index. */
  private adopt(target: GameplayFocusTarget | null): void {
    if (!target) return
    this.region = target.region
    const [, rawIndex] = target.id.split(':')
    const index = Number(rawIndex)
    if (target.region === 'shop') this.shopIndex = index
    else if (target.region === 'towers') this.towerIndex = index
    else if (target.region === 'actions') this.actionIndex = index
  }

  readonly handleKey = (event: KeyboardEvent): void => {
    this.hintsVisible = true
    if (this.deps.isModalOpen()) {
      this.deps.forwardToModal(event)
      return
    }
    const game = this.deps.getGameScene()
    if (!game) return
    const hud = game.getHudState()
    const key = event.key
    const lower = key.toLowerCase()

    if (key === 'Escape') {
      if (this.deps.clearSellConfirmation()) return
      if (game.cancelPlacement()) return
      this.deps.forwardToModal(event)
      return
    }
    if (lower === 'p' || lower === 'm') {
      this.deps.forwardToModal(event)
      return
    }
    if (/^[123]$/.test(key)) {
      this.selectShop(Number(key) - 1, game)
      return
    }
    if (key === '[' || key === ']') {
      const step = key === '[' ? -1 : 1
      this.selectShop((this.shopIndex + step + SHOP_TOWER_ORDER.length) % SHOP_TOWER_ORDER.length, game)
      return
    }
    if (key === 'Tab') {
      event.preventDefault()
      this.cycleRegion(event.shiftKey ? -1 : 1, hud)
      return
    }
    if (key.startsWith('Arrow')) {
      event.preventDefault()
      this.handleArrow(key, hud, game)
      return
    }
    if (lower === 'u') { game.upgradeSelectedTower(); return }
    if (lower === 's') { this.deps.requestSell(); return }
    if (lower === 't') { game.cycleSelectedTowerTargetMode(); return }
    if (lower === 'f') { game.toggleGameSpeed(); return }
    if (key !== 'Enter' && key !== ' ') return

    if (this.region === 'shop') game.beginPlacement(SHOP_TOWER_ORDER[this.shopIndex])
    else if (this.region === 'terrain') game.confirmPlacementAtCursor()
    else if (this.region === 'towers') game.selectTower(hud.placement.towerIds[this.towerIndex] ?? '')
    else if (this.region === 'actions') this.activateFocusedAction(game)
  }

  private selectShop(index: number, game: Phaser.Scene & GameSceneBridge): void {
    this.shopIndex = index
    this.region = 'shop'
    game.beginPlacement(SHOP_TOWER_ORDER[this.shopIndex])
    this.applyFocus()
  }

  private activateFocusedAction(game: Phaser.Scene & GameSceneBridge): void {
    if (this.actionIndex === 0) game.upgradeSelectedTower()
    else if (this.actionIndex === 1) this.deps.requestSell()
    else game.cycleSelectedTowerTargetMode()
  }

  private handleArrow(key: string, hud: HudState, game: Phaser.Scene & GameSceneBridge): void {
    if (this.region === 'terrain') {
      game.movePlacementCursor(
        key === 'ArrowLeft' ? -1 : key === 'ArrowRight' ? 1 : 0,
        key === 'ArrowUp' ? -1 : key === 'ArrowDown' ? 1 : 0,
      )
      return
    }
    const step = key === 'ArrowLeft' || key === 'ArrowUp' ? -1 : 1
    this.adopt(cycleFocusInRegion(this.buildTargets(hud), this.region, this.currentId(), step))
    if (this.region === 'towers') game.selectTower(hud.placement.towerIds[this.towerIndex] ?? '')
    this.applyFocus()
  }

  private cycleRegion(step: 1 | -1, hud: HudState): void {
    const targets = this.buildTargets(hud)
    // Step to the first target of the next region rather than the next target,
    // so Tab moves between regions and arrows move within one.
    const regions: GameplayFocusRegion[] = []
    for (const target of targets) {
      if (!regions.includes(target.region)) regions.push(target.region)
    }
    const regionTargets: GameplayFocusTarget[] = regions.map((region) => ({
      id: region,
      region,
      enabled: true,
    }))
    const next = cycleFocusTarget(regionTargets, this.region, step)
    if (!next) return
    this.region = next.region
    if (this.region === 'towers') {
      this.deps.getGameScene()?.selectTower(hud.placement.towerIds[this.towerIndex] ?? '')
    }
    this.applyFocus()
  }

  /** Drops focus out of a region that no longer exists (last tower sold, etc.). */
  reconcile(hud: HudState): void {
    this.towerIndex = Math.min(this.towerIndex, Math.max(0, hud.placement.towerIds.length - 1))
    const targets = this.buildTargets(hud)
    const stillPresent = targets.some((target) => target.region === this.region)
    if (stillPresent) return
    const fallbackRegion: GameplayFocusRegion = hud.placement.pendingTowerType ? 'terrain' : 'shop'
    this.adopt(reconcileFocusTarget(targets, null, fallbackRegion))
    this.applyFocus()
  }

  applyFocus(): void {
    const { upgrade, sell, target, pause } = this.deps.buttons()
    this.deps.getGameScene()?.focusShopCard(this.region === 'shop' ? this.shopIndex : -1)
    upgrade?.setKeyboardFocus(this.region === 'actions' && this.actionIndex === 0)
    sell?.setKeyboardFocus(this.region === 'actions' && this.actionIndex === 1)
    target?.setKeyboardFocus(this.region === 'actions' && this.actionIndex === 2)
    pause?.setKeyboardFocus(this.region === 'pause')
  }

  readonly handlePointerInput = (): void => {
    this.hintsVisible = false
    this.applyFocus()
  }

  rememberRegionBeforeModal(): void {
    this.regionBeforeModal = this.region
  }

  restoreRegionAfterModal(): void {
    this.region = this.regionBeforeModal
    this.applyFocus()
  }
}
