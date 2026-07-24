import Phaser from 'phaser'
import type { TowerType } from '../data/towerDefense'
import type { TowerView } from '../entities/TowerView'
import { CONFIG } from '../game.config'
import { isReducedEffectsEnabled } from './accessibilitySettingsStore'

type RunOutcome = 'victory' | 'defeat'

const EFFECT_STYLE: Record<TowerType, { color: number; trailRadius: number }> = {
  arrow: { color: 0xf6d365, trailRadius: 2 },
  frost: { color: 0xa9e8ff, trailRadius: 3 },
  bomb: { color: 0xff7b3d, trailRadius: 4 },
}

/**
 * Owns short-lived battlefield presentation for one scene. Static warnings are
 * tracked separately so enabling Reduced Effects removes motion immediately
 * without hiding information.
 */
export class EffectsSystem {
  private readonly scene: Phaser.Scene
  private readonly motionObjects = new Set<Phaser.GameObjects.GameObject>()
  private readonly motionTweens = new Set<Phaser.Tweens.Tween>()
  private readonly trailMarks: Phaser.GameObjects.Arc[] = []
  private readonly pulsingTowers = new Set<TowerView>()
  private readonly staticObjects = new Set<Phaser.GameObjects.GameObject>()
  private reducedEffects = isReducedEffectsEnabled()
  private destroyed = false

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this)
    scene.events.once(Phaser.Scenes.Events.DESTROY, this.destroy, this)
  }

  /** Poll once per frame so an accessibility toggle takes effect immediately. */
  update(): void {
    const reduced = isReducedEffectsEnabled()
    if (reduced && !this.reducedEffects) this.clearMotion()
    this.reducedEffects = reduced
  }

  showPlacement(x: number, y: number, color = 0xf6d365): void {
    this.update()
    if (this.reducedEffects || this.destroyed) return

    const ring = this.trackMotion(
      this.scene.add.circle(x, y, 8, color, 0).setStrokeStyle(2, color, 0.95).setDepth(20),
    )
    this.tween({
      targets: ring,
      radius: CONFIG.placement.cellSize * 0.55,
      alpha: 0,
      duration: CONFIG.effects.placementRingMs,
      onComplete: () => this.removeMotion(ring),
    })

    const sparkCount = Math.min(6, CONFIG.effects.placementSparkCount)
    for (let index = 0; index < sparkCount; index += 1) {
      const angle = (Math.PI * 2 * index) / sparkCount
      const spark = this.trackMotion(this.scene.add.circle(x, y, 2, color, 0.9).setDepth(20))
      this.tween({
        targets: spark,
        x: x + Math.cos(angle) * 22,
        y: y + Math.sin(angle) * 22,
        alpha: 0,
        duration: CONFIG.effects.placementRingMs,
        onComplete: () => this.removeMotion(spark),
      })
    }
  }

  sampleProjectile(x: number, y: number, type: TowerType, now: number, lastSampleAt?: number): number {
    this.update()
    if (this.reducedEffects || this.destroyed) return now
    if (lastSampleAt !== undefined && now - lastSampleAt < CONFIG.effects.trailSampleMs) return lastSampleAt

    const style = EFFECT_STYLE[type]
    const mark = this.trackMotion(
      this.scene.add.circle(x, y, style.trailRadius, style.color, type === 'arrow' ? 0.6 : 0.75).setDepth(7),
    )
    this.trailMarks.push(mark)
    while (this.trailMarks.length > CONFIG.effects.maxTrails) {
      const oldest = this.trailMarks.shift()
      if (oldest) this.removeMotion(oldest)
    }
    this.tween({
      targets: mark,
      alpha: 0,
      scale: type === 'frost' ? 1.8 : 0.5,
      duration: CONFIG.effects.trailLifetimeMs,
      onComplete: () => {
        this.removeTrail(mark)
        this.removeMotion(mark)
      },
    })
    return now
  }

  showImpact(x: number, y: number, type: TowerType, splashRadius?: number): void {
    this.update()
    if (this.reducedEffects || this.destroyed) return

    const style = EFFECT_STYLE[type]
    const targetRadius = type === 'bomb' && splashRadius ? splashRadius : type === 'frost' ? 18 : 10
    const ring = this.trackMotion(
      this.scene.add.circle(x, y, 3, style.color, type === 'arrow' ? 0.35 : 0.14)
        .setStrokeStyle(type === 'bomb' ? 3 : 2, style.color, 0.9)
        .setDepth(18),
    )
    this.tween({
      targets: ring,
      radius: targetRadius,
      alpha: 0,
      duration: CONFIG.effects.impactRingMs,
      onComplete: () => this.removeMotion(ring),
    })
  }

  /** Death burst: a fading ring plus evenly-spaced sparks in the enemy tint. */
  showKill(x: number, y: number, color: number): void {
    this.update()
    if (this.reducedEffects || this.destroyed) return

    const ring = this.trackMotion(
      this.scene.add.circle(x, y, 4, color, 0.5).setStrokeStyle(2, color, 0.8).setDepth(19),
    )
    this.tween({
      targets: ring,
      radius: 17,
      alpha: 0,
      duration: CONFIG.effects.killBurstMs,
      onComplete: () => this.removeMotion(ring),
    })

    const sparks = CONFIG.effects.killSparkCount
    for (let index = 0; index < sparks; index += 1) {
      const angle = (Math.PI * 2 * index) / sparks
      const spark = this.trackMotion(this.scene.add.circle(x, y, 2, color, 0.95).setDepth(19))
      this.tween({
        targets: spark,
        x: x + Math.cos(angle) * 20,
        y: y + Math.sin(angle) * 20,
        alpha: 0,
        duration: CONFIG.effects.killBurstMs,
        onComplete: () => this.removeMotion(spark),
      })
    }
  }

  /** Floating "+ryo" that rises from the defeated enemy and fades out. */
  showCoinPop(x: number, y: number, amount: number): void {
    this.update()
    if (this.reducedEffects || this.destroyed) return

    const text = this.trackMotion(
      this.scene.add.text(x, y - 8, `+${amount}`, {
        color: '#ffe08a',
        fontFamily: 'monospace',
        fontSize: '11px',
        fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(30),
    )
    this.tween({
      targets: text,
      y: y - 8 - CONFIG.effects.coinPopRisePx,
      alpha: 0,
      duration: CONFIG.effects.coinPopMs,
      onComplete: () => this.removeMotion(text),
    })
  }

  /** Small camera jolt when a raider breaches the dojo. */
  punchLeak(): void {
    this.update()
    if (this.reducedEffects || this.destroyed) return
    this.scene.cameras.main.shake(CONFIG.effects.leakShakeMs, CONFIG.effects.leakShakeIntensity)
  }

  pulseTower(tower: TowerView): void {
    this.update()
    if (this.reducedEffects || this.destroyed) {
      tower.cancelPulse()
      return
    }
    this.pulsingTowers.add(tower)
    tower.pulse(this.scene, CONFIG.effects.towerPulseMs)
    this.scene.time.delayedCall(CONFIG.effects.towerPulseMs * 2 + 10, () => this.pulsingTowers.delete(tower))
  }

  showBossArrival(x: number, y: number): void {
    this.update()
    if (this.destroyed) return

    const warning = this.trackStatic(
      this.scene.add.text(CONFIG.screen.width / 2, 48, '⚠ SHOGUN APPROACHES ⚠', {
        color: '#ffcf8b',
        fontFamily: 'monospace',
        fontSize: '14px',
        fontStyle: 'bold',
        backgroundColor: '#3a1608',
        padding: { x: 8, y: 4 },
      }).setOrigin(0.5).setDepth(80),
    )
    this.scene.time.delayedCall(1800, () => this.removeStatic(warning))
    if (this.reducedEffects) return

    this.scene.cameras.main.shake(CONFIG.effects.bossShakeMs, CONFIG.effects.bossShakeIntensity)
    const halo = this.trackMotion(
      this.scene.add.circle(x, y, 22, 0xf4cf6e, 0.12).setStrokeStyle(3, 0xf4cf6e, 0.85).setDepth(6),
    )
    this.tween({
      targets: halo,
      radius: 54,
      alpha: 0,
      duration: CONFIG.effects.bossHaloMs,
      onComplete: () => this.removeMotion(halo),
    })
  }

  showResult(outcome: RunOutcome): void {
    this.update()
    if (this.destroyed) return

    const victory = outcome === 'victory'
    const label = this.trackStatic(
      this.scene.add.text(CONFIG.screen.width / 2, CONFIG.screen.height / 2 - 72, victory ? 'DOJO SECURED' : 'DOJO FALLEN', {
        color: victory ? '#d8f5a2' : '#ffaaa0',
        fontFamily: 'monospace',
        fontSize: '18px',
        fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(70),
    )
    this.scene.time.delayedCall(1600, () => this.removeStatic(label))
    if (this.reducedEffects) return

    const color = victory ? 0x9bd46a : 0x9d2f2f
    const frame = this.trackMotion(
      this.scene.add.rectangle(CONFIG.screen.width / 2, CONFIG.screen.height / 2, CONFIG.screen.width - 12, CONFIG.screen.height - 12, color, 0)
        .setStrokeStyle(victory ? 3 : 5, color, 0.8)
        .setDepth(60),
    )
    this.tween({
      targets: frame,
      alpha: { from: 0.8, to: 0 },
      duration: CONFIG.effects.resultFeedbackMs,
      onComplete: () => this.removeMotion(frame),
    })
    if (!victory) this.scene.cameras.main.shake(180, 0.004)
  }

  clearMotion(): void {
    for (const tween of [...this.motionTweens]) {
      tween.stop()
      this.motionTweens.delete(tween)
    }
    for (const tower of this.pulsingTowers) tower.cancelPulse()
    this.pulsingTowers.clear()
    for (const object of [...this.motionObjects]) object.destroy()
    this.motionObjects.clear()
    this.trailMarks.length = 0
    this.scene.cameras.main.resetFX()
  }

  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    this.clearMotion()
    for (const object of this.staticObjects) object.destroy()
    this.staticObjects.clear()
  }

  private tween(config: Phaser.Types.Tweens.TweenBuilderConfig): void {
    const tween = this.scene.tweens.add({
      ...config,
      onStop: () => this.motionTweens.delete(tween),
      onComplete: () => {
        this.motionTweens.delete(tween)
        if (typeof config.onComplete === 'function') config.onComplete(tween, [])
      },
    })
    this.motionTweens.add(tween)
  }

  private trackMotion<T extends Phaser.GameObjects.GameObject>(object: T): T {
    this.motionObjects.add(object)
    return object
  }

  private removeMotion(object: Phaser.GameObjects.GameObject): void {
    this.motionObjects.delete(object)
    if (object.active) object.destroy()
  }

  private removeTrail(mark: Phaser.GameObjects.Arc): void {
    const index = this.trailMarks.indexOf(mark)
    if (index >= 0) this.trailMarks.splice(index, 1)
  }

  private trackStatic<T extends Phaser.GameObjects.GameObject>(object: T): T {
    this.staticObjects.add(object)
    return object
  }

  private removeStatic(object: Phaser.GameObjects.GameObject): void {
    this.staticObjects.delete(object)
    if (object.active) object.destroy()
  }
}
