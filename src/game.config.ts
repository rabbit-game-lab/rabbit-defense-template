/* =============================================================================
 * GAME CONFIG — central tuning file. Read this before editing anything.
 * =============================================================================
 * Every gameplay value a player may ask to change belongs here first.
 * Screen dimensions are structural for Rabbit 2D templates: keep 800×480.
 * =============================================================================
 */

export const CONFIG = {
  screen: {
    // screen.width / screen.height
    // What: fixed logical resolution of the game canvas.
    // Feel: n/a — structural. Scale.FIT letterboxes it into the container.
    // Range: do not change.
    // Related: scene layout and HUD positions.
    // Units: pixels.
    width: 800,
    height: 480,
  },

  render: {
    // render.pixelArt
    // What: disables texture smoothing so pixel art stays crisp.
    // Feel: true = retro/pixel-art look.
    // Range: true | false (default true).
    // Related: generated medieval sprites and tile-like scenery.
    // Units: boolean.
    pixelArt: true,
  },

  world: {
    // world.backgroundColor
    // What: canvas clear color behind the forest battlefield.
    // Feel: darker greens feel denser and more medieval.
    // Range: any hex color (default '#132819').
    // Related: pathColor, accentColor.
    // Units: CSS hex string.
    backgroundColor: '#132819',

    // world.accentColor
    // What: Rabbit Defense UI highlight color.
    // Feel: warmer values feel more heroic and readable.
    // Range: any readable hex literal (default 0xf6d365).
    // Related: ui.panelColor and tower highlight states.
    // Units: hex literal.
    accentColor: 0xf6d365,

    // world.pathColor
    // What: dirt road color for the monster path.
    // Feel: higher saturation makes the route more obvious.
    // Range: dark/medium brown hex literal (default 0x7a5130).
    // Related: pathBorderColor.
    // Units: hex literal.
    pathColor: 0x7a5130,

    // world.pathBorderColor
    // What: darker edge around the path for pixel-art readability.
    // Feel: darker = more carved into the forest.
    // Range: brown/black hex literal (default 0x392719).
    // Related: pathColor.
    // Units: hex literal.
    pathBorderColor: 0x392719,
  },

  run: {
    // run.startingCoins
    // What: coins available at the beginning of a run.
    // Feel: higher = easier first wave and more experimentation.
    // Range: 75-200 (default 130). Too low can soft-lock the first wave.
    // Related: tower costs in data/towerDefense.ts.
    // Units: coins.
    startingCoins: 130,

    // run.startingLives
    // What: lives before monsters overrun the rabbit keep.
    // Feel: higher = more forgiving; lower = tense arcade style.
    // Range: 5-30 (default 15).
    // Related: enemy leakDamage values.
    // Units: lives.
    startingLives: 15,

    // run.buildSpotRadius
    // What: snap radius around build pads for drag placement.
    // Feel: larger = easier touch/mobile placement.
    // Range: 20-45 (default 32).
    // Related: BUILD_SPOTS in data/towerDefense.ts.
    // Units: pixels.
    buildSpotRadius: 32,
  },

  ui: {
    // ui.panelColor
    // What: dark translucent medieval HUD panel color.
    // Feel: darker panels make text readable on forest art.
    // Range: any hex literal (default 0x1f2b20).
    // Related: world.accentColor.
    // Units: hex literal.
    panelColor: 0x1f2b20,

    // ui.textColor
    // What: primary text color.
    // Feel: warm parchment reads as medieval.
    // Range: CSS color string (default '#fff4cf').
    // Related: world.accentColor.
    // Units: CSS color string.
    textColor: '#fff4cf',

    // Non-modal first-run callout; bounds 170-630 x 132-168.
    onboarding: {
      x: 400,
      y: 150,
      width: 460,
      height: 36,
      textSize: '13px',
      objectiveAutoAdvanceMs: 1700,
    },

    shop: {
      // Panel bounds must remain within the fixed 800x480 canvas.
      panelX: 684,

      // Vertical center; related to panelHeight and card title spacing.
      panelY: 64,

      // Produces horizontal bounds 572-796 with panelX 684.
      panelWidth: 224,

      // Produces vertical bounds 6-122 with panelY 64.
      panelHeight: 116,

      // Offset from panel top; leaves the cards beginning at y=34.
      titleY: 8,

      // ui.shop.titleFontSize
      // What: shop header font size.
      // Feel: bold labels improve discoverability.
      // Range: '12px'-'18px' (default '14px').
      // Related: ui.shop.cardFontSize.
      // Units: CSS px string.
      cardTitleFontSize: '14px',

      // ui.shop.cardWidth
      // What: width for each shop card.
      // Feel: larger cards are easier to hit and read.
      // Range: 64-112 (default 84).
      // Related: ui.shop.cardSpacingX.
      // Units: pixels.
      cardWidth: 64,

      // ui.shop.cardHeight
      // What: height for each shop card.
      // Feel: higher cards keep icons/labels clear and touch-safe.
      // Range: 48-92 (default 64).
      // Related: ui.shop.cardWidth.
      // Units: pixels.
      cardHeight: 58,

      // ui.shop.cardSpacingX
      // What: horizontal spacing between card centers.
      // Feel: too tight hurts touch precision.
      // Range: 72-110 (default 88).
      // Related: shopWidth and cardWidth.
      // Units: pixels.
      cardSpacingX: 70,

      // ui.shop.cardPadding
      // What: internal padding for card content from edges.
      // Feel: too small feels cramped.
      // Range: 8-16 (default 10).
      // Units: pixels.
      cardPadding: 10,

      // ui.shop.cardIconWidth
      // What: width of the icon block on each card.
      // Feel: balanced with label text.
      // Range: 14-24 (default 18).
      // Units: pixels.
      iconWidth: 18,

      // ui.shop.cardIconHeight
      // What: height of the icon block on each card.
      // Feel: larger icons help recognition.
      // Range: 18-30 (default 22).
      // Units: pixels.
      iconHeight: 22,

      // ui.shop.cardLabelFontSize
      // What: tower name size.
      // Feel: 11-12px keeps readable labels without crowding.
      // Range: '11px'-'13px' (default '12px').
      // Related: cardCostFontSize.
      // Units: CSS px string.
      cardLabelFontSize: '12px',

      // ui.shop.cardCostFontSize
      // What: cost label size.
      // Feel: readable tap targets are easier with slightly smaller than label.
      // Range: '11px'-'13px' (default '12px').
      // Related: cardLabelFontSize.
      // Units: CSS px string.
      cardCostFontSize: '12px',

      // ui.shop.minTouchablePx
      // What: minimum guaranteed card hit area.
      // Feel: controls this value should stay >= 44 for touch targets.
      // Range: 44-90 (default 44).
      // Related: cardWidth/Height.
      // Units: pixels.
      minTouchablePx: 44,
    },

    hud: {
      // ui.hud.topRowY
      // What: vertical position of the top status panel text group.
      // Feel: moving lower increases separation from header.
      // Range: 10-30 (default 12).
      // Related: ui.hud.topRowHeight.
      // Units: pixels.
      topRowY: 12,

      // ui.hud.topRowWidth
      // What: width of the top status strip.
      // Feel: wider strips reduce clutter.
      // Range: 340-440 (default 390).
      // Related: screen.width.
      // Units: pixels.
      topRowWidth: 390,

      // ui.hud.topRowHeight
      // What: height of the top status strip.
      // Feel: higher values allow bigger text for readability.
      // Range: 34-56 (default 38).
      // Units: pixels.
      topRowHeight: 38,

      // ui.hud.topRowX
      // What: horizontal center of top panel.
      // Feel: keeping center-left preserves path visibility.
      // Range: 150-260 (default 205).
      // Units: pixels.
      topRowX: 205,

      // Center of bottom strip; bounds stay inside y=422-478.
      bottomY: 450,

      // ui.hud.bottomWidth
      // What: width of the bottom HUD strip.
      // Feel: should span enough to host tower detail + preview + action.
      // Range: 760-780 (default 760).
      // Units: pixels.
      bottomWidth: 760,

      // ui.hud.bottomHeight
      // What: height of the bottom HUD strip.
      // Feel: room for selected status + upgrade info + button.
      // Range: 68-96 (default 74).
      // Units: pixels.
      bottomHeight: 56,

      // ui.hud.bottomTextX
      // What: left x for selected tower text.
      // Feel: moving text to mid keeps action button reachable.
      // Range: 20-60 (default 28).
      // Units: pixels.
      selectedTextX: 28,

      // ui.hud.statusTextX
      // What: status/prompt text x position.
      // Feel: placing to the right keeps detail + cost line visible.
      // Range: 180-240 (default 212).
      // Units: pixels.
      statusTextX: 212,

      // ui.hud.selectedFontSize
      // What: detail text size.
      // Feel: larger text improves glanceability while playing.
      // Range: '11px'-'14px' (default '12px').
      // Units: CSS px string.
      selectedFontSize: '12px',

      // ui.hud.statusFontSize
      // What: status/prompt text size.
      // Feel: smaller text lets everything fit.
      // Range: '10px'-'12px' (default '10px').
      // Units: CSS px string.
      statusFontSize: '10px',

      // ui.hud.previewFontSize
      // What: upgrade summary/preview text size.
      // Feel: slightly larger helps readability in mobile mode.
      // Range: '10px'-'12px' (default '10px').
      // Units: CSS px string.
      previewFontSize: '10px',

      // ui.hud.upgradeButtonWidth
      // What: width of the upgrade button.
      // Feel: larger width avoids accidental mis-taps.
      // Range: 140-220 (default 154).
      // Related: ui.hud.upgradeButtonHeight.
      // Units: pixels.
      upgradeButtonWidth: 140,

      // ui.hud.upgradeButtonHeight
      // What: height of the upgrade button.
      // Feel: must be >=44 for touch-safe gameplay.
      // Range: 44-66 (default 48).
      // Units: pixels.
      upgradeButtonHeight: 44,

      // ui.hud.upgradeButtonX
      // What: x center of upgrade button.
      // Feel: placing near right edge reduces accidental taps.
      // Range: 670-760 (default 700).
      // Units: pixels.
      upgradeButtonX: 700,

      // Centered in bottom strip with a 44px touch target.
      upgradeButtonY: 450,

      // ui.hud.upgradeButtonFontSize
      // What: text size on upgrade button.
      // Feel: larger labels communicate action more clearly.
      // Range: '11px'-'16px' (default '12px').
      // Units: CSS px string.
      upgradeButtonFontSize: '12px',

      // ui.hud.selectedLineY
      // What: y position of selected tower text within bottom panel.
      // Range: 6-22 (default 10).
      // Units: pixels.
      selectedLineY: 6,

      // ui.hud.statusLineY
      // What: y position of status text in bottom panel.
      // Range: 24-38 (default 30).
      // Units: pixels.
      statusLineY: 24,

      // ui.hud.previewLineY
      // What: y position of upgrade preview text within bottom panel.
      // Range: 44-62 (default 48).
      // Units: pixels.
      previewLineY: 40,

      // ui.hud.infoTextColor
      // What: color used for neutral HUD labels.
      // Range: CSS color string (default '#c8d8b6').
      // Units: CSS color string.
      infoTextColor: '#c8d8b6',
    },
  },


  waves: {
    // waves.betweenWaveDelayMs
    // What: pause duration between the last spawn of wave N and first spawn of wave N+1.
    // Feel: longer pauses reduce pressure and support planning.
    // Range: 800-5000 (default 2600).
    // Related: build pad availability and player upgrading cadence.
    // Units: milliseconds.
    betweenWaveDelayMs: 2600,

    // waves.firstWavePrepareDelayMs
    // What: delay after first tower placement before the first wave spawns.
    // Feel: gives players a guaranteed setup grace window to place initial defenses.
    // Range: 500-8000 (default 3000).
    // Related: run.startingCoins and build pad spacing.
    // Units: milliseconds.
    firstWavePrepareDelayMs: 3000,
  },

  combat: {
    // combat.projectileHitRadiusPx
    // What: impact radius used to determine if a projectile collides with a target.
    // Feel: bigger feels less precise but more forgiving.
    // Range: 6-24 (default 12).
    // Related: tower projectile visuals and enemy speed.
    // Units: pixels.
    projectileHitRadiusPx: 12,
  },

  audio: {
    // audio.sfxVolume
    // What: master gain applied to every procedural sound effect.
    // Feel: higher = louder feedback; 0 = silent game.
    // Range: 0-1 (default 0.45). Above 0.8 can clip on some devices.
    // Related: individual envelopes in systems/audioManager.ts.
    // Units: 0-1 factor.
    sfxVolume: 0.45,
  },
} as const
