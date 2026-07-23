import Phaser from 'phaser'
import { CONFIG } from '../game.config'
import {
  PortraitOrientationGate,
  type OrientationGameplayAdapter,
  type PortraitOrientationGateVisuals,
} from './PortraitOrientationGate'

const visuals: PortraitOrientationGateVisuals = {
  ...CONFIG.ui.orientationGate,
  accentColor: CONFIG.world.accentColor,
  titleColor: CONFIG.ui.textColor,
  bodyColor: CONFIG.ui.hud.infoTextColor,
}

export function createPortraitOrientationGate(
  scene: Phaser.Scene,
  gameplay: OrientationGameplayAdapter,
  onGateChange?: (active: boolean) => void,
): PortraitOrientationGate {
  return new PortraitOrientationGate({
    scene,
    gameplay,
    onGateChange,
    viewportPolicy: {
      logicalWidth: CONFIG.screen.width,
      logicalHeight: CONFIG.screen.height,
      minimumLandscapeWidth: CONFIG.ui.orientationGate.minimumLandscapeWidth,
      minimumLandscapeHeight: CONFIG.ui.orientationGate.minimumLandscapeHeight,
    },
    visuals,
  })
}

export function createInactiveGameplayAdapter(): OrientationGameplayAdapter {
  return {
    getPauseStatus: () => 'inactive',
    pause: () => undefined,
    resume: () => undefined,
    canResumeFromOrientationGate: () => false,
    setUiBlocked: () => undefined,
  }
}
