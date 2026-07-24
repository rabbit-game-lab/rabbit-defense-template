import Phaser from 'phaser'
import { CONFIG } from '../game.config'
import { ENEMIES, PATH, WAVES } from '../data/towerDefense'
import { EnemyView, type EnemyRuntime } from '../entities/EnemyView'
import { createProjectile, type ProjectileRuntime } from '../entities/ProjectileView'
import { chooseTowerTarget, damageEnemy, advanceEnemyAlongPath, distanceBetween } from './towerDefenseRules'
import {
  createWaveState,
  isFinalWaveComplete,
  makeEnemyStats,
  markEnemySpawned,
  nextEnemyToSpawn,
  prepareFirstWaveForCombat,
  summarizeWaveEnemies,
  waveProgressSnapshot,
  type WaveEnemyGroup,
  type WaveProgressSnapshot,
} from './waves'
import type { EnemyType } from '../data/towerDefense'
import { playBossArrivalSfx, playDefeatSfx, playLeakSfx, playShotSfx } from './audioManager'
import type { TowerRuntime } from '../entities/TowerView'
import type { FeedbackLane } from './hudRules'
import { EffectsSystem } from './EffectsSystem'

interface CombatCallbacks {
  onCoinsGain: (amount: number) => void
  onLivesLose: (amount: number) => boolean
  onStatusUpdate: (status: string, lane: FeedbackLane) => void
  onEnemyKilled?: () => void
  onEnemyLeaked?: () => void
  onWaveCleared?: (waveNumber: number) => void
}

export default class CombatSystem {
  readonly effects: EffectsSystem
  private readonly scene: Phaser.Scene
  private readonly callbacks: CombatCallbacks
  private enemies: EnemyRuntime[] = []
  private projectiles: ProjectileRuntime[] = []
  private waveState = createWaveState(0)
  private nextId = 1
  private clearedWaveCount = 0
  /**
   * Game-time clock in ms. Advanced by scaled delta each frame so a speed
   * multiplier accelerates spawns, fire rate, and movement together. All combat
   * scheduling reads this instead of scene.time.now, which the speed toggle
   * cannot bend.
   */
  private clock = 0

  constructor(scene: Phaser.Scene, callbacks: CombatCallbacks) {
    this.scene = scene
    this.callbacks = callbacks
    this.effects = new EffectsSystem(scene)
    this.clock = this.scene.time.now
    this.waveState = createWaveState(this.clock, CONFIG.waves.betweenWaveDelayMs, CONFIG.waves.firstWavePrepareDelayMs)
  }

  get currentWave(): number {
    return Math.min(this.waveState.waveIndex + 1, this.totalWaves)
  }

  get totalWaves(): number {
    return WAVES.length
  }

  get isWaveRunComplete(): boolean {
    return isFinalWaveComplete(this.waveState)
  }

  get activeEnemyCount(): number {
    return this.enemies.length
  }

  getWaveProgress(): WaveProgressSnapshot {
    return waveProgressSnapshot(this.waveState, this.clock, this.enemies.length)
  }

  /** Enemy composition of the raid the player is about to face, or [] mid-combat. */
  getUpcomingWavePreview(): WaveEnemyGroup<EnemyType>[] {
    const progress = this.getWaveProgress()
    if (progress.phase !== 'preparing' && progress.phase !== 'between') return []
    return summarizeWaveEnemies(progress.wave - 1)
  }

  prepareFirstWave(): void {
    prepareFirstWaveForCombat(this.waveState, this.clock)
  }

  update(delta: number, towers: readonly TowerRuntime[], speed = 1): void {
    this.effects.update()
    const scaledDelta = delta * speed
    this.clock += scaledDelta
    const now = this.clock
    this.spawnEnemies(now)
    if (!this.updateEnemies(scaledDelta, now)) return
    this.updateTowers(now, towers)
    this.updateProjectiles(scaledDelta, now)
    this.settleClearedWaves()
  }

  /**
   * Awards a bonus once each raid's spawns are exhausted and the field is clear.
   * `waveState.waveIndex` counts fully-spawned raids; comparing it against the
   * last settled count grants one bonus per newly cleared raid, even if several
   * resolve in the same frame.
   */
  private settleClearedWaves(): void {
    const spawnedWaves = this.waveState.waveIndex
    if (this.enemies.length !== 0 || spawnedWaves <= this.clearedWaveCount) return
    for (let wave = this.clearedWaveCount + 1; wave <= spawnedWaves; wave += 1) {
      this.callbacks.onWaveCleared?.(wave)
    }
    this.clearedWaveCount = spawnedWaves
  }

  destroy(): void {
    for (const enemy of this.enemies) enemy.view.destroy()
    for (const projectile of this.projectiles) projectile.sprite.destroy()
    this.enemies = []
    this.projectiles = []
    this.effects.destroy()
  }

  private spawnEnemies(now: number): void {
    const type = nextEnemyToSpawn(this.waveState, now)
    if (!type) return
    const stats = makeEnemyStats(type, this.waveState.waveIndex)
    const start = PATH[0]
    const view = new EnemyView(this.scene, stats, start.x, start.y)
    this.enemies.push({
      ...stats,
      id: `enemy-${this.nextId++}`,
      x: start.x,
      y: start.y,
      maxHp: stats.hp,
      slowResistance: stats.slowResistance,
      pathIndex: 0,
      progress: 0,
      slowFactor: 1,
      slowUntil: 0,
      escaped: false,
      view,
    })
    if (type === 'warden') {
      this.effects.showBossArrival(start.x, start.y)
      playBossArrivalSfx()
    }
    markEnemySpawned(this.waveState, now)
  }

  private updateEnemies(delta: number, now: number): boolean {
    for (const enemy of [...this.enemies]) {
      const speedScale = enemy.slowUntil > now ? enemy.slowFactor : 1
      const next = advanceEnemyAlongPath(enemy, PATH, enemy.speed * speedScale * (delta / 1000))
      Object.assign(enemy, next)
      enemy.view.setPosition(enemy.x, enemy.y)
      enemy.view.flashSlow(enemy.slowUntil > now)

      if (enemy.escaped && !this.leakEnemy(enemy)) return false
    }
    return true
  }

  private updateTowers(now: number, towers: readonly TowerRuntime[]): void {
    for (const tower of towers) {
      if (now < tower.nextShotAt) continue

      const target = chooseTowerTarget(tower, this.enemies, tower.targetMode)
      if (!target) continue

      tower.nextShotAt = now + tower.fireRateMs
      this.effects.pulseTower(tower.view)
      this.projectiles.push({
        sprite: createProjectile(this.scene, tower.x, tower.y - 8, tower.type),
        target,
        damage: tower.damage,
        speed: tower.projectileSpeed,
        type: tower.type,
        slowFactor: tower.slowFactor,
        slowMs: tower.slowMs,
        splashRadius: tower.splashRadius,
      })
      playShotSfx(tower.type)
    }
  }

  private updateProjectiles(delta: number, now: number): void {
    for (const projectile of [...this.projectiles]) {
      if (projectile.target.hp <= 0 || projectile.target.escaped) {
        this.removeProjectile(projectile)
        continue
      }

      const step = projectile.speed * (delta / 1000)
      const angle = Phaser.Math.Angle.Between(projectile.sprite.x, projectile.sprite.y, projectile.target.x, projectile.target.y)
      projectile.sprite.x += Math.cos(angle) * step
      projectile.sprite.y += Math.sin(angle) * step
      projectile.sprite.setRotation(angle)
      projectile.lastTrailAt = this.effects.sampleProjectile(
        projectile.sprite.x,
        projectile.sprite.y,
        projectile.type,
        now,
        projectile.lastTrailAt,
      )

      if (distanceBetween(projectile.sprite, projectile.target) <= CONFIG.combat.projectileHitRadiusPx) {
        this.hitEnemy(projectile, now)
      }
    }
  }

  private hitEnemy(projectile: ProjectileRuntime, now: number): void {
    this.effects.showImpact(projectile.target.x, projectile.target.y, projectile.type, projectile.splashRadius)
    const victims = projectile.splashRadius
      ? this.enemies.filter((enemy) => distanceBetween(enemy, projectile.target) <= projectile.splashRadius!)
      : [projectile.target]

    for (const enemy of victims) {
      const nextSlowUntil = projectile.slowMs ? now + projectile.slowMs : undefined
      const result = damageEnemy(
        {
          hp: enemy.hp,
          slowFactor: enemy.slowFactor,
          slowUntil: enemy.slowUntil,
          slowResistance: enemy.slowResistance,
        },
        projectile.damage,
        now,
        projectile.slowFactor,
        nextSlowUntil,
      )

      enemy.hp = result.hp
      enemy.slowFactor = result.slowFactor
      enemy.slowUntil = result.slowUntil
      enemy.view.setHp(enemy.hp, enemy.maxHp)
      if (result.killed) this.killEnemy(enemy)
    }

    this.removeProjectile(projectile)
  }

  private leakEnemy(enemy: EnemyRuntime): boolean {
    this.enemies = this.enemies.filter((item) => item !== enemy)
    enemy.view.destroy()
    this.callbacks.onStatusUpdate(`${enemy.name} breached Hidden Dojo!`, 'critical')
    this.callbacks.onEnemyLeaked?.()
    this.effects.punchLeak()
    const canContinue = this.callbacks.onLivesLose(enemy.leakDamage)
    playLeakSfx()
    return canContinue
  }

  private killEnemy(enemy: EnemyRuntime): void {
    if (!this.enemies.includes(enemy)) return

    this.enemies = this.enemies.filter((item) => item !== enemy)
    this.effects.showKill(enemy.x, enemy.y, ENEMIES[enemy.type].color)
    this.effects.showCoinPop(enemy.x, enemy.y, enemy.reward)
    enemy.view.destroy()
    this.callbacks.onStatusUpdate(`${enemy.name} defeated +${enemy.reward} ryo.`, 'ambient')
    this.callbacks.onCoinsGain(enemy.reward)
    this.callbacks.onEnemyKilled?.()
    playDefeatSfx()
  }

  private removeProjectile(projectile: ProjectileRuntime): void {
    projectile.sprite.destroy()
    this.projectiles = this.projectiles.filter((item) => item !== projectile)
  }
}
