import { useState } from 'react'
import { generateFeedback } from '../lib/ai'
import { useDictation } from '../hooks/useDictation'
import { FeedbackCard } from './FeedbackCard'
import type { FutureSelfFeedback, FutureSelfPersona } from '../types'

const PROMPTS = [
  'Pitching to investors',
  'Having a hard team conversation',
  'Negotiating a raise',
  'Delivering bad news to a client',
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
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <h2 className="text-lg font-semibold text-white">Situational Mindset Prep</h2>
        <p className="mt-1 text-sm text-white/50">
          Describe the high-stakes moment ahead of you. Type it or drop it in by voice — your
          Future-Self will reframe it.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => setScenario(prompt + ': ')}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/60 transition hover:border-violet-400/40 hover:text-white"
            >
              {prompt}
            </button>
          ))}
        </div>

        <div className="relative mt-4">
          <textarea
            value={scenario}
            onChange={(e) => setScenario(e.target.value)}
            placeholder="Walk me through what's coming up — who's in the room, what's at stake, what you're afraid will happen…"
            rows={6}
            className="w-full resize-none rounded-xl border border-white/10 bg-black/30 p-4 pr-12 text-sm leading-relaxed text-white placeholder:text-white/25 focus:border-violet-400/50 focus:outline-none focus:ring-1 focus:ring-violet-400/50"
          />
          {dictation.supported && (
            <button
              type="button"
              onClick={dictation.toggle}
              title={dictation.listening ? 'Stop voice input' : 'Speak instead of typing'}
              className={`absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full border transition ${
                dictation.listening
                  ? 'recording-ring border-rose-400/40 bg-rose-500/20 text-rose-300'
                  : 'border-white/15 bg-white/5 text-white/60 hover:text-white'
              }`}
            >
              <span className={`h-2.5 w-2.5 rounded-full ${dictation.listening ? 'bg-rose-400' : 'bg-white/50'}`} />
            </button>
          )}
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!scenario.trim() || loading || !personaReady}
            className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? 'Consulting your Future-Self…' : 'Ask My Future-Self'}
          </button>
          {!personaReady && (
            <p className="text-xs text-white/40">Complete your persona above to unlock feedback.</p>
          )}
        </div>
      </div>

      {feedback && <FeedbackCard feedback={feedback} persona={persona} />}
    </div>
  )
}
