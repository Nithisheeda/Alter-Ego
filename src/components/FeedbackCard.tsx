import type { FutureSelfFeedback, FutureSelfPersona } from '../types'

interface FeedbackCardProps {
  feedback: FutureSelfFeedback
  persona: FutureSelfPersona
  onTryAgain?: () => void
}

export function FeedbackCard({ feedback, persona, onTryAgain }: FeedbackCardProps) {
  const name = persona.name.trim() || 'Your Future-Self'

  return (
    <div className="animate-fade-in-up rounded-2xl border border-violet-400/20 bg-gradient-to-b from-violet-500/[0.07] to-transparent p-4 sm:p-6">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-500/20 text-sm font-semibold text-violet-300">
            {name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-semibold text-white">{name} speaks</p>
            <p className="text-[11px] text-white/40">Future-Self diagnostics</p>
          </div>
        </div>
        <span
          className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
            feedback.source === 'live'
              ? 'border-emerald-400/30 text-emerald-300'
              : 'border-amber-400/30 text-amber-300'
          }`}
        >
          {feedback.source === 'live' ? 'Live AI' : 'Mock'}
        </span>
      </div>

      <div className="space-y-4">
        <FeedbackBlock
          label="The Reality Check"
          accent="border-rose-400/30 text-rose-300"
          text={feedback.realityCheck}
        />
        <FeedbackBlock
          label="The Tactical Adjustment"
          accent="border-sky-400/30 text-sky-300"
          text={feedback.tacticalAdjustment}
        />
        <FeedbackBlock
          label="The Mindset Reframe"
          accent="border-violet-400/30 text-violet-300"
          text={feedback.mindsetReframe}
          emphasized
        />
      </div>

      {onTryAgain && (
        <div className="mt-6 border-t border-white/10 pt-5">
          <button
            type="button"
            onClick={onTryAgain}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-violet-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-400 active:scale-[0.98]"
          >
            <RetryIcon />
            Try Again — New Take
          </button>
        </div>
      )}
    </div>
  )
}

function RetryIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M3 12a9 9 0 1 1 2.64 6.36" />
      <path d="M3 21v-6h6" />
    </svg>
  )
}

function FeedbackBlock({
  label,
  accent,
  text,
  emphasized,
}: {
  label: string
  accent: string
  text: string
  emphasized?: boolean
}) {
  return (
    <div>
      <span
        className={`mb-1.5 inline-block rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${accent}`}
      >
        {label}
      </span>
      <p
        className={`text-sm leading-relaxed ${emphasized ? 'font-medium text-white' : 'text-white/75'}`}
      >
        {text}
      </p>
    </div>
  )
}
