import type { TelemetrySample } from './pitchAnalysis'

export interface FlatSegment {
  startSec: number
  endSec: number
  kind: 'volume-drop' | 'pitch-monotone'
}

const MIN_FLAT_SECONDS = 3
const VOLUME_DROP_THRESHOLD = 15
const PITCH_FLAT_RANGE_HZ = 12

/** Contiguous stretches where volume (0-100 scale) stayed below the drop threshold for 3s+. */
export function findVolumeDrops(telemetry: TelemetrySample[]): FlatSegment[] {
  const segments: FlatSegment[] = []
  let runStart: number | null = null

  for (const sample of telemetry) {
    const isLow = sample.volume < VOLUME_DROP_THRESHOLD
    if (isLow && runStart === null) {
      runStart = sample.t
    } else if (!isLow && runStart !== null) {
      if (sample.t - runStart >= MIN_FLAT_SECONDS) {
        segments.push({ startSec: runStart, endSec: sample.t, kind: 'volume-drop' })
      }
      runStart = null
    }
  }
  const last = telemetry[telemetry.length - 1]
  if (runStart !== null && last && last.t - runStart >= MIN_FLAT_SECONDS) {
    segments.push({ startSec: runStart, endSec: last.t, kind: 'volume-drop' })
  }
  return segments
}

/**
 * Contiguous stretches where the trailing-3s pitch range stayed under the flat
 * threshold — the same rolling-window idea as the live monotone detector,
 * applied retrospectively across the full take's voiced samples.
 */
export function findPitchMonotoneSegments(telemetry: TelemetrySample[]): FlatSegment[] {
  const voiced = telemetry.filter(
    (s): s is TelemetrySample & { pitchHz: number } => s.pitchHz !== null,
  )
  if (voiced.length < 3) return []

  const segments: FlatSegment[] = []
  let windowStart = 0
  let runStart: number | null = null
  let runEnd: number | null = null

  for (let i = 0; i < voiced.length; i++) {
    while (voiced[i].t - voiced[windowStart].t > MIN_FLAT_SECONDS) windowStart++
    const windowSpan = voiced[i].t - voiced[windowStart].t
    const windowPitches = voiced.slice(windowStart, i + 1).map((s) => s.pitchHz)
    const range = Math.max(...windowPitches) - Math.min(...windowPitches)
    const isFlatNow = range < PITCH_FLAT_RANGE_HZ && windowSpan >= MIN_FLAT_SECONDS * 0.8

    if (isFlatNow) {
      if (runStart === null) runStart = voiced[windowStart].t
      runEnd = voiced[i].t
    } else if (runStart !== null && runEnd !== null) {
      segments.push({ startSec: runStart, endSec: runEnd, kind: 'pitch-monotone' })
      runStart = null
      runEnd = null
    }
  }
  if (runStart !== null && runEnd !== null) {
    segments.push({ startSec: runStart, endSec: runEnd, kind: 'pitch-monotone' })
  }
  return segments
}
