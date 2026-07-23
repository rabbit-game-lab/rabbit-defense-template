import Phaser from 'phaser'
import { CONFIG } from '../game.config'
import { PATH, WAVES } from '../data/towerDefense'
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
  waveProgressSnapshot,
  type WaveProgressSnapshot,
} from './waves'
import { playDefeatSfx, playLeakSfx, playShotSfx } from './audioManager'
import type { TowerRuntime } from '../entities/TowerView'

interface CombatCallbacks {
  onCoinsGain: (amount: number) => void
  onLivesLose: (amount: number) => boolean
  onStatusUpdate: (status: string) => void
  onEnemyKilled?: () => void
  onEnemyLeaked?: () => void
}

export default class CombatSystem {
  private readonly scene: Phaser.Scene
  private readonly callbacks: CombatCallbacks
  private enemies: EnemyRuntime[] = []
  private projectiles: ProjectileRuntime[] = []
  private waveState = createWaveState(0)
  private nextId = 1

  constructor(scene: Phaser.Scene, callbacks: CombatCallbacks) {
    this.scene = scene
    this.callbacks = callbacks
    this.waveState = createWaveState(this.scene.time.now, CONFIG.waves.betweenWaveDelayMs, CONFIG.waves.firstWavePrepareDelayMs)
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
    return waveProgressSnapshot(this.waveState, this.scene.time.now, this.enemies.length)
  }

  prepareFirstWave(now: number): void {
    prepareFirstWaveForCombat(this.waveState, now)
  }

  update(delta: number, towers: readonly TowerRuntime[]): void {
    const now = this.scene.time.now
    this.spawnEnemies(now)
    if (!this.updateEnemies(delta, now)) return
    this.updateTowers(now, towers)
    this.updateProjectiles(delta, now)
  }

  destroy(): void {
    for (const enemy of this.enemies) enemy.view.destroy()
    for (const projectile of this.projectiles) projectile.sprite.destroy()
    this.enemies = []
    this.projectiles = []
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

      const target = chooseTowerTarget(tower, this.enemies)
      if (!target) continue

      tower.nextShotAt = now + tower.fireRateMs
      tower.view.pulse(this.scene)
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
      playShotSfx()
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

      if (distanceBetween(projectile.sprite, projectile.target) <= CONFIG.combat.projectileHitRadiusPx) {
        this.hitEnemy(projectile, now)
      }
    }
  }

  private hitEnemy(projectile: ProjectileRuntime, now: number): void {
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
    this.callbacks.onStatusUpdate(`${enemy.name} reached the keep!`)
    const canContinue = this.callbacks.onLivesLose(enemy.leakDamage)
    this.callbacks.onEnemyLeaked?.()
    playLeakSfx()
    return canContinue
  }

  private killEnemy(enemy: EnemyRuntime): void {
    if (!this.enemies.includes(enemy)) return

    this.enemies = this.enemies.filter((item) => item !== enemy)
    enemy.view.destroy()
    this.callbacks.onStatusUpdate(`${enemy.name} defeated +${enemy.reward} coins.`)
    this.callbacks.onCoinsGain(enemy.reward)
    this.callbacks.onEnemyKilled?.()
    playDefeatSfx()
  }

  private removeProjectile(projectile: ProjectileRuntime): void {
    projectile.sprite.destroy()
    this.projectiles = this.projectiles.filter((item) => item !== projectile)
  }
}
