import Phaser from 'phaser'
import {
  calculateResponsiveViewport,
  createOrientationGateState,
  resolveOrientationGate,
  type GameplayPauseStatus,
  type OrientationGateState,
  type ResponsiveViewportPolicy,
  type ViewportSize,
} from './orientationGateRules'

export interface PortraitOrientationGateVisuals {
  depth: number
  backgroundColor: number
  backgroundAlpha: number
  panelColor: number
  panelAlpha: number
  accentColor: number
  titleColor: string
  bodyColor: string
  titleFontSize: string
  bodyFontSize: string
  title: string
  instructions: string
  panelWidth: number
  panelHeight: number
  panelStrokeWidth: number
  deviceWidth: number
  deviceHeight: number
  deviceStrokeWidth: number
  deviceOffsetY: number
  arrowOffsetX: number
  arrowFontSize: string
  titleOffsetY: number
  bodyOffsetY: number
  bodyWrapWidth: number
}

export interface OrientationGameplayAdapter {
  getPauseStatus(): GameplayPauseStatus
  pause(): void
  resume(): void
  canResumeFromOrientationGate(): boolean
  setUiBlocked(blocked: boolean): void
}

export interface PortraitOrientationGateConfig {
  scene: Phaser.Scene
  viewportPolicy: ResponsiveViewportPolicy
  visuals: PortraitOrientationGateVisuals
  gameplay: OrientationGameplayAdapter
  getViewportSize?: () => ViewportSize
  onGateChange?: (active: boolean) => void
}

export class PortraitOrientationGate {
  private readonly scene: Phaser.Scene
  private readonly policy: ResponsiveViewportPolicy
  private readonly visuals: PortraitOrientationGateVisuals
  private readonly gameplay: OrientationGameplayAdapter
  private readonly getViewportSize: () => ViewportSize
  private readonly onGateChange?: (active: boolean) => void
  private readonly objects: Array<Phaser.GameObjects.Rectangle | Phaser.GameObjects.Text> = []
  private readonly blocker: Phaser.GameObjects.Rectangle
  private state: OrientationGateState = createOrientationGateState()
  private destroyed = false

  constructor(config: PortraitOrientationGateConfig) {
    this.scene = config.scene
    this.policy = config.viewportPolicy
    this.visuals = config.visuals
    this.gameplay = config.gameplay
    this.onGateChange = config.onGateChange
    this.getViewportSize = config.getViewportSize ?? this.readParentViewport
    this.blocker = this.createGate()

    this.scene.scale.on(Phaser.Scale.Events.RESIZE, this.refresh)
    window.addEventListener('resize', this.refresh)
    window.addEventListener('orientationchange', this.refresh)
    this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy)
    this.refresh()
  }

  public isActive(): boolean {
    return this.state.active
  }

  public refresh = (): void => {
    if (this.destroyed) return
    const layout = calculateResponsiveViewport(this.getViewportSize(), this.policy)
    const wasActive = this.state.active
    const transition = resolveOrientationGate(
      this.state,
      layout.shouldBlockInput,
      this.gameplay.getPauseStatus(),
    )

    this.state = transition.state
    if (transition.effect === 'pause-gameplay') {
      this.gameplay.pause()
    } else if (
      transition.effect === 'resume-gameplay' &&
      this.gameplay.canResumeFromOrientationGate()
    ) {
      this.gameplay.resume()
    }

    this.setVisible(this.state.active)
    if (wasActive !== this.state.active) {
      this.gameplay.setUiBlocked(this.state.active)
      this.onGateChange?.(this.state.active)
    }
  }

  public destroy = (): void => {
    if (this.destroyed) return
    this.destroyed = true
    this.scene.scale.off(Phaser.Scale.Events.RESIZE, this.refresh)
    window.removeEventListener('resize', this.refresh)
    window.removeEventListener('orientationchange', this.refresh)
    window.removeEventListener('keydown', this.blockKeyboardInput, true)

    if (this.state.active) {
      const transition = resolveOrientationGate(this.state, false, this.gameplay.getPauseStatus())
      if (
        transition.effect === 'resume-gameplay' &&
        this.gameplay.canResumeFromOrientationGate()
      ) {
        this.gameplay.resume()
      }
      this.gameplay.setUiBlocked(false)
      this.onGateChange?.(false)
    }

    this.objects.forEach((object) => object.destroy())
    this.objects.length = 0
    this.state = createOrientationGateState()
  }

  private readonly readParentViewport = (): ViewportSize => {
    const parent = this.scene.game.canvas.parentElement
    const bounds = parent?.getBoundingClientRect()
    return {
      width: bounds?.width ?? window.innerWidth,
      height: bounds?.height ?? window.innerHeight,
    }
  }

  private createGate(): Phaser.GameObjects.Rectangle {
    const centerX = this.policy.logicalWidth / 2
    const centerY = this.policy.logicalHeight / 2
    const { depth } = this.visuals
    const blocker = this.scene.add
      .rectangle(
        centerX,
        centerY,
        this.policy.logicalWidth,
        this.policy.logicalHeight,
        this.visuals.backgroundColor,
        this.visuals.backgroundAlpha,
      )
      .setDepth(depth)
      .setInteractive()

    blocker.on('pointerdown', this.stopPointerPropagation)
    blocker.on('pointerup', this.stopPointerPropagation)
    blocker.on('pointermove', this.stopPointerPropagation)
    blocker.on('wheel', this.stopPointerPropagation)

    const panel = this.scene.add
      .rectangle(
        centerX,
        centerY,
        this.visuals.panelWidth,
        this.visuals.panelHeight,
        this.visuals.panelColor,
        this.visuals.panelAlpha,
      )
      .setStrokeStyle(this.visuals.panelStrokeWidth, this.visuals.accentColor, 1)
      .setDepth(depth + 1)
    const device = this.scene.add
      .rectangle(
        centerX,
        centerY + this.visuals.deviceOffsetY,
        this.visuals.deviceWidth,
        this.visuals.deviceHeight,
        this.visuals.accentColor,
        0.14,
      )
      .setStrokeStyle(this.visuals.deviceStrokeWidth, this.visuals.accentColor, 1)
      .setDepth(depth + 2)
    const arrow = this.scene.add
      .text(
        centerX + this.visuals.arrowOffsetX,
        centerY + this.visuals.deviceOffsetY,
        '↻',
        {
          color: this.visuals.titleColor,
          fontSize: this.visuals.arrowFontSize,
          fontStyle: 'bold',
        },
      )
      .setOrigin(0.5)
      .setDepth(depth + 2)
    const title = this.scene.add
      .text(centerX, centerY + this.visuals.titleOffsetY, this.visuals.title, {
        color: this.visuals.titleColor,
        fontSize: this.visuals.titleFontSize,
        fontStyle: 'bold',
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(depth + 2)
    const body = this.scene.add
      .text(centerX, centerY + this.visuals.bodyOffsetY, this.visuals.instructions, {
        color: this.visuals.bodyColor,
        fontSize: this.visuals.bodyFontSize,
        align: 'center',
        wordWrap: { width: this.visuals.bodyWrapWidth },
      })
      .setOrigin(0.5)
      .setDepth(depth + 2)

    this.objects.push(blocker, panel, device, arrow, title, body)
    return blocker
  }

  private setVisible(visible: boolean): void {
    this.objects.forEach((object) => object.setVisible(visible))
    if (visible) {
      this.blocker.setInteractive()
      window.addEventListener('keydown', this.blockKeyboardInput, true)
    } else {
      this.blocker.disableInteractive()
      window.removeEventListener('keydown', this.blockKeyboardInput, true)
    }
  }

  private readonly stopPointerPropagation = (
    _pointer: Phaser.Input.Pointer,
    _localX: number,
    _localY: number,
    event: Phaser.Types.Input.EventData,
  ): void => {
    event.stopPropagation()
  }

  private readonly blockKeyboardInput = (event: KeyboardEvent): void => {
    event.preventDefault()
    event.stopImmediatePropagation()
  }
}
