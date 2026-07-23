import Phaser from 'phaser'
import { CONFIG } from '../game.config'
import { BUILD_SPOTS, PATH, TOWERS, WAVES, type TowerType } from '../data/towerDefense'
import { EnemyView, type EnemyRuntime } from '../entities/EnemyView'
import { TowerView, type TowerRuntime } from '../entities/TowerView'
import { createProjectile, type ProjectileRuntime } from '../entities/ProjectileView'
import { playBuildSfx, playClickSfx, playDefeatSfx, playFanfareSfx, playLeakSfx, playShotSfx } from '../systems/audioManager'
import { advanceEnemyAlongPath, chooseTowerTarget, computeTowerUpgrade, damageEnemy, distanceBetween, spendCoins } from '../systems/towerDefenseRules'
import { createWaveState, isFinalWaveComplete, makeEnemyStats, markEnemySpawned, nextEnemyToSpawn, type WaveSpawnState } from '../systems/waves'

export interface HudState {
  coins: number
  lives: number
  wave: number
  totalWaves: number
  selectedTower: string
  status: string
}

interface BuildPad {
  x: number
  y: number
  occupiedBy?: string
  ring: Phaser.GameObjects.Arc
}

interface ShopCard {
  type: TowerType
  x: number
  y: number
  width: number
  height: number
}

export default class GameScene extends Phaser.Scene {
  private coins: number = CONFIG.run.startingCoins
  private lives: number = CONFIG.run.startingLives
  private nextId = 1
  private pads: BuildPad[] = []
  private shopCards: ShopCard[] = []
  private towers: TowerRuntime[] = []
  private enemies: EnemyRuntime[] = []
  private projectiles: ProjectileRuntime[] = []
  private waveState!: WaveSpawnState
  private draggingType?: TowerType
  private dragGhost?: Phaser.GameObjects.Container
  private selectedTowerId?: string
  private status = 'Drag a tower from the shop to a build circle.'

  constructor() {
    super('GameScene')
  }

  create(): void {
    this.cameras.main.setBackgroundColor(CONFIG.world.backgroundColor)
    this.waveState = createWaveState(this.time.now + CONFIG.run.waveStartDelayMs)
    this.drawForest()
    this.drawPath()
    this.drawTitle()
    this.createBuildPads()
    this.createShop()
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => this.moveDragGhost(pointer))
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => this.finishDrag(pointer))
    this.scene.launch('UIScene')
  }

  update(_time: number, delta: number): void {
    const now = this.time.now
    this.spawnEnemies(now)
    this.updateEnemies(delta)
    this.updateTowers(now)
    this.updateProjectiles(delta, now)
    this.checkWinState()
  }

  getHudState(): HudState {
    const selected = this.towers.find((tower) => tower.id === this.selectedTowerId)
    return {
      coins: this.coins,
      lives: this.lives,
      wave: Math.min(this.waveState.waveIndex + 1, WAVES.length),
      totalWaves: WAVES.length,
      selectedTower: selected ? `${TOWERS[selected.type].name} L${selected.level}` : 'none',
      status: this.status,
    }
  }

  private drawForest(): void {
    const g = this.add.graphics()
    g.fillStyle(0x183b20, 1)
    g.fillRect(0, 0, CONFIG.screen.width, CONFIG.screen.height)
    for (let i = 0; i < 70; i++) {
      const x = (i * 73) % 800
      const y = (i * 41) % 480
      if (this.isNearPath(x, y, 45) || y < 58) continue
      g.fillStyle(i % 3 === 0 ? 0x245c2c : 0x1f4b27, 1)
      g.fillTriangle(x, y - 11, x - 12, y + 12, x + 12, y + 12)
      g.fillStyle(0x6b4423, 1)
      g.fillRect(x - 2, y + 8, 4, 10)
    }
  }

  private drawTitle(): void {
    this.add.rectangle(184, 82, 338, 54, CONFIG.ui.panelColor, 0.72).setStrokeStyle(1, CONFIG.world.accentColor, 0.22)
    this.add.text(26, 62, 'Rabbit Defense', { fontSize: '24px', color: CONFIG.ui.textColor, fontStyle: 'bold' })
    this.add.text(28, 90, 'Protect the forest keep from medieval monsters.', { fontSize: '12px', color: '#c8d8b6' })
  }

  private drawPath(): void {
    const g = this.add.graphics()
    g.lineStyle(44, CONFIG.world.pathBorderColor, 1)
    this.strokePath(g)
    g.lineStyle(34, CONFIG.world.pathColor, 1)
    this.strokePath(g)
    g.fillStyle(0xa34b36, 1)
    g.fillRect(745, 154, 38, 58)
    g.fillStyle(0xd9c47b, 1)
    g.fillTriangle(764, 126, 728, 160, 800, 160)
    this.add.text(724, 218, 'KEEP', { fontSize: '12px', color: '#fff4cf', fontStyle: 'bold' })
  }

  private strokePath(g: Phaser.GameObjects.Graphics): void {
    g.beginPath()
    g.moveTo(PATH[0].x, PATH[0].y)
    for (const point of PATH.slice(1)) g.lineTo(point.x, point.y)
    g.strokePath()
  }

  private createBuildPads(): void {
    for (const spot of BUILD_SPOTS) {
      const ring = this.add.circle(spot.x, spot.y, CONFIG.run.buildSpotRadius, 0xf6d365, 0.08)
      ring.setStrokeStyle(2, 0xf6d365, 0.42)
      this.pads.push({ ...spot, ring })
    }
  }

  private createShop(): void {
    const x = 590
    const y = 24
    this.add.rectangle(694, 58, 196, 78, CONFIG.ui.panelColor, 0.92).setStrokeStyle(2, CONFIG.world.accentColor, 0.4)
    this.add.text(x, y, 'Drag towers', { fontSize: '13px', color: CONFIG.ui.textColor, fontStyle: 'bold' })
    ;(['arrow', 'frost', 'bomb'] as TowerType[]).forEach((type, index) => {
      const cardX = x + 8 + index * 61
      const cardY = y + 28
      const tower = TOWERS[type]
      const card = this.add.rectangle(cardX, cardY, 52, 34, 0x2f422b, 0.95).setStrokeStyle(1, tower.topColor)
      const icon = this.add.rectangle(cardX - 14, cardY, 12, 18, tower.color).setStrokeStyle(1, tower.topColor)
      const label = this.add.text(cardX - 2, cardY - 12, tower.name.split(' ')[0], { fontSize: '9px', color: CONFIG.ui.textColor })
      const cost = this.add.text(cardX - 2, cardY + 2, `${tower.cost}c`, { fontSize: '10px', color: '#ffd56a', fontStyle: 'bold' })
      for (const obj of [card, icon, label, cost]) obj.setInteractive({ useHandCursor: true })
      card.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.startDrag(type, pointer))
      icon.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.startDrag(type, pointer))
      label.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.startDrag(type, pointer))
      cost.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.startDrag(type, pointer))
      this.shopCards.push({ type, x: cardX, y: cardY, width: 52, height: 34 })
    })
  }

  private startDrag(type: TowerType, pointer: Phaser.Input.Pointer): void {
    this.draggingType = type
    const tower = TOWERS[type]
    this.dragGhost?.destroy()
    this.dragGhost = this.add.container(pointer.worldX, pointer.worldY)
    this.dragGhost.add([
      this.add.circle(0, 0, tower.range, 0xffffff, 0.08).setStrokeStyle(1, 0xffffff, 0.18),
      this.add.rectangle(0, 2, 22, 26, tower.color, 0.82),
      this.add.triangle(0, -16, -15, 8, 15, 8, 0, -12, tower.topColor, 0.9),
    ])
    playClickSfx()
  }

  private moveDragGhost(pointer: Phaser.Input.Pointer): void {
    if (!this.dragGhost) return
    this.dragGhost.setPosition(pointer.worldX, pointer.worldY)
    const pad = this.nearestFreePad(pointer.worldX, pointer.worldY)
    for (const item of this.pads) item.ring.setFillStyle(0xf6d365, item === pad ? 0.22 : 0.08)
  }

  private finishDrag(pointer: Phaser.Input.Pointer): void {
    if (!this.draggingType) return
    const type = this.draggingType
    const pad = this.nearestFreePad(pointer.worldX, pointer.worldY)
    this.dragGhost?.destroy()
    this.dragGhost = undefined
    this.draggingType = undefined
    for (const item of this.pads) item.ring.setFillStyle(0xf6d365, 0.08)
    if (!pad) {
      this.status = 'Drop on an empty golden build circle.'
      return
    }
    this.placeTower(type, pad)
  }

  private nearestFreePad(x: number, y: number): BuildPad | undefined {
    return this.pads
      .filter((pad) => !pad.occupiedBy && distanceBetween(pad, { x, y }) <= CONFIG.run.buildSpotRadius)
      .sort((a, b) => distanceBetween(a, { x, y }) - distanceBetween(b, { x, y }))[0]
  }

  private placeTower(type: TowerType, pad: BuildPad): void {
    const definition = TOWERS[type]
    if (this.coins < definition.cost) {
      this.status = `Need ${definition.cost} coins for ${definition.name}.`
      return
    }
    this.coins = spendCoins(this.coins, definition.cost)
    const view = new TowerView(this, definition, pad.x, pad.y)
    const tower: TowerRuntime = { ...definition, id: `tower-${this.nextId++}`, x: pad.x, y: pad.y, level: 1, upgradeCost: 55, nextShotAt: 0, view }
    pad.occupiedBy = tower.id
    this.towers.push(tower)
    this.selectTower(tower.id)
    view.container.setInteractive(new Phaser.Geom.Rectangle(-22, -26, 44, 52), Phaser.Geom.Rectangle.Contains)
    view.container.on('pointerdown', () => this.selectOrUpgradeTower(tower.id))
    this.status = `${definition.name} built. Tap it with enough coins to upgrade.`
    playBuildSfx()
  }

  private selectOrUpgradeTower(id: string): void {
    if (this.selectedTowerId !== id) {
      this.selectTower(id)
      return
    }
    const tower = this.towers.find((item) => item.id === id)
    if (!tower) return
    if (this.coins < tower.upgradeCost) {
      this.status = `Need ${tower.upgradeCost} coins to upgrade.`
      return
    }
    const upgraded = computeTowerUpgrade(tower)
    this.coins = spendCoins(this.coins, tower.upgradeCost)
    Object.assign(tower, upgraded)
    tower.view.setLevel(tower.level)
    tower.view.setSelected(true)
    this.status = `${TOWERS[tower.type].name} upgraded to level ${tower.level}.`
    playBuildSfx()
  }

  private selectTower(id?: string): void {
    this.selectedTowerId = id
    for (const tower of this.towers) tower.view.setSelected(tower.id === id)
  }

  private spawnEnemies(now: number): void {
    const type = nextEnemyToSpawn(this.waveState, now)
    if (!type) return
    const stats = makeEnemyStats(type, this.waveState.waveIndex)
    const start = PATH[0]
    const view = new EnemyView(this, stats, start.x, start.y)
    this.enemies.push({ ...stats, id: `enemy-${this.nextId++}`, x: start.x, y: start.y, maxHp: stats.hp, pathIndex: 0, progress: 0, slowedUntil: 0, escaped: false, view })
    markEnemySpawned(this.waveState, now)
    this.status = `Wave ${Math.min(this.waveState.waveIndex + 1, WAVES.length)} incoming!`
  }

  private updateEnemies(delta: number): void {
    for (const enemy of [...this.enemies]) {
      const slow = enemy.slowedUntil > this.time.now ? 0.55 : 1
      const next = advanceEnemyAlongPath(enemy, PATH, enemy.speed * slow * (delta / 1000))
      Object.assign(enemy, next)
      enemy.view.setPosition(enemy.x, enemy.y)
      enemy.view.flashSlow(slow < 1)
      if (enemy.escaped) this.leakEnemy(enemy)
    }
  }

  private updateTowers(now: number): void {
    for (const tower of this.towers) {
      if (now < tower.nextShotAt) continue
      const target = chooseTowerTarget(tower, this.enemies)
      if (!target) continue
      tower.nextShotAt = now + tower.fireRateMs
      tower.view.pulse(this)
      this.projectiles.push({
        sprite: createProjectile(this, tower.x, tower.y - 8, tower.type),
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
      if (distanceBetween(projectile.sprite, projectile.target) <= 12) this.hitEnemy(projectile, now)
    }
  }

  private hitEnemy(projectile: ProjectileRuntime, now: number): void {
    const victims = projectile.splashRadius
      ? this.enemies.filter((enemy) => distanceBetween(enemy, projectile.target) <= projectile.splashRadius!)
      : [projectile.target]
    for (const enemy of victims) {
      const result = damageEnemy(enemy, projectile.damage, projectile.slowMs ? now + projectile.slowMs : enemy.slowedUntil)
      enemy.hp = result.hp
      enemy.slowedUntil = result.slowedUntil
      enemy.view.setHp(enemy.hp, enemy.maxHp)
      if (result.killed) this.killEnemy(enemy)
    }
    this.removeProjectile(projectile)
  }

  private killEnemy(enemy: EnemyRuntime): void {
    if (!this.enemies.includes(enemy)) return
    this.coins += enemy.reward
    this.enemies = this.enemies.filter((item) => item !== enemy)
    enemy.view.destroy()
    this.status = `${enemy.name} defeated +${enemy.reward} coins.`
    playDefeatSfx()
  }

  private leakEnemy(enemy: EnemyRuntime): void {
    this.lives = Math.max(0, this.lives - enemy.leakDamage)
    this.enemies = this.enemies.filter((item) => item !== enemy)
    enemy.view.destroy()
    this.status = `${enemy.name} reached the keep!`
    playLeakSfx()
    if (this.lives === 0) this.endRun(false)
  }

  private removeProjectile(projectile: ProjectileRuntime): void {
    projectile.sprite.destroy()
    this.projectiles = this.projectiles.filter((item) => item !== projectile)
  }

  private checkWinState(): void {
    if (this.lives <= 0) return
    if (isFinalWaveComplete(this.waveState) && this.enemies.length === 0) this.endRun(true)
  }

  private endRun(won: boolean): void {
    this.status = won ? 'Victory! The rabbit keep is safe.' : 'Defeat! The monsters overran the keep.'
    this.input.removeAllListeners()
    this.add.rectangle(400, 240, 430, 130, 0x101610, 0.9).setStrokeStyle(2, CONFIG.world.accentColor)
    this.add.text(400, 214, won ? 'Victory!' : 'Defeat!', { fontSize: '34px', color: CONFIG.ui.textColor, fontStyle: 'bold' }).setOrigin(0.5)
    this.add.text(400, 258, 'Tap to restart Rabbit Defense', { fontSize: '16px', color: '#c8d8b6' }).setOrigin(0.5)
    this.input.once('pointerdown', () => this.scene.restart())
    playFanfareSfx()
  }

  private isNearPath(x: number, y: number, radius: number): boolean {
    return PATH.some((point) => distanceBetween(point, { x, y }) < radius)
  }
}
