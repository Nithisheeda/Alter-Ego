import { useEffect, useState } from 'react'
import { loadMasteryLog, summarizeMasteryLog } from '../lib/masteryLog'

interface MasteryAnalyticsDrawerProps {
  open: boolean
  onClose: () => void
}

export function MasteryAnalyticsDrawer({ open, onClose }: MasteryAnalyticsDrawerProps) {
  const [summary, setSummary] = useState(() => summarizeMasteryLog(loadMasteryLog()))

  useEffect(() => {
    if (open) setSummary(summarizeMasteryLog(loadMasteryLog()))
  }, [open])

  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  const totalMinutes = Math.round(summary.totalSecondsSpoken / 60)

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden="true"
        className={`fixed inset-0 z-40 bg-black/60 transition-opacity ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Mastery Analytics"
        className={`fixed right-0 top-0 z-50 h-full w-full max-w-sm overflow-y-auto border-l border-white/10 bg-[#0e0e15] p-5 shadow-2xl transition-transform duration-300 sm:p-6 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Mastery Analytics</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-white/60 transition hover:text-white"
          >
            ✕
          </button>
        </div>

        {summary.totalReps === 0 ? (
          <p className="text-sm text-white/50">
            No reps logged yet. Complete a Structured Speech Drill take to start tracking your
            progress.
          </p>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3">
              <StatTile label="Total Reps" value={String(summary.totalReps)} />
              <StatTile label="Time Spoken" value={`${totalMinutes}m`} />
            </div>

            <TrendBlock
              title="Average WPM"
              average={summary.averageWpm}
              values={summary.recentWpm}
              color="#c084fc"
              unit=""
            />
            <TrendBlock
              title="Average Pause Discipline"
              average={summary.averagePauseDiscipline}
              values={summary.recentPauseDiscipline}
              color="#34d399"
              unit="/100"
            />
            <TrendBlock
              title="Average Pitch Variance"
              average={summary.averagePitchVarianceHz}
              values={summary.recentPitchVariance}
              color="#38bdf8"
              unit="Hz"
            />

            <p className="text-[11px] text-white/30">
              Trend lines cover your last {Math.min(10, summary.totalReps)} take
              {summary.totalReps === 1 ? '' : 's'}. Stored only on this device.
            </p>
          </div>
        )}
      </div>
    </>
  )
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
      <p className="text-[10px] font-medium uppercase tracking-wider text-white/40">{label}</p>
      <p className="mt-0.5 text-xl font-semibold text-white">{value}</p>
    </div>
  )
}

function TrendBlock({
  title,
  average,
  values,
  color,
  unit,
}: {
  title: string
  average: number | null
  values: number[]
  color: string
  unit: string
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-white/50">{title}</p>
        <p className="text-sm font-semibold text-white">
          {average === null ? '—' : `${average}${unit}`}
        </p>
      </div>
      <Sparkline values={values} color={color} />
    </div>
  )
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) {
    return <p className="text-[11px] text-white/30">Not enough takes yet to chart a trend.</p>
  }

  const width = 240
  const height = 40
  const max = Math.max(...values)
  const min = Math.min(...values)
  const range = Math.max(1, max - min)
  const points = values
    .map((v, i) => `${(i / (values.length - 1)) * width},${height - ((v - min) / range) * height}`)
    .join(' ')

  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="h-10 w-full">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
