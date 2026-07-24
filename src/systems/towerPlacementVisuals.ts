export function computeTowerLevelScale(level: number): number {
  return 1 + Math.max(0, level - 1) * 0.08
}
