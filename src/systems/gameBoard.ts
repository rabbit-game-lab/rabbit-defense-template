import Phaser from 'phaser'
import { CONFIG } from '../game.config'
import { TOWER_TEXTURE_KEYS } from '../data/assets'
import { type TowerType, SHOP_TOWER_ORDER, TOWERS } from '../data/towerDefense'

export interface ShopCard {
  type: TowerType
  x: number
  y: number
  width: number
  height: number
  setKeyboardFocus(focused: boolean): void
  /**
   * Cards stay tappable when unaffordable so keyboard and touch players still get
   * the "need N more ryo" explanation instead of a control that silently does nothing.
   */
  setAffordable(affordable: boolean, shortfall: number): void
}

export function createBattleBackground(scene: Phaser.Scene): void {
  scene.add.image(CONFIG.screen.width / 2, CONFIG.screen.height / 2, 'world-board').setDepth(-10)
}

export function createHeader(scene: Phaser.Scene): void {
  scene.add.rectangle(184, 82, 338, 54, CONFIG.ui.panelColor, 0.72).setStrokeStyle(1, CONFIG.world.accentColor, 0.22)
  scene.add.text(26, 62, 'Hidden Dojo Defense', { fontSize: '24px', color: CONFIG.ui.textColor, fontStyle: 'bold' })
  scene.add.text(28, 90, 'Protect the hidden dojo from rival ninja clans.', { fontSize: '12px', color: CONFIG.ui.colors.subtitle })
}

export function drawPath(scene: Phaser.Scene): void {
  scene.add.image(760, 168, 'hidden-dojo').setScale(2).setDepth(1)
  scene.add.text(760, 211, 'HIDDEN DOJO', {
    fontSize: '10px',
    color: CONFIG.ui.textColor,
    fontStyle: 'bold',
    backgroundColor: CONFIG.ui.colors.badgeBackground,
    padding: { x: 5, y: 2 },
  }).setOrigin(0.5).setDepth(2)
}

export function buildCards(scene: Phaser.Scene, onSelect: (type: TowerType, pointer: Phaser.Input.Pointer) => void): ShopCard[] {
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
    'Choose a defense',
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
    const towerLabel = tower.type === 'arrow' ? 'Fast' : tower.type === 'frost' ? 'Slow' : 'Splash'

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
      fontSize: shopCfg.cardLabelFontSize,
      color: CONFIG.ui.textColor,
    }).setOrigin(0.5, 0)
    const costText = scene.add.text(0, 14, `${tower.cost} ryo`, {
      fontSize: shopCfg.cardCostFontSize,
      color: CONFIG.ui.colors.accentText,
      fontStyle: 'bold',
    }).setOrigin(0.5, 0)

    card.add([cardBg, icon, nameText, costText])
    card.setSize(cardWidth, cardHeight)
    card.setInteractive(new Phaser.Geom.Rectangle(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight), Phaser.Geom.Rectangle.Contains)
    card.on('pointerdown', (pointer: Phaser.Input.Pointer) => onSelect(type, pointer))

    // Called every frame, so both inputs are memoised: the shortfall keeps counting
    // down while a card stays unaffordable.
    let affordable = true
    let lastShortfall = 0

    return {
      type, x: centerX, y: centerY, width: cardWidth, height: cardHeight,
      setKeyboardFocus: (focused: boolean) => {
        cardBg.setStrokeStyle(focused ? 3 : 1, focused ? 0xffffff : tower.topColor, focused ? 1 : 0.8)
      },
      setAffordable: (nextAffordable: boolean, shortfall: number) => {
        if (nextAffordable === affordable && shortfall === lastShortfall) return
        affordable = nextAffordable
        lastShortfall = shortfall
        cardBg.setFillStyle(
          nextAffordable ? 0x2f422b : CONFIG.ui.buttonDefaults.disabledFill,
          nextAffordable ? 0.95 : CONFIG.ui.buttonDefaults.disabledAlpha,
        )
        icon.setAlpha(nextAffordable ? 1 : 0.45)
        nameText.setAlpha(nextAffordable ? 1 : 0.55)
        costText
          .setText(nextAffordable ? `${tower.cost} ryo` : `+${shortfall} ryo`)
          .setColor(nextAffordable ? CONFIG.ui.colors.accentText : CONFIG.ui.colors.danger)
      },
    }
  })
}
