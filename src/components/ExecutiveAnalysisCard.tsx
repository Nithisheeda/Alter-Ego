import type { ExecutiveAnalysis, VocalMechanicsDimension } from '../lib/executiveAnalysis'

interface ExecutiveAnalysisCardProps {
  analysis: ExecutiveAnalysis
}

export function ExecutiveAnalysisCard({ analysis }: ExecutiveAnalysisCardProps) {
  const { vocal_mechanics, mindset_diagnosis, persona_recommendation, alter_ego_evaluation, execution_mode } = analysis

  return (
    <div className="animate-fade-in-up rounded-2xl border border-sky-400/20 bg-gradient-to-b from-sky-500/[0.06] to-transparent p-4 sm:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-white">Executive Voice &amp; Mindset Analysis</p>
          <p className="text-[11px] font-medium text-white/50">
            {execution_mode === 'MODE_B_ALTER_EGO' ? 'Mode B — Persona & Mindset Analysis' : 'Mode A — Pure Speech Analyzer'}
          </p>
          <p className="mt-0.5 text-[11px] text-white/30">
            {execution_mode === 'MODE_B_ALTER_EGO'
              ? 'Vocal mechanics filtered through your active Future-Self persona and mindset coaching.'
              : 'Raw acoustic metrics and speech diagnostics (pitch, tempo, cadence) without persona-based coaching filters.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-sky-400/30 bg-sky-400/10 px-2.5 py-1 text-xs font-semibold text-sky-300">
            Overall {vocal_mechanics.overall_score}/100
          </span>
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
      </div>

      <div className="space-y-4">
        <DimensionRow title="Pacing" dimension={vocal_mechanics.pacing} />
        <DimensionRow title="Pause Discipline" dimension={vocal_mechanics.pause_discipline} />
        <DimensionRow title="Pitch Control" dimension={vocal_mechanics.pitch_control} />
      </div>

      <div className="mt-5 rounded-xl border border-white/10 bg-black/20 p-4">
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-violet-300">
          Mindset Diagnosis · {mindset_diagnosis.core_trigger}
        </p>
        <p className="text-sm leading-relaxed text-white/80">{mindset_diagnosis.analysis}</p>
      </div>

      {persona_recommendation.show_recommendation && (
        <div className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-500/[0.06] p-4">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
            Suggested Alter-Ego · {persona_recommendation.suggested_archetype}
          </p>
          <p className="text-sm leading-relaxed text-white/80">{persona_recommendation.why_recommended}</p>
          <p className="mt-2 text-xs text-white/40">Focus: {persona_recommendation.core_focus}</p>
        </div>
      )}

      {alter_ego_evaluation && (
        <div className="mt-4 rounded-xl border border-rose-400/20 bg-rose-500/[0.06] p-4">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-rose-300">
              {alter_ego_evaluation.persona_name} Evaluates You
            </p>
            <span className="text-xs font-semibold text-white/70">
              {alter_ego_evaluation.alignment_score}% aligned
            </span>
          </div>
          <p className="text-sm font-medium leading-relaxed text-white">
            {alter_ego_evaluation.direct_persona_note}
          </p>
          <p className="mt-2 text-xs text-rose-200">{alter_ego_evaluation.recalibration_cue}</p>
        </div>
      )}
    </div>
  )
}

function DimensionRow({ title, dimension }: { title: string; dimension: VocalMechanicsDimension }) {
  const barColor = dimension.score >= 80 ? 'bg-emerald-400' : dimension.score >= 50 ? 'bg-amber-400' : 'bg-rose-400'

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-white/50">{title}</span>
        <span className="text-xs font-semibold text-white/70">
          {dimension.label} · {dimension.score}/100
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${dimension.score}%` }} />
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-white/50">{dimension.insight}</p>
    </div>
  )
}
