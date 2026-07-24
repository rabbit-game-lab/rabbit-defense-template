import type Phaser from 'phaser'

/**
 * Binds a Text object to a maximum pixel width. Strings that fit are shown whole;
 * longer ones are ellipsised at the widest prefix that fits.
 *
 * HUD lines are rewritten every frame from live run state, so the length of any
 * given message is not knowable from the layout constants alone. Measuring the
 * real object is what keeps a long status string from running under the action
 * buttons regardless of font, message, or future copy changes.
 */
export function createTextFitter(
  text: Phaser.GameObjects.Text,
  maxWidth: number,
): (raw: string) => void {
  let lastRaw: string | null = null

  return (raw: string): void => {
    // Fitting costs a few layout passes, so only redo it when the source changes.
    if (raw === lastRaw) return
    lastRaw = raw

    text.setText(raw)
    if (text.width <= maxWidth) return

    // Widest prefix that still fits once the ellipsis is added.
    let low = 0
    let high = raw.length
    while (low < high) {
      const mid = Math.ceil((low + high) / 2)
      text.setText(`${raw.slice(0, mid).trimEnd()}…`)
      if (text.width <= maxWidth) low = mid
      else high = mid - 1
    }
    text.setText(low > 0 ? `${raw.slice(0, low).trimEnd()}…` : '')
  }
}
