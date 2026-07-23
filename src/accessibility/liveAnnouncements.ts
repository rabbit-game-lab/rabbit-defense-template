export type AnnouncementPriority = 'polite' | 'assertive'

export interface AnnouncementOptions {
  priority?: AnnouncementPriority
  throttleKey?: string
  throttleMs?: number
}

const DEFAULT_THROTTLE_MS = 1200
const lastAnnouncementAt = new Map<string, number>()

export function shouldAnnounce(
  key: string,
  now: number,
  throttleMs: number,
  history: ReadonlyMap<string, number>,
): boolean {
  const previous = history.get(key)
  return previous === undefined || now - previous >= Math.max(0, throttleMs)
}

function getRegion(priority: AnnouncementPriority): HTMLElement | null {
  if (typeof document === 'undefined') return null
  const id = priority === 'assertive' ? 'game-live-urgent' : 'game-live-status'
  return document.getElementById(id)
}

export function initializeGameAccessibility(canvas?: HTMLCanvasElement): void {
  if (typeof document === 'undefined') return
  const gameCanvas = canvas ?? document.querySelector<HTMLCanvasElement>('#game-container canvas')
  if (!gameCanvas) return

  gameCanvas.tabIndex = 0
  gameCanvas.setAttribute('role', 'application')
  gameCanvas.setAttribute('aria-label', 'Hidden Dojo Defense game')
  gameCanvas.setAttribute('aria-describedby', 'game-instructions')
}

export function announce(message: string, options: AnnouncementOptions = {}): boolean {
  const text = message.trim()
  if (!text) return false

  const now = Date.now()
  const key = options.throttleKey ?? text
  const throttleMs = options.throttleMs ?? DEFAULT_THROTTLE_MS
  if (!shouldAnnounce(key, now, throttleMs, lastAnnouncementAt)) return false

  const region = getRegion(options.priority ?? 'polite')
  if (!region) return false
  lastAnnouncementAt.set(key, now)

  region.textContent = ''
  window.setTimeout(() => {
    region.textContent = text
  }, 0)
  return true
}

export function announceRaid(raid: number, total: number): boolean {
  return announce(`Raid ${raid} of ${total} beginning.`, {
    throttleKey: `raid-${raid}`,
    throttleMs: 0,
  })
}

export function announceHpLoss(amount: number, remaining: number): boolean {
  return announce(`Dojo lost ${amount} health. ${remaining} health remaining.`, {
    priority: 'assertive',
    throttleKey: 'hp-loss',
  })
}

export function announcePlacement(message: string): boolean {
  return announce(message, { throttleKey: 'placement', throttleMs: 500 })
}

export function announceResult(victory: boolean): boolean {
  return announce(victory ? 'Victory. The dojo is safe.' : 'Defeat. The dojo has fallen.', {
    priority: 'assertive',
    throttleKey: 'run-result',
    throttleMs: 0,
  })
}
