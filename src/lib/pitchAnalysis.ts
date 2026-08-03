export const MONOTONE_WINDOW_SECONDS = 5
const SAMPLE_INTERVAL_MS = 250
const MIN_VOICED_SAMPLES = 6
const PITCH_FLAT_THRESHOLD_HZ = 12
const VOLUME_FLAT_THRESHOLD = 6

export interface DynamicsSample {
  time: number
  pitchHz: number | null
  volume: number
}

/** A single pitch/volume reading anchored to seconds elapsed since recording start. */
export interface TelemetrySample {
  t: number
  pitchHz: number | null
  volume: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/**
 * Compact autocorrelation pitch detector (the standard "ACF2+" approach used
 * in browser tuner demos): trims leading/trailing near-silence, autocorrelates
 * the remaining signal, and reads the fundamental period off the first strong
 * peak after the initial downward slope. Returns null when the signal is too
 * quiet or the result falls outside typical speaking pitch (60–500Hz).
 */
export function autocorrelatePitch(buffer: Float32Array<ArrayBuffer>, sampleRate: number): number | null {
  const size = buffer.length
  let sumSquares = 0
  for (let i = 0; i < size; i++) sumSquares += buffer[i] * buffer[i]
  const rms = Math.sqrt(sumSquares / size)
  if (rms < 0.01) return null

  const threshold = 0.2
  let start = 0
  for (let i = 0; i < size / 2; i++) {
    if (Math.abs(buffer[i]) < threshold) {
      start = i
      break
    }
  }
  let end = size - 1
  for (let i = 1; i < size / 2; i++) {
    if (Math.abs(buffer[size - i]) < threshold) {
      end = size - i
      break
    }
  }

  const trimmed = buffer.slice(start, end)
  const n = trimmed.length
  if (n < 8) return null

  const correlations = new Float64Array(n)
  for (let lag = 0; lag < n; lag++) {
    let sum = 0
    for (let i = 0; i < n - lag; i++) sum += trimmed[i] * trimmed[i + lag]
    correlations[lag] = sum
  }

  let d = 0
  while (d < n - 1 && correlations[d] > correlations[d + 1]) d++

  let maxValue = -1
  let maxPos = -1
  for (let i = d; i < n; i++) {
    if (correlations[i] > maxValue) {
      maxValue = correlations[i]
      maxPos = i
    }
  }
  if (maxPos <= 0) return null

  const freq = sampleRate / maxPos
  if (freq < 60 || freq > 500) return null
  return freq
}

export function sampleVolume(buffer: Float32Array<ArrayBuffer>): number {
  let sumSquares = 0
  for (let i = 0; i < buffer.length; i++) sumSquares += buffer[i] * buffer[i]
  const rms = Math.sqrt(sumSquares / buffer.length)
  if (rms <= 0) return 0
  // Rough perceptual 0-100 scale from an approximate dBFS reading.
  return clamp(20 * Math.log10(rms) + 100, 0, 100)
}

export { SAMPLE_INTERVAL_MS }

/**
 * "Monotone" is judged from the trailing MONOTONE_WINDOW_SECONDS of samples:
 * once the window is full, if both pitch range and volume range stay under
 * their flatness thresholds, energy has been flat for the full window.
 */
export function isMonotoneWindow(history: DynamicsSample[], now: number): boolean {
  if (history.length === 0) return false
  const spanMs = now - history[0].time
  if (spanMs < MONOTONE_WINDOW_SECONDS * 1000 * 0.8) return false

  const pitches = history.map((s) => s.pitchHz).filter((p): p is number => p !== null)
  if (pitches.length < MIN_VOICED_SAMPLES) return false

  const volumes = history.map((s) => s.volume)
  const pitchRange = Math.max(...pitches) - Math.min(...pitches)
  const volumeRange = Math.max(...volumes) - Math.min(...volumes)

  return pitchRange < PITCH_FLAT_THRESHOLD_HZ && volumeRange < VOLUME_FLAT_THRESHOLD
}

/** Overall pitch range (max-min) across a take's voiced samples — a simple variance proxy. */
export function computePitchVarianceHz(telemetry: TelemetrySample[]): number | null {
  const voiced = telemetry.map((s) => s.pitchHz).filter((p): p is number => p !== null)
  if (voiced.length < 2) return null
  return Math.round(Math.max(...voiced) - Math.min(...voiced))
}
