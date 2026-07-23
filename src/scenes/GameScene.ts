import Phaser from 'phaser'
import { CONFIG } from '../game.config'
import { finishRun, createRunState, isRunActive, type RunState } from '../systems/runState'
import { createBattleBackground, createHeader, drawPath } from '../systems/gameBoard'
import { playFanfareSfx } from '../systems/audioManager'
import TowerPlacementSystem from '../systems/TowerPlacementSystem'
import CombatSystem from '../systems/CombatSystem'

export interface HudState {
  coins: number
  lives: number
  wave: number
  totalWaves: number
  selectedTower: string
  status: string
}

export default class GameScene extends Phaser.Scene {
  private coins: number = CONFIG.run.startingCoins
  private lives: number = CONFIG.run.startingLives
  private status = 'Drag a tower from the shop to a build circle.'
  private runState: RunState = createRunState()

  private placement!: TowerPlacementSystem
  private combat!: CombatSystem

  constructor() {
    super('GameScene')
  }

  create(): void {
    this.runState = createRunState(this.time.now)
    this.coins = CONFIG.run.startingCoins
    this.lives = CONFIG.run.startingLives
    this.status = 'Drag a tower from the shop to a build circle.'

    this.cameras.main.setBackgroundColor(CONFIG.world.backgroundColor)
    createBattleBackground(this)
    drawPath(this)
    createHeader(this)

    this.placement = new TowerPlacementSystem(this, {
      canInteract: () => isRunActive(this.runState),
      spendCoins: (amount: number): boolean => {
        if (this.coins < amount) return false
        this.coins -= amount
        return true
      },
      onStatusUpdate: (status) => {
        this.status = status
      },
    })

    this.combat = new CombatSystem(this, {
      onCoinsGain: (amount: number) => {
        this.coins += amount
      },
      onLivesLose: (amount: number) => {
        this.lives = Math.max(0, this.lives - amount)
        if (this.lives === 0) this.finishRun(false)
        return this.lives > 0
      },
      onStatusUpdate: (status) => {
        this.status = status
      },
    })

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.placement.destroy()
      this.combat.destroy()
    })
    this.scene.launch('UIScene')
  }

  update(_time: number, delta: number): void {
    if (!isRunActive(this.runState)) return

    this.combat.update(delta, this.placement.getTowers())
    this.checkWinState()
  }

  getHudState(): HudState {
    return {
      coins: this.coins,
      lives: this.lives,
      wave: this.combat.currentWave,
      totalWaves: this.combat.totalWaves,
      selectedTower: this.placement.getSnapshot().selectedTowerText,
      status: this.status,
    }
  }

  private checkWinState(): void {
    if (this.combat.isWaveRunComplete && this.combat.activeEnemyCount === 0) this.finishRun(true)
  }

  private finishRun(didWin: boolean): void {
    const { state, didTransition } = finishRun(this.runState, didWin ? 'victory' : 'defeat', this.time.now)
    this.runState = state
    if (!didTransition) return

    this.placement.destroy()

    const statusText = didWin ? 'Victory!' : 'Defeat!'
    this.status = didWin ? 'Victory! The rabbit keep is safe.' : 'Defeat! The monsters overran the keep.'

    this.add.rectangle(400, 240, 430, 130, 0x101610, 0.9).setStrokeStyle(2, CONFIG.world.accentColor)
    this.add
      .text(400, 214, statusText, { fontSize: '34px', color: CONFIG.ui.textColor, fontStyle: 'bold' })
      .setOrigin(0.5)
    this.add
      .text(400, 258, 'Tap to restart Rabbit Defense', { fontSize: '16px', color: '#c8d8b6' })
      .setOrigin(0.5)

    this.input.once('pointerdown', () => this.scene.restart())

    if (didWin) playFanfareSfx()
  }
}
