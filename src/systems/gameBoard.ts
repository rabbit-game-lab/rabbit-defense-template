import Phaser from 'phaser'
import { CONFIG } from '../game.config'
import { BUILD_SPOTS, PATH, type TowerType, SHOP_TOWER_ORDER, TOWERS } from '../data/towerDefense'
import { distanceBetween } from './towerDefenseRules'

export interface BuildPad {
  x: number
  y: number
  occupiedBy?: string
  ring: Phaser.GameObjects.Arc
}

export interface ShopCard {
  type: TowerType
  x: number
  y: number
  width: number
  height: number
}

export function createBattleBackground(scene: Phaser.Scene): void {
  const g = scene.add.graphics()
  g.fillStyle(0x183b20, 1)
  g.fillRect(0, 0, CONFIG.screen.width, CONFIG.screen.height)
  for (let i = 0; i < 70; i++) {
    const x = (i * 73) % CONFIG.screen.width
    const y = (i * 41) % CONFIG.screen.height
    if (isNearPathPoint(x, y, 45) || y < 58) continue
    g.fillStyle(i % 3 === 0 ? 0x245c2c : 0x1f4b27, 1)
    g.fillTriangle(x, y - 11, x - 12, y + 12, x + 12, y + 12)
    g.fillStyle(0x6b4423, 1)
    g.fillRect(x - 2, y + 8, 4, 10)
  }
}

export function createHeader(scene: Phaser.Scene): void {
  scene.add.rectangle(184, 82, 338, 54, CONFIG.ui.panelColor, 0.72).setStrokeStyle(1, CONFIG.world.accentColor, 0.22)
  scene.add.text(26, 62, 'Rabbit Defense', { fontSize: '24px', color: CONFIG.ui.textColor, fontStyle: 'bold' })
  scene.add.text(28, 90, 'Protect the forest keep from medieval monsters.', { fontSize: '12px', color: '#c8d8b6' })
}

export function drawPath(scene: Phaser.Scene): void {
  const g = scene.add.graphics()
  g.lineStyle(44, CONFIG.world.pathBorderColor, 1)
  strokePath(g)
  g.lineStyle(34, CONFIG.world.pathColor, 1)
  strokePath(g)
  g.fillStyle(0xa34b36, 1)
  g.fillRect(745, 154, 38, 58)
  g.fillStyle(0xd9c47b, 1)
  g.fillTriangle(764, 126, 728, 160, 800, 160)
  scene.add.text(724, 218, 'KEEP', { fontSize: '12px', color: '#fff4cf', fontStyle: 'bold' })
}

function strokePath(g: Phaser.GameObjects.Graphics): void {
  g.beginPath()
  g.moveTo(PATH[0].x, PATH[0].y)
  for (const point of PATH.slice(1)) g.lineTo(point.x, point.y)
  g.strokePath()
}

export function createBuildPads(scene: Phaser.Scene): BuildPad[] {
  return BUILD_SPOTS.map((spot) => {
    const ring = scene.add.circle(spot.x, spot.y, CONFIG.run.buildSpotRadius, 0xf6d365, 0.08)
    ring.setStrokeStyle(2, 0xf6d365, 0.42)
    return { ...spot, ring }
  })
}

export function buildCards(scene: Phaser.Scene, onStartDrag: (type: TowerType, pointer: Phaser.Input.Pointer) => void): ShopCard[] {
  const shopCfg = CONFIG.ui.shop
  const shopBounds = {
    left: shopCfg.panelX - shopCfg.panelWidth / 2,
    top: shopCfg.panelY - shopCfg.panelHeight / 2,
  }

  scene.add
    .rectangle(shopCfg.panelX, shopCfg.panelY, shopCfg.panelWidth, shopCfg.panelHeight, CONFIG.ui.panelColor, 0.92)
    .setStrokeStyle(2, CONFIG.world.accentColor, 0.4)

  scene.add.text(
    shopBounds.left + shopCfg.cardPadding,
    shopBounds.top + shopCfg.titleY,
    'Drag towers',
    {
      fontSize: shopCfg.cardTitleFontSize,
      color: CONFIG.ui.textColor,
      fontStyle: 'bold',
    },
  )

  const cardWidth = Math.max(shopCfg.cardWidth, shopCfg.minTouchablePx)
  const cardHeight = Math.max(shopCfg.cardHeight, shopCfg.minTouchablePx)

  return SHOP_TOWER_ORDER.map((type, index) => {
    const tower = TOWERS[type]
    const towerLabel = tower.name.split(' ')[0]

    const cardLeft = shopBounds.left + shopCfg.cardPadding + index * shopCfg.cardSpacingX
    const cardTop = shopBounds.top + shopCfg.cardPadding + 18
    const centerX = cardLeft + cardWidth / 2
    const centerY = cardTop + cardHeight / 2

    const card = scene.add.container(centerX, centerY)
    const cardBg = scene.add.rectangle(0, 0, cardWidth, cardHeight, 0x2f422b, 0.95)
    cardBg.setStrokeStyle(1, tower.topColor)

    const iconX = -cardWidth / 2 + shopCfg.cardPadding + shopCfg.iconWidth / 2
    const iconY = -shopCfg.cardPadding / 2
    const icon = scene.add.rectangle(iconX, iconY, shopCfg.iconWidth, shopCfg.iconHeight, tower.color)
      .setStrokeStyle(1, tower.topColor)

    const textX = iconX + shopCfg.iconWidth / 2 + 6
    const nameText = scene.add.text(textX, -4, towerLabel, {
      fontSize: shopCfg.cardLabelFontSize,
      color: CONFIG.ui.textColor,
    })
    const costText = scene.add.text(textX, 12, `${tower.cost}c`, {
      fontSize: shopCfg.cardCostFontSize,
      color: '#ffd56a',
      fontStyle: 'bold',
    })

    card.add([cardBg, icon, nameText, costText])
    card.setSize(cardWidth, cardHeight)
    card.setInteractive(new Phaser.Geom.Rectangle(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight), Phaser.Geom.Rectangle.Contains)
    card.on('pointerdown', (pointer: Phaser.Input.Pointer) => onStartDrag(type, pointer))

    return { type, x: centerX, y: centerY, width: cardWidth, height: cardHeight }
  })
}

export function nearestFreePad(x: number, y: number, pads: readonly BuildPad[]): BuildPad | undefined {
  return pads
    .filter((pad) => !pad.occupiedBy)
    .filter((pad) => distanceBetween(pad, { x, y }) <= CONFIG.run.buildSpotRadius)
    .sort((a, b) => distanceBetween(a, { x, y }) - distanceBetween(b, { x, y }))[0]
}

function isNearPathPoint(x: number, y: number, radius: number): boolean {
  return PATH.some((point) => Math.hypot(point.x - x, point.y - y) < radius)
}
