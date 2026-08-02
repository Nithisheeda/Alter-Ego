import type { Take } from '../lib/takes'
import type { ScoredDimension } from '../lib/vocalAnalysis'
import { AudioPlayback } from './AudioPlayback'

interface TakeComparisonCardProps {
  takeA: Take
  takeB: Take
}

export function TakeComparisonCard({ takeA, takeB }: TakeComparisonCardProps) {
  return (
    <div className="rounded-2xl border border-violet-400/20 bg-white/[0.03] p-4 sm:p-6">
      <h3 className="mb-4 text-sm font-semibold text-white">
        Take Comparison — {takeA.label} vs {takeB.label}
      </h3>

      <div className="grid gap-4 sm:grid-cols-2">
        <TakeAudioColumn take={takeA} />
        <TakeAudioColumn take={takeB} />
      </div>

      <div className="mt-5 space-y-3 border-t border-white/10 pt-4">
        <MetricCompareRow label="Words / Min" a={takeA.metrics.wpm} b={takeB.metrics.wpm} />
        <MetricCompareRow
          label="Duration"
          a={takeA.metrics.durationSeconds}
          b={takeB.metrics.durationSeconds}
          unit="s"
        />
        <MetricCompareRow
          label="Pause Frequency"
          a={takeA.metrics.pauseFrequencyPerMin}
          b={takeB.metrics.pauseFrequencyPerMin}
          unit="/min"
        />
      </div>

      <div className="mt-5 space-y-4 border-t border-white/10 pt-4">
        <ScoreCompareRow
          label="Pause Discipline"
          a={takeA.analysis?.pauseDiscipline ?? null}
          b={takeB.analysis?.pauseDiscipline ?? null}
        />
        <ScoreCompareRow
          label="Diction & Clarity"
          a={takeA.analysis?.dictionClarity ?? null}
          b={takeB.analysis?.dictionClarity ?? null}
        />
        <ScoreCompareRow
          label="Pacing & WPM"
          a={takeA.analysis?.pacing ?? null}
          b={takeB.analysis?.pacing ?? null}
        />
        <ScoreCompareRow
          label="Overall"
          a={takeA.analysis ? { score: takeA.analysis.overallScore, label: '', note: '' } : null}
          b={takeB.analysis ? { score: takeB.analysis.overallScore, label: '', note: '' } : null}
          emphasized
        />
      </div>
    </div>
  )
}

function TakeAudioColumn({ take }: { take: Take }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-violet-300">{take.label}</p>
      {take.audioUrl ? (
        <AudioPlayback audioUrl={take.audioUrl} label={take.label} />
      ) : (
        <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-xs text-white/40">
          No audio captured for this take.
        </div>
      )}
    </div>
  )
}

function MetricCompareRow({
  label,
  a,
  b,
  unit = '',
}: {
  label: string
  a: number
  b: number
  unit?: string
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-white/50">{label}</span>
      <span className="font-medium text-white">
        {a}
        {unit} <span className="text-white/30">vs</span> {b}
        {unit}
      </span>
    </div>
  )
}

function ScoreCompareRow({
  label,
  a,
  b,
  emphasized,
}: {
  label: string
  a: ScoredDimension | null
  b: ScoredDimension | null
  emphasized?: boolean
}) {
  const scoreA = a?.score ?? null
  const scoreB = b?.score ?? null
  const winner =
    scoreA !== null && scoreB !== null ? (scoreA > scoreB ? 'a' : scoreB > scoreA ? 'b' : 'tie') : null

  return (
    <div>
      <p
        className={`mb-1.5 text-xs font-medium uppercase tracking-wide ${emphasized ? 'text-white/70' : 'text-white/40'}`}
      >
        {label}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <ScoreBar score={scoreA} highlight={winner === 'a'} />
        <ScoreBar score={scoreB} highlight={winner === 'b'} />
      </div>
    </div>
  )
}

function ScoreBar({ score, highlight }: { score: number | null; highlight: boolean }) {
  return (
    <div
      className={`flex items-center justify-between rounded-lg border px-3 py-2 ${
        highlight ? 'border-emerald-400/40 bg-emerald-500/10' : 'border-white/10 bg-black/20'
      }`}
    >
      <span className="text-sm font-semibold text-white">{score === null ? '—' : `${score}/100`}</span>
      {highlight && <span className="text-[10px] font-medium text-emerald-300">Better</span>}
    </div>
  )
}
