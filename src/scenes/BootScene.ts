/** Loads every asset declared in data/assets.ts, then starts the game. */
import Phaser from 'phaser'
import { IMAGES } from '../data/assets'
import { initializePersistedAudioSettings } from '../systems/audioStartup.js'
import { applyAudioSettings } from '../systems/audioManager.js'
import { loadAudioSettings } from '../systems/audioSettingsStore.js'
import { resolveBootNextScene } from './flowContracts'

export default class BootScene extends Phaser.Scene {
  private hasStartedNextScene = false

  constructor() {
    super('BootScene')
  }

  preload(): void {
    if (IMAGES.length > 0) {
      this.createLoadingBar()
    }
    for (const { key, path } of IMAGES) {
      this.load.image(key, path)
    }
  }

  create(): void {
    // 1×1 white pixel texture: handy for rectangles, particles and flashes.
    if (!this.textures.exists('pixel')) {
      const gfx = this.add.graphics()
      gfx.fillStyle(0xffffff, 1)
      gfx.fillRect(0, 0, 1, 1)
      gfx.generateTexture('pixel', 1, 1)
      gfx.destroy()
    }

    void (async () => {
      try {
        await initializePersistedAudioSettings({
          loadAudioSettings,
          applyAudioSettings,
        })
      } catch {
        // Non-blocking: continue boot even when audio persistence is unavailable.
        applyAudioSettings({})
      } finally {
        const action = resolveBootNextScene(true)
        if (action.type === 'start') {
          this.startNextScene(action.nextScene)
        }
      }
    })()
  }

  private startNextScene(nextScene: string): void {
    if (this.hasStartedNextScene) return
    this.hasStartedNextScene = true
    this.scene.start(nextScene)
  }

  private createLoadingBar(): void {
    const { width, height } = this.cameras.main
    const progressBox = this.add.graphics()
    const progressBar = this.add.graphics()
    progressBox.fillStyle(0x222222, 0.8)
    progressBox.fillRect(width / 2 - 160, height / 2 - 15, 320, 30)

    const loadingText = this.add
      .text(width / 2, height / 2 - 30, 'Loading...', {
        fontSize: '16px',
        color: '#ffffff',
      })
      .setOrigin(0.5)

    this.load.on('progress', (value: number) => {
      progressBar.clear()
      progressBar.fillStyle(0xffffff, 1)
      progressBar.fillRect(width / 2 - 150, height / 2 - 10, 300 * value, 20)
    })

    this.load.on('complete', () => {
      progressBar.destroy()
      progressBox.destroy()
      loadingText.destroy()
    })
  }
}
