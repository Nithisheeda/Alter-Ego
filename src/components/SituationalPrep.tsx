import { useState } from 'react'
import { generateFeedback } from '../lib/ai'
import { useDictation } from '../hooks/useDictation'
import { FeedbackCard } from './FeedbackCard'
import { AudioPlayback } from './AudioPlayback'
import type { FutureSelfFeedback, FutureSelfPersona } from '../types'

const SCENARIO_PRESETS = [
  {
    label: 'Pricing Pushback',
    prompt:
      "A key client just called our pricing 'unacceptable' and hinted they might walk. I need to hold firm on value without sounding defensive or panicked.",
  },
  {
    label: 'Board Update',
    prompt:
      "I'm delivering a board update in twenty minutes and the metrics are below plan. I need to own the miss and present the recovery plan with total conviction.",
  },
  {
    label: 'Team Hard Truth',
    prompt:
      "I have to tell someone on my team their performance isn't where it needs to be, and this conversation has been avoided for too long.",
  },
  {
    label: 'Investor Q&A',
    prompt:
      "I'm about to open the floor for investor Q&A after my pitch, and I know they're going to press hard on our burn rate and slower-than-projected growth.",
  },
]

interface SituationalPrepProps {
  persona: FutureSelfPersona
  personaReady: boolean
}

export function SituationalPrep({ persona, personaReady }: SituationalPrepProps) {
  const [scenario, setScenario] = useState('')
  const [feedback, setFeedback] = useState<FutureSelfFeedback | null>(null)
  const [loading, setLoading] = useState(false)

  const dictation = useDictation((chunk) =>
    setScenario((prev) => (prev ? `${prev} ${chunk}` : chunk)),
  )

  async function handleSubmit() {
    if (!scenario.trim()) return
    setLoading(true)
    setFeedback(null)
    try {
      const result = await generateFeedback(persona, { kind: 'situational', scenario })
      setFeedback(result)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-white">Situational Mindset Prep</h2>
        <p className="mt-1 text-sm text-white/50">
          Describe the high-stakes moment ahead of you. Type it or drop it in by voice — your
          Future-Self will reframe it.
        </p>

        <div className="-mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {SCENARIO_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => setScenario(preset.prompt)}
              className="min-h-11 shrink-0 whitespace-nowrap rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-xs text-white/60 transition hover:border-violet-400/40 hover:text-white"
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div className="relative mt-4">
          <textarea
            value={scenario}
            onChange={(e) => setScenario(e.target.value)}
            placeholder="Walk me through what's coming up — who's in the room, what's at stake, what you're afraid will happen…"
            rows={6}
            className="min-h-[160px] w-full resize-none rounded-xl border border-white/10 bg-black/30 p-4 pr-14 text-base leading-relaxed text-white placeholder:text-white/25 focus:border-violet-400/50 focus:outline-none focus:ring-1 focus:ring-violet-400/50"
          />
          {dictation.supported && (
            <button
              type="button"
              onClick={dictation.toggle}
              title={dictation.listening ? 'Stop voice input' : 'Speak instead of typing'}
              className={`absolute right-2.5 top-2.5 flex h-11 w-11 items-center justify-center rounded-full border transition ${
                dictation.listening
                  ? 'recording-ring border-rose-400/40 bg-rose-500/20 text-rose-300'
                  : 'border-white/15 bg-white/5 text-white/60 hover:text-white'
              }`}
            >
              <span className={`h-2.5 w-2.5 rounded-full ${dictation.listening ? 'bg-rose-400' : 'bg-white/50'}`} />
            </button>
          )}
        </div>
        {dictation.error && (
          <p className="mt-2 text-xs text-amber-300/80">{dictation.error}</p>
        )}

        <div className="mt-4 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!scenario.trim() || loading || !personaReady}
            className="min-h-11 w-full rounded-lg bg-white px-5 py-3 text-sm font-medium text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
          >
            {loading ? 'Consulting your Future-Self…' : 'Ask My Future-Self'}
          </button>
          {!personaReady && (
            <p className="text-xs text-white/40">Complete your persona above to unlock feedback.</p>
          )}
        </div>
      </div>

      {dictation.audioUrl && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-6">
          <h3 className="mb-3 text-sm font-semibold text-white">Re-listen to your voice note</h3>
          <AudioPlayback audioUrl={dictation.audioUrl} label="Your voice note" />
        </div>
      )}

      {feedback && <FeedbackCard feedback={feedback} persona={persona} />}
    </div>
  )
}
