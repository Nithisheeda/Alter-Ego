export function vibrate(pattern: number | number[]) {
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return
  try {
    navigator.vibrate(pattern)
  } catch {
    // Some browsers throw when vibration is unsupported or called outside a
    // trusted gesture — this is a nice-to-have, never worth surfacing.
  }
}
