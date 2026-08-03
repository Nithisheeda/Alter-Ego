import type { ObserverAnalysis } from '../lib/observerMode'

interface ObserverAnalysisCardProps {
  analysis: ObserverAnalysis
  userFirstName: string
}

export function ObserverAnalysisCard({ analysis, userFirstName }: ObserverAnalysisCardProps) {
  const name = userFirstName.trim() || 'the speaker'

  return (
    <div className="animate-fade-in-up rounded-2xl border border-teal-400/20 bg-gradient-to-b from-teal-500/[0.06] to-transparent p-4 sm:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-white">Observer Mode</p>
          <p className="text-[11px] text-white/40">Third-person self-distancing for {name}</p>
        </div>
        <span
          className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
            analysis.source === 'live'
              ? 'border-emerald-400/30 text-emerald-300'
              : 'border-amber-400/30 text-amber-300'
          }`}
        >
          {analysis.source === 'live' ? 'Live AI' : 'Mock'}
        </span>
      </div>

      <div className="rounded-xl border border-white/10 bg-black/20 p-4">
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/50">
          Observer Analysis for {name}
        </p>
        <p className="whitespace-pre-line text-sm leading-relaxed text-white/80">{analysis.observerAnalysis}</p>
      </div>

      <div className="mt-4 rounded-xl border border-teal-400/30 bg-teal-500/10 p-4">
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-teal-300">
          Next-Take Calibration
        </p>
        <p className="text-sm font-medium leading-relaxed text-white">{analysis.nextTakeCalibration}</p>
      </div>
    </div>
  )
}
