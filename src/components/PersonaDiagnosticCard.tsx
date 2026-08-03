import type { PersonaDiagnostic } from '../lib/personaDiagnostic'

interface PersonaDiagnosticCardProps {
  diagnostic: PersonaDiagnostic
  personaName: string
}

export function PersonaDiagnosticCard({ diagnostic, personaName }: PersonaDiagnosticCardProps) {
  return (
    <div className="animate-fade-in-up rounded-2xl border border-amber-400/20 bg-gradient-to-b from-amber-500/[0.06] to-transparent p-4 sm:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-white">Self-Distancing Diagnostic</p>
          <p className="text-[11px] text-white/40">Evaluated as {personaName}</p>
        </div>
        <span
          className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
            diagnostic.source === 'live'
              ? 'border-emerald-400/30 text-emerald-300'
              : 'border-amber-400/30 text-amber-300'
          }`}
        >
          {diagnostic.source === 'live' ? 'Live AI' : 'Mock'}
        </span>
      </div>

      <div className="space-y-4">
        <Section title="Mastery Alignment Check" text={diagnostic.masteryAlignmentCheck} />
        <Section title="Scenario Diagnostics" text={diagnostic.scenarioDiagnostics} />
      </div>

      <div className="mt-4 rounded-xl border border-amber-400/30 bg-amber-500/10 p-4">
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-amber-300">
          Key Reflection Question
        </p>
        <p className="text-sm font-medium leading-relaxed text-white">{diagnostic.keyReflectionQuestion}</p>
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
