import Phaser from 'phaser'
import { CONFIG } from '../game.config'
import {
  applyObjectiveAutoAdvance,
  applyOnboardingEvent,
  applyOnboardingPlayerAction,
  createOnboardingState,
  getOnboardingInstruction,
  type OnboardingStep,
  type OnboardingTransition,
  type OnboardingState,
} from '../systems/onboardingRules'
import { finishRun, createRunState, isRunActive, type RunState } from '../systems/runState'
import { createBattleBackground, createHeader, drawPath } from '../systems/gameBoard'
import { playFanfareSfx } from '../systems/audioManager'
import TowerPlacementSystem, { type TowerPlacementSnapshot } from '../systems/TowerPlacementSystem'
import CombatSystem from '../systems/CombatSystem'
import type { WaveProgressSnapshot } from '../systems/waves'

export interface HudState {
  coins: number
  lives: number
  wave: number
  totalWaves: number
  wavePhase: WaveProgressSnapshot['phase']
  enemiesToSpawn: number
  activeEnemies: number
  nextWaveInMs: number
  selectedTower: TowerPlacementSnapshot['selectedTower']
  status: string
  onboardingStep: OnboardingStep
  onboardingInstruction: string
}

export default class GameScene extends Phaser.Scene {
  private static onboardingCompletedInSession = false

  private coins: number = CONFIG.run.startingCoins
  private lives: number = CONFIG.run.startingLives
  private status = 'Drag a tower from the shop to a build circle.'
  private runState: RunState = createRunState()
  private placement!: TowerPlacementSystem
  private combat!: CombatSystem
  private onboardingState: OnboardingState = createOnboardingState(0, CONFIG.ui.onboarding, GameScene.onboardingCompletedInSession)
  private hasPlacedFirstTower = false

  constructor() {
    super('GameScene')
  }

  create(): void {
    this.runState = createRunState(this.time.now)
    this.hasPlacedFirstTower = false
    this.onboardingState = createOnboardingState(this.time.now, CONFIG.ui.onboarding, GameScene.onboardingCompletedInSession)

    this.coins = CONFIG.run.startingCoins
    this.lives = CONFIG.run.startingLives
    this.status = 'Drag a tower from the shop to a build circle.'

    this.cameras.main.setBackgroundColor(CONFIG.world.backgroundColor)
    createBattleBackground(this)
    drawPath(this)
    createHeader(this)

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

    this.placement = new TowerPlacementSystem(this, {
      canInteract: () => isRunActive(this.runState),
      getCurrentCoins: () => this.coins,
      spendCoins: (amount: number): boolean => {
        if (this.coins < amount) return false
        this.coins -= amount
        return true
      },
      onStatusUpdate: (status) => {
        this.status = status
      },
      onTowerPlaced: () => {
        this.handleOnboardingEvent('tower-placed')
        if (!this.hasPlacedFirstTower) {
          this.hasPlacedFirstTower = true
          this.combat.prepareFirstWave(this.time.now)
        }
      },
      onTowerUpgraded: () => {
        this.handleOnboardingEvent('tower-upgraded')
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

    this.onboardingState = this.applyOnboardingTransition(applyObjectiveAutoAdvance(this.onboardingState, this.time.now))

    this.combat.update(delta, this.placement.getTowers())
    this.checkWinState()
  }

  getHudState(): HudState {
    const waveProgress = this.combat.getWaveProgress()
    const stepInstruction = getOnboardingInstruction(this.onboardingState.step)

    return {
      coins: this.coins,
      lives: this.lives,
      wave: waveProgress.wave,
      totalWaves: waveProgress.totalWaves,
      wavePhase: waveProgress.phase,
      enemiesToSpawn: waveProgress.toSpawnInCurrentWave,
      activeEnemies: this.combat.activeEnemyCount,
      nextWaveInMs: waveProgress.nextEventMs,
      selectedTower: this.placement.getSnapshot(this.coins).selectedTower,
      status: this.status,
      onboardingStep: this.onboardingState.step,
      onboardingInstruction: stepInstruction,
    }
  }

  upgradeSelectedTower(): boolean {
    return this.placement.upgradeSelectedTower()
  }

  skipOnboarding(): void {
    this.onboardingState = this.applyOnboardingTransition(
      applyOnboardingEvent(this.onboardingState, 'skip', this.time.now),
    )
  }

  private applyOnboardingTransition(transition: OnboardingTransition): OnboardingState {
    if (!transition.didTransition) return transition.state
    if (transition.state.step === 'complete') GameScene.onboardingCompletedInSession = true
    return transition.state
  }

  private handleOnboardingEvent(event: Parameters<typeof applyOnboardingEvent>[1]): void {
    if (event === 'tower-placed' || event === 'tower-upgraded') {
      this.onboardingState = this.applyOnboardingTransition(
        applyOnboardingPlayerAction(this.onboardingState, event, this.time.now),
      )
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
