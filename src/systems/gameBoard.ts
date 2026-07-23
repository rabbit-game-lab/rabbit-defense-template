import Phaser from 'phaser'
import { CONFIG } from '../game.config'
import { TOWER_TEXTURE_KEYS } from '../data/assets'
import { BUILD_SPOTS, type TowerType, SHOP_TOWER_ORDER, TOWERS } from '../data/towerDefense'

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
  scene.add.image(CONFIG.screen.width / 2, CONFIG.screen.height / 2, 'world-board').setDepth(-10)
}

export function createHeader(scene: Phaser.Scene): void {
  scene.add.rectangle(184, 82, 338, 54, CONFIG.ui.panelColor, 0.72).setStrokeStyle(1, CONFIG.world.accentColor, 0.22)
  scene.add.text(26, 62, 'Hidden Dojo Defense', { fontSize: '24px', color: CONFIG.ui.textColor, fontStyle: 'bold' })
  scene.add.text(28, 90, 'Protect the hidden dojo from rival ninja clans.', { fontSize: '12px', color: '#c8d8b6' })
}

export function drawPath(scene: Phaser.Scene): void {
  scene.add.image(760, 168, 'hidden-dojo').setScale(2).setDepth(1)
  scene.add.text(760, 211, 'HIDDEN DOJO', {
    fontSize: '10px',
    color: '#fff4cf',
    fontStyle: 'bold',
    backgroundColor: '#111827',
    padding: { x: 5, y: 2 },
  }).setOrigin(0.5).setDepth(2)
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
    'Drag defenses',
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

    const icon = scene.add.image(0, -10, TOWER_TEXTURE_KEYS[type])
      .setDisplaySize(22, 22)

    const nameText = scene.add.text(0, 1, towerLabel, {
      fontSize: '10px',
      color: CONFIG.ui.textColor,
    }).setOrigin(0.5, 0)
    const costText = scene.add.text(0, 14, `${tower.cost} ryo`, {
      fontSize: '9px',
      color: '#ffd56a',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0)

    card.add([cardBg, icon, nameText, costText])
    card.setSize(cardWidth, cardHeight)
    card.setInteractive(new Phaser.Geom.Rectangle(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight), Phaser.Geom.Rectangle.Contains)
    card.on('pointerdown', (pointer: Phaser.Input.Pointer) => onStartDrag(type, pointer))

    return { type, x: centerX, y: centerY, width: cardWidth, height: cardHeight }
  })
}
