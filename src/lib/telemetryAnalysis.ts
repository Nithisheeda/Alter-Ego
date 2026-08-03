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

export interface AuthorityBand {
  baseline: number
  low: number
  high: number
  tensionThreshold: number
}

/**
 * Target vocal bands are anchored to the take's own median pitch rather than
 * a fixed universal range — physiological speaking pitch varies too much
 * across voices for a one-size-fits-all Hz band to mean anything. "Executive
 * Authority" is a controlled range around that personal baseline; well above
 * it is flagged as "High Tension" (the upward pitch creep that shows up under
 * nerves or strain).
 */
export function computeAuthorityBand(telemetry: TelemetrySample[]): AuthorityBand | null {
  const voiced = telemetry.map((s) => s.pitchHz).filter((p): p is number => p !== null)
  if (voiced.length < 4) return null

  const sorted = [...voiced].sort((a, b) => a - b)
  const baseline = sorted[Math.floor(sorted.length / 2)]

  return {
    baseline,
    low: baseline * 0.85,
    high: baseline * 1.2,
    tensionThreshold: baseline * 1.45,
  }
}

export function percentInAuthorityBand(telemetry: TelemetrySample[], band: AuthorityBand): number {
  const voiced = telemetry.map((s) => s.pitchHz).filter((p): p is number => p !== null)
  if (voiced.length === 0) return 0
  const inRange = voiced.filter((p) => p >= band.low && p <= band.high).length
  return Math.round((inRange / voiced.length) * 100)
}
