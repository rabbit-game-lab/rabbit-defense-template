import Phaser from 'phaser'
import { CONFIG } from '../game.config'
import {
  applyObjectiveAutoAdvance,
  applyOnboardingEvent,
  applyOnboardingPlayerAction,
  createOnboardingState,
  getOnboardingInstruction,
  type OnboardingStep,
  type OnboardingState,
  type OnboardingTransition,
} from '../systems/onboardingRules'
import { createRunState, finishRun, isRunActive, type RunState } from '../systems/runState'
import {
  buildRunResult,
  createRunResultTracker,
  recordKill,
  recordLeak,
  type RunResultSnapshot,
  type RunResultTracker,
} from '../systems/runResultRules'
import { createBattleBackground, createHeader, drawPath } from '../systems/gameBoard'
import { playFanfareSfx } from '../systems/audioManager'
import { createEmptyProfile, applyRunResultToProfile, type ProfileRecord } from '../systems/profilePersistenceRules'
import { loadProfile, markOnboardingComplete, updateProfile } from '../systems/profileStore'
import TowerPlacementSystem, { type TowerPlacementSnapshot } from '../systems/TowerPlacementSystem'
import CombatSystem from '../systems/CombatSystem'
import {
  createTimedHudMessage,
  formatWaveHud,
  getRunFallbackStatus,
  resolveHudStatus,
  type TimedHudMessage,
} from '../systems/hudRules'
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
  waveLabel: string
  result: RunResultSnapshot | null
  profile: ProfileRecord
}

export default class GameScene extends Phaser.Scene {
  private static onboardingCompletedInSession = false
  private static nextRunId = 0

  private coins = CONFIG.run.startingCoins
  private lives: number = CONFIG.run.startingLives
  private placementMessage: TimedHudMessage | undefined
  private combatMessage: TimedHudMessage | undefined
  private runState: RunState = createRunState()
  private placement!: TowerPlacementSystem
  private combat!: CombatSystem
  private onboardingState: OnboardingState = createOnboardingState(0, CONFIG.ui.onboarding, GameScene.onboardingCompletedInSession)
  private hasPlacedFirstTower = false
  private runResultTracker: RunResultTracker = createRunResultTracker(0)
  private result: RunResultSnapshot | null = null
  private profile: ProfileRecord = createEmptyProfile()
  private profileLoadEpoch = 0
  private persistedOnboarding = false
  private hasPlayedFanfare = false

  constructor() {
    super('GameScene')
  }

  create(): void {
    this.game.canvas.dataset.scene = 'game'
    delete this.game.canvas.dataset.overlay
    const sessionId = ++GameScene.nextRunId

    this.runState = createRunState(this.time.now)
    this.hasPlacedFirstTower = false
    this.onboardingState = createOnboardingState(this.time.now, CONFIG.ui.onboarding, GameScene.onboardingCompletedInSession)
    this.combatMessage = undefined
    this.placementMessage = undefined
    this.coins = CONFIG.run.startingCoins
    this.lives = CONFIG.run.startingLives
    this.result = null
    this.hasPlayedFanfare = false
    this.runResultTracker = createRunResultTracker(this.time.now)
    this.profileLoadEpoch = sessionId

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
        this.combatMessage = createTimedHudMessage(status, this.time.now, CONFIG.ui.status.combatMessageMs)
      },
      onEnemyLeaked: () => {
        this.runResultTracker = recordLeak(this.runResultTracker)
      },
      onEnemyKilled: () => {
        this.runResultTracker = recordKill(this.runResultTracker)
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
        this.placementMessage = createTimedHudMessage(status, this.time.now, CONFIG.ui.status.placementMessageMs)
        if (!status.trim()) {
          this.placementMessage = undefined
        }
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
      onTowerSold: (amount) => {
        this.coins += amount
      },
    })

    this.bootstrapProfile(sessionId)

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.placement.destroy()
      this.combat.destroy()
    })
    this.scene.launch('UIScene')
  }

  private bootstrapProfile(sessionId: number): void {
    void (async () => {
      const loaded = await loadProfile()
      if (sessionId !== this.profileLoadEpoch) return

      this.profile = loaded
      if (this.profile.onboardingCompleted) {
        GameScene.onboardingCompletedInSession = true
        this.onboardingState = createOnboardingState(this.time.now, CONFIG.ui.onboarding, true)
      }
    })()
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
      status: resolveHudStatus(
        this.time.now,
        this.placementMessage,
        this.combatMessage,
        getRunFallbackStatus(this.hasPlacedFirstTower),
      ),
      waveLabel: formatWaveHud(waveProgress, this.combat.activeEnemyCount),
      onboardingStep: this.onboardingState.step,
      onboardingInstruction: stepInstruction,
      result: this.result,
      profile: this.profile,
    }
  }

  upgradeSelectedTower(): boolean {
    return this.placement.upgradeSelectedTower()
  }

  sellSelectedTower(): boolean {
    return this.placement.sellSelectedTower()
  }

  skipOnboarding(): void {
    this.onboardingState = this.applyOnboardingTransition(
      applyOnboardingEvent(this.onboardingState, 'skip', this.time.now),
    )
  }

  private applyOnboardingTransition(transition: OnboardingTransition): OnboardingState {
    if (!transition.didTransition) return transition.state

    if (transition.state.step === 'complete') {
      GameScene.onboardingCompletedInSession = true
      this.persistOnboardingComplete()
    }

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
    if (this.combat.isWaveRunComplete && this.combat.activeEnemyCount === 0) {
      this.finishRun(true)
    }
  }

  private finishRun(didWin: boolean): void {
    const { state, didTransition } = finishRun(this.runState, didWin ? 'victory' : 'defeat', this.time.now)
    this.runState = state
    if (!didTransition) return

    this.profileLoadEpoch += 1

    this.result = buildRunResult(
      this.runResultTracker,
      this.time.now,
      didWin ? 'victory' : 'defeat',
      this.combat.getWaveProgress(),
      this.lives,
      this.coins,
    )

    this.persistRunResult()

    this.placement.destroy()
    this.placementMessage = undefined
    this.combatMessage = undefined

    if (didWin && !this.hasPlayedFanfare) {
      playFanfareSfx()
      this.hasPlayedFanfare = true
    }
  }

  private async persistOnboardingComplete(): Promise<void> {
    if (this.persistedOnboarding) return
    this.persistedOnboarding = true
    this.profile = await markOnboardingComplete()
  }

  private async persistRunResult(): Promise<void> {
    if (!this.result) return
    try {
      const persisted = await updateProfile((previous: ProfileRecord) => {
        return applyRunResultToProfile(previous, this.result!)
      })
      this.profile = persisted
    } catch {
      // Non-blocking: gameplay should continue even if storage is unavailable.
    }
  }
}
