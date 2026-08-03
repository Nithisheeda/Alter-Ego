import { useMemo } from 'react'
import type { TelemetrySample } from '../lib/pitchAnalysis'
import { findPitchMonotoneSegments, findVolumeDrops } from '../lib/telemetryAnalysis'

interface VocalTelemetryGraphProps {
  telemetry: TelemetrySample[]
  durationSeconds: number
}

const WIDTH = 600
const HEIGHT = 96

export function VocalTelemetryGraph({ telemetry, durationSeconds }: VocalTelemetryGraphProps) {
  const volumeDrops = useMemo(() => findVolumeDrops(telemetry), [telemetry])
  const pitchFlats = useMemo(() => findPitchMonotoneSegments(telemetry), [telemetry])

  if (telemetry.length < 2) {
    return (
      <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-white/40">
        Not enough signal captured to chart pitch and volume for this take.
      </div>
    )
  }

  const span = Math.max(durationSeconds, telemetry[telemetry.length - 1].t, 0.1)
  const voicedPitches = telemetry.map((s) => s.pitchHz).filter((p): p is number => p !== null)
  const pitchMin = voicedPitches.length ? Math.min(...voicedPitches) : 60
  const pitchMax = voicedPitches.length ? Math.max(...voicedPitches) : 500
  const pitchRange = Math.max(1, pitchMax - pitchMin)

  const xFor = (t: number) => (t / span) * WIDTH
  const yForVolume = (v: number) => HEIGHT - (v / 100) * HEIGHT
  const yForPitch = (p: number) => HEIGHT - ((p - pitchMin) / pitchRange) * HEIGHT

  const volumePath = telemetry
    .map((s, i) => `${i === 0 ? 'M' : 'L'} ${xFor(s.t).toFixed(1)} ${yForVolume(s.volume).toFixed(1)}`)
    .join(' ')

  let pitchPath = ''
  let drawing = false
  for (const sample of telemetry) {
    if (sample.pitchHz === null) {
      drawing = false
      continue
    }
    pitchPath += `${drawing ? 'L' : 'M'} ${xFor(sample.t).toFixed(1)} ${yForPitch(sample.pitchHz).toFixed(1)} `
    drawing = true
  }

  const flaggedSegments = [...volumeDrops, ...pitchFlats]

  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-white/40">
        <span className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-sky-400" /> Pitch (Hz)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-400" /> Volume (dB)
          </span>
        </span>
      </div>

      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" className="h-24 w-full">
        {flaggedSegments.map((seg, i) => (
          <rect
            key={i}
            x={xFor(seg.startSec)}
            y={0}
            width={Math.max(1, xFor(seg.endSec) - xFor(seg.startSec))}
            height={HEIGHT}
            fill={seg.kind === 'volume-drop' ? 'rgba(251,191,36,0.14)' : 'rgba(248,113,113,0.14)'}
          />
        ))}
        <path d={volumePath} fill="none" stroke="#34d399" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        {pitchPath && (
          <path d={pitchPath} fill="none" stroke="#38bdf8" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        )}
      </svg>

      {flaggedSegments.length > 0 && (
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/40">
          {volumeDrops.length > 0 && (
            <span className="inline-flex items-center gap-1.5 text-amber-300">
              <span className="h-2 w-2 rounded-sm bg-amber-400/60" />
              {volumeDrops.length} volume dip{volumeDrops.length === 1 ? '' : 's'} over 3s
            </span>
          )}
          {pitchFlats.length > 0 && (
            <span className="inline-flex items-center gap-1.5 text-rose-300">
              <span className="h-2 w-2 rounded-sm bg-rose-400/60" />
              {pitchFlats.length} monotone stretch{pitchFlats.length === 1 ? '' : 'es'} over 3s
            </span>
          )}
        </p>
      )}
    </div>
  )
}
