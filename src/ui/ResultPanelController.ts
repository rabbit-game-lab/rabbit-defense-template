import Phaser from 'phaser'
import { CONFIG } from '../game.config'
import type { HudState } from '../scenes/GameScene'
import { createSceneButton, type SceneButtonHandle } from './createSceneButton'

export interface ResultPanelActions {
  onReplay: () => void
  onMainMenu: () => void
  onVisibilityChange: (visible: boolean) => void
}

function formatDuration(durationMs: number): string {
  const seconds = Math.max(0, Math.floor(durationMs / 1000))
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`
}

export class ResultPanelController {
  private readonly scene: Phaser.Scene
  private readonly actions: ResultPanelActions
  private readonly objects: Array<Phaser.GameObjects.Rectangle | Phaser.GameObjects.Text> = []
  private readonly title: Phaser.GameObjects.Text
  private readonly summary: Phaser.GameObjects.Text
  private readonly resources: Phaser.GameObjects.Text
  private readonly records: Phaser.GameObjects.Text
  private readonly replayButton: SceneButtonHandle
  private readonly menuButton: SceneButtonHandle
  private visible = false
  private focusIndex = 0

  constructor(scene: Phaser.Scene, actions: ResultPanelActions) {
    this.scene = scene
    this.actions = actions
    const x = CONFIG.screen.width / 2
    const y = CONFIG.screen.height / 2
    const depth = CONFIG.ui.pauseMenu.depth + 20
    const dimmer = scene.add.rectangle(x, y, CONFIG.screen.width, CONFIG.screen.height, 0x000000, 0.68)
      .setDepth(depth)
      .setInteractive()
      .on('pointerdown', (
        _pointer: Phaser.Input.Pointer,
        _localX: number,
        _localY: number,
        event: Phaser.Types.Input.EventData,
      ) => event.stopPropagation())
    const panel = scene.add.rectangle(x, y, 580, 310, CONFIG.ui.panelColor, 0.99)
      .setStrokeStyle(3, CONFIG.world.accentColor, 0.8).setDepth(depth + 1)
    this.title = scene.add.text(x, y - 112, '', {
      fontSize: '28px', color: CONFIG.ui.textColor, fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(depth + 2)
    this.summary = scene.add.text(x, y - 58, '', {
      fontSize: '16px', color: '#ffd56a', align: 'center',
    }).setOrigin(0.5).setDepth(depth + 2)
    this.resources = scene.add.text(x, y - 14, '', {
      fontSize: '15px', color: CONFIG.ui.textColor,
    }).setOrigin(0.5).setDepth(depth + 2)
    this.records = scene.add.text(x, y + 28, '', {
      fontSize: '13px', color: CONFIG.ui.hud.infoTextColor, align: 'center',
      wordWrap: { width: 520 },
    }).setOrigin(0.5).setDepth(depth + 2)
    this.objects.push(dimmer, panel, this.title, this.summary, this.resources, this.records)
    this.replayButton = createSceneButton(scene, {
      x: x - 120, y: y + 102, width: 190, text: 'Replay',
      depth: depth + 3, onActivate: actions.onReplay,
    })
    this.menuButton = createSceneButton(scene, {
      x: x + 120, y: y + 102, width: 190, text: 'Main Menu',
      depth: depth + 3, onActivate: actions.onMainMenu,
    })
    scene.input.keyboard?.on('keydown-TAB', this.onNavigate)
    scene.input.keyboard?.on('keydown-LEFT', this.onNavigate)
    scene.input.keyboard?.on('keydown-RIGHT', this.onNavigate)
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy)
    this.setVisible(false)
  }

  render(hud: HudState): void {
    if (!hud.result) {
      this.setVisible(false)
      return
    }
    const { result, profile } = hud
    this.title.setText(result.outcome === 'victory' ? 'Victory · Dojo Secured' : 'Defeat · Dojo Fallen')
    this.title.setColor(result.outcome === 'victory' ? '#bde88f' : '#ffaaa0')
    this.summary.setText(
      `Raids cleared  ${result.wavesCleared}/${hud.totalWaves}\nDefeated  ${result.kills}    Breaches  ${result.leaks}    Time  ${formatDuration(result.durationMs)}`,
    )
    this.resources.setText(`Dojo HP  ${result.livesRemaining}    Ryo  ${result.coinsRemaining}`)
    const fastest = profile.fastestWinMs > 0 ? formatDuration(profile.fastestWinMs) : '—'
    this.records.setText(
      `Career · ${profile.wins} wins · ${profile.defeats} defeats · Best HP ${profile.bestLives} · Best Ryo ${profile.bestCoins} · Fastest ${fastest}`,
    )
    this.setVisible(true)
  }

  isVisible(): boolean {
    return this.visible
  }

  destroy = (): void => {
    this.scene.input.keyboard?.off('keydown-TAB', this.onNavigate)
    this.scene.input.keyboard?.off('keydown-LEFT', this.onNavigate)
    this.scene.input.keyboard?.off('keydown-RIGHT', this.onNavigate)
    this.replayButton.destroy()
    this.menuButton.destroy()
    this.objects.forEach((object) => object.destroy())
  }

  private setVisible(visible: boolean): void {
    if (this.visible !== visible) this.actions.onVisibilityChange(visible)
    this.visible = visible
    this.objects.forEach((object) => object.setVisible(visible))
    this.replayButton.setEnabled(visible)
    this.menuButton.setEnabled(visible)
    this.replayButton.setVisible(visible)
    this.menuButton.setVisible(visible)
    this.replayButton.setKeyboardFocus(visible && this.focusIndex === 0)
    this.menuButton.setKeyboardFocus(visible && this.focusIndex === 1)
  }

  private readonly onNavigate = (event: KeyboardEvent): void => {
    if (!this.visible) return
    event.preventDefault()
    this.focusIndex = this.focusIndex === 0 ? 1 : 0
    this.replayButton.setKeyboardFocus(this.focusIndex === 0)
    this.menuButton.setKeyboardFocus(this.focusIndex === 1)
  }
}
