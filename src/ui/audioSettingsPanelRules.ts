import { CONFIG } from '../game.config.js'

export interface SliderState {
  percent: number
  fillPercent: number
  thumbX: number
  label: string
}

export interface SliderGeometry {
  leftX: number
  width: number
}

export function clampAudioPercent(input: number): number {
  if (!Number.isFinite(input)) return 0
  return Math.max(0, Math.min(100, Math.round(input)))
}

export function resolvePanelFillPercent(value: number, geometry: SliderGeometry): SliderState {
  const percent = clampAudioPercent(value)
  const clampedWidth = Math.max(0, Math.min(1, percent / 100))

  return {
    percent,
    fillPercent: clampedWidth,
    thumbX: geometry.leftX + geometry.width * clampedWidth,
    label: `${percent}%`,
  }
}

export function sliderGeometryFromPanel(
  panelX: number,
  panelWidth: number,
): SliderGeometry {
  const leftX = panelX + CONFIG.ui.audioPanel.marginX
  const width = Math.max(0, panelWidth - CONFIG.ui.audioPanel.marginX * 2)

  return {
    leftX,
    width,
  }
}

export function normalizeVolumeText(value: number): string {
  const clamped = clampAudioPercent(value)
  return `${clamped}%`
}

export function formatBestProfileResult(bestLives: number, bestCoins: number, fastestMs: number): string {
  const pace = fastestMs > 0 ? `${Math.round(fastestMs / 1000)}s` : 'unbeaten'
  return `Best Dojo HP ${bestLives}  Best Ryo ${bestCoins}  Fastest ${pace}`
}
