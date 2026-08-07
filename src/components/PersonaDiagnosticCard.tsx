import type { PersonaDiagnostic } from '../lib/personaDiagnostic'

interface PersonaDiagnosticCardProps {
  diagnostic: PersonaDiagnostic
  personaName: string
}

export function PersonaDiagnosticCard({ diagnostic, personaName }: PersonaDiagnosticCardProps) {
  const dc = diagnostic.deterministicConstraints

  return (
    <div className="animate-fade-in-up rounded-2xl border border-amber-400/20 bg-gradient-to-b from-amber-500/[0.06] to-transparent p-4 sm:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-white">Persona Diagnostic</p>
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

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <VerdictPill label="Duration" passed={dc.duration_passed} />
        <VerdictPill label="Hedging" passed={dc.hedge_passed} />
        {dc.tone_preset && (
          <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-white/60">
            Tone: {dc.tone_preset}
          </span>
        )}
      </div>

      <div className="space-y-4">
        <Section title="Constraint Verdict" text={diagnostic.constraintVerdict} accent />
        <Section title="Mastery Alignment Check & Diagnostics" text={diagnostic.masteryAlignmentCheck} />
        <Section title="Alter-Ego Interrogative Coaching" text={diagnostic.interrogativeCoaching} />
      </div>

      <div className="mt-4 rounded-xl border border-amber-400/30 bg-amber-500/10 p-4">
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-amber-300">
          Recommended Refinement
        </p>
        <p className="whitespace-pre-line text-sm font-medium leading-relaxed text-white">
          {diagnostic.recommendedRefinement}
        </p>
      </div>
    </div>
  )
}

function VerdictPill({ label, passed }: { label: string; passed: boolean | null }) {
  const style =
    passed === null
      ? 'border-white/15 bg-white/5 text-white/40'
      : passed
        ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300'
        : 'border-rose-400/30 bg-rose-500/10 text-rose-300'
  const text = passed === null ? `${label}: Not Set` : passed ? `${label}: Passed` : `${label}: Broken`

  return (
    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide ${style}`}>
      {text}
    </span>
  )
}

function Section({ title, text, accent }: { title: string; text: string; accent?: boolean }) {
  return (
    <div
      className={`rounded-xl border p-4 ${accent ? 'border-amber-400/20 bg-amber-500/[0.04]' : 'border-white/10 bg-black/20'}`}
    >
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/50">{title}</p>
      <p className="whitespace-pre-line text-sm leading-relaxed text-white/80">{text}</p>
    </div>
  )
}
