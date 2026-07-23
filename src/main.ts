/**
 * BOOT + Rabbit SDK wiring.
 *
 * ⛔ AGENTS MUST NOT EDIT THIS FILE.
 * Tuning lives in `game.config.ts`; game code lives in `src/scenes`,
 * `src/systems`, `src/entities`, `src/data` and `src/state`.
 * Register new scenes in `src/scenes/index.ts` — never here.
 */
import Phaser from 'phaser'
import * as sdk from './rabbit/sdk'
import { CONFIG } from './game.config'
import { setMuted } from './systems/audioManager'
import { RESTART_SCENE_KEY, SCENES } from './scenes'

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: CONFIG.screen.width,
  height: CONFIG.screen.height,
  parent: 'game-container',
  backgroundColor: CONFIG.world.backgroundColor,
  pixelArt: CONFIG.render.pixelArt,
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: SCENES,
}

const game = new Phaser.Game(config)

sdk.init({
  onPause: (paused) => {
    if (paused) {
      game.loop.sleep()
      game.sound.pauseAll()
    } else {
      game.loop.wake()
      game.sound.resumeAll()
    }
  },
  onRestart: () => {
    game.loop.wake()
    for (const scene of game.scene.getScenes(true)) {
      game.scene.stop(scene.scene.key)
    }
    game.scene.start(RESTART_SCENE_KEY)
  },
  onMute: (muted) => {
    setMuted(muted)
    game.sound.mute = muted
  },
})

// Resize: the container rules (never depends on the top frame).
const container = document.getElementById('game-container') as HTMLElement
sdk.observeResize(container, () => {
  game.scale.refresh()
})

game.events.once(Phaser.Core.Events.READY, () => {
  const soundManager = game.sound
  if (soundManager instanceof Phaser.Sound.WebAudioSoundManager) {
    sdk.audio.register(soundManager.context)
  }
})

// Handshake: `rabbit:ready` after the first rendered frame.
game.events.once(Phaser.Core.Events.POST_RENDER, () => {
  sdk.ready()
})
