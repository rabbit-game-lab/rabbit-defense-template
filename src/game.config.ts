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
    // Range: 20-45 (default 32). Too high overlaps nearby pads.
    // Related: BUILD_SPOTS in data/towerDefense.ts.
    // Units: pixels.
    buildSpotRadius: 32,

    // run.waveStartDelayMs
    // What: delay before wave 1 starts after scene create.
    // Feel: higher gives players more setup time.
    // Range: 500-5000 (default 1600).
    // Related: wave spawn timings.
    // Units: milliseconds.
    waveStartDelayMs: 1600,

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
