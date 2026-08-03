import type { PersonaAlignmentScore } from '../lib/personaAlignmentScore'

interface PersonaAlignmentScoreCardProps {
  alignment: PersonaAlignmentScore
  personaName: string
}

export function PersonaAlignmentScoreCard({ alignment, personaName }: PersonaAlignmentScoreCardProps) {
  const barColor = alignment.score >= 80 ? 'bg-emerald-400' : alignment.score >= 50 ? 'bg-amber-400' : 'bg-rose-400'

  return (
    <div className="animate-fade-in-up rounded-2xl border border-rose-400/20 bg-gradient-to-b from-rose-500/[0.06] to-transparent p-4 sm:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-white">Persona Alignment Score</p>
          <p className="text-[11px] text-white/40">Evaluated against {personaName}</p>
        </div>
        <span
          className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
            alignment.source === 'live'
              ? 'border-emerald-400/30 text-emerald-300'
              : 'border-amber-400/30 text-amber-300'
          }`}
        >
          {alignment.source === 'live' ? 'Live AI' : 'Mock'}
        </span>
      </div>

      <div className="mb-5">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-white/50">Alignment</span>
          <span className="text-sm font-semibold text-white">{alignment.score}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
          <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${alignment.score}%` }} />
        </div>
      </div>

      <div className="space-y-3">
        <Section title="Cadence Match" text={alignment.cadenceMatch} />
        <Section title="Composure Index" text={alignment.composureIndex} />
        <Section title="Strategic Alignment" text={alignment.strategicAlignment} />
      </div>
    </div>
  )
}

function Section({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-4">
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/50">{title}</p>
      <p className="whitespace-pre-line text-sm leading-relaxed text-white/80">{text}</p>
    </div>
  )
}
