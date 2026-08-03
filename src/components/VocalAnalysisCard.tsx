import type { ReactNode } from 'react'
import type { DeliveryAnalysis, ScoredDimension } from '../lib/vocalAnalysis'

interface VocalAnalysisCardProps {
  analysis: DeliveryAnalysis
}

export function VocalAnalysisCard({ analysis }: VocalAnalysisCardProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-white">Vocal Mechanics Breakdown</h3>
        {analysis.overallScore !== null && (
          <span className="rounded-full border border-violet-400/30 bg-violet-400/10 px-2.5 py-1 text-xs font-semibold text-violet-300">
            Overall {analysis.overallScore}/100
          </span>
        )}
      </div>

      <div className="space-y-4">
        <DimensionRow title="Pause Discipline" dimension={analysis.pauseDiscipline} />
        <DimensionRow
          title="Diction & Clarity"
          dimension={analysis.dictionClarity}
          extra={
            analysis.dictionClarity.missedWords.length > 0 ? (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {analysis.dictionClarity.missedWords.map((word) => (
                  <span
                    key={word}
                    className="rounded border border-amber-400/30 bg-amber-500/10 px-1.5 py-0.5 text-[11px] text-amber-200"
                  >
                    {word}
                  </span>
                ))}
              </div>
            ) : null
          }
        />
        <DimensionRow title="Pacing & WPM" dimension={analysis.pacing} />
        <DimensionRow title="Pitch Range Control" dimension={analysis.pitchControl} />
      </div>
    </div>
  )
}

function DimensionRow({
  title,
  dimension,
  extra,
}: {
  title: string
  dimension: ScoredDimension
  extra?: ReactNode
}) {
  const score = dimension.score
  const unmeasured = score === null
  const barColor = score === null
    ? 'bg-white/15'
    : score >= 80
      ? 'bg-emerald-400'
      : score >= 50
        ? 'bg-amber-400'
        : 'bg-rose-400'

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-white/50">{title}</span>
        <span className="text-xs font-semibold text-white/70">
          {unmeasured ? dimension.label : `${dimension.label} · ${score}/100`}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${unmeasured ? 100 : score}%` }}
        />
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-white/50">{dimension.note}</p>
      {extra}
    </div>
  )
}
