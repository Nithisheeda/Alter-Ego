import { useMemo, useState } from 'react'
import { PASSAGES } from '../lib/passages'
import { useVoiceDrill } from '../hooks/useVoiceDrill'
import { AudioWave } from './AudioWave'
import { MetricBadge } from './MetricBadge'
import { FeedbackCard } from './FeedbackCard'
import { generateFeedback } from '../lib/ai'
import type { FutureSelfFeedback, FutureSelfPersona } from '../types'

interface DrillModeProps {
  persona: FutureSelfPersona
  personaReady: boolean
}

export function DrillMode({ persona, personaReady }: DrillModeProps) {
  const [passageId, setPassageId] = useState(PASSAGES[0].id)
  const passage = useMemo(() => PASSAGES.find((p) => p.id === passageId)!, [passageId])
  const passageWordCount = useMemo(
    () => passage.text.trim().split(/\s+/).filter(Boolean).length,
    [passage],
  )

  const drill = useVoiceDrill(passageWordCount)
  const [feedback, setFeedback] = useState<FutureSelfFeedback | null>(null)
  const [feedbackLoading, setFeedbackLoading] = useState(false)

  const recording = drill.status === 'recording'

  async function handleRequestFeedback() {
    if (!drill.metrics) return
    setFeedbackLoading(true)
    setFeedback(null)
    try {
      const result = await generateFeedback(persona, {
        kind: 'drill',
        passageTitle: passage.title,
        metrics: drill.metrics,
      })
      setFeedback(result)
    } finally {
      setFeedbackLoading(false)
    }
  }

  function handleNewAttempt() {
    drill.reset()
    setFeedback(null)
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Structured Speech Drill</h2>
            <p className="mt-1 text-sm text-white/50">
              Read the passage aloud. Your Future-Self is listening for pace and hesitation.
            </p>
          </div>
          <select
            value={passageId}
            onChange={(e) => {
              setPassageId(e.target.value)
              handleNewAttempt()
            }}
            disabled={recording}
            className="min-h-11 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-base text-white focus:border-violet-400/50 focus:outline-none sm:w-auto"
          >
            {PASSAGES.map((p) => (
              <option key={p.id} value={p.id} className="bg-[#16161e]">
                {p.title}
              </option>
            ))}
          </select>
        </div>

        <div className="min-h-[140px] rounded-xl border border-white/10 bg-black/20 p-4 text-[15px] leading-relaxed text-white/80 sm:p-5">
          {passage.text}
        </div>
        <p className="mt-2 text-xs text-white/30">{passageWordCount} words</p>

        <div className="mt-5">
          <AudioWave levels={drill.levels} active={recording} />
        </div>

        <div className="mt-5 flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          {drill.status === 'idle' || drill.status === 'error' ? (
            <button
              type="button"
              onClick={drill.start}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-violet-500 px-5 py-3 text-sm font-medium text-white transition hover:bg-violet-400 active:scale-[0.98] sm:w-auto sm:justify-start"
            >
              <span className="h-2 w-2 rounded-full bg-white" />
              Start Recording
            </button>
          ) : recording ? (
            <button
              type="button"
              onClick={drill.stop}
              className="recording-ring flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-rose-500 px-5 py-3 text-sm font-medium text-white transition hover:bg-rose-400 active:scale-[0.98] sm:w-auto sm:justify-start"
            >
              <span className="h-2 w-2 rounded-sm bg-white" />
              Stop Recording
            </button>
          ) : drill.status === 'requesting' || drill.status === 'processing' ? (
            <button
              type="button"
              disabled
              className="min-h-11 w-full rounded-lg bg-white/10 px-5 py-3 text-sm font-medium text-white/50 sm:w-auto"
            >
              {drill.status === 'requesting' ? 'Requesting microphone…' : 'Processing…'}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleNewAttempt}
              className="min-h-11 w-full rounded-lg border border-white/15 px-5 py-3 text-sm font-medium text-white/80 transition hover:bg-white/5 sm:w-auto"
            >
              Try Again
            </button>
          )}

          {!drill.hasSpeechRecognition && (
            <span className="text-xs text-amber-300/80">
              Voice-to-text unavailable in this browser — WPM will be estimated from passage length.
            </span>
          )}
          {drill.errorMessage && (
            <span className="text-xs text-rose-300">{drill.errorMessage}</span>
          )}
        </div>

        {drill.metrics && (
          <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricBadge
              label="Words / Min"
              value={String(drill.metrics.wpm)}
              tone={drill.metrics.wpm > 165 || drill.metrics.wpm < 110 ? 'warn' : 'good'}
            />
            <MetricBadge
              label="Pause Frequency"
              value={`${drill.metrics.pauseFrequencyPerMin}/min`}
              tone={drill.metrics.pauseCount > 4 ? 'warn' : 'good'}
            />
            <MetricBadge label="Duration" value={`${drill.metrics.durationSeconds}s`} />
            <MetricBadge label="Longest Pause" value={`${drill.metrics.longestPauseSeconds}s`} />
          </div>
        )}

        {drill.metrics && !feedback && (
          <div className="mt-5">
            <button
              type="button"
              onClick={handleRequestFeedback}
              disabled={feedbackLoading || !personaReady}
              className="min-h-11 w-full rounded-lg bg-white px-5 py-3 text-sm font-medium text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
            >
              {feedbackLoading ? 'Consulting your Future-Self…' : 'Get Future-Self Feedback'}
            </button>
            {!personaReady && (
              <p className="mt-2 text-xs text-white/40">
                Complete your Future-Self persona above to unlock feedback.
              </p>
            )}
          </div>
        )}
      </div>

      {feedback && <FeedbackCard feedback={feedback} persona={persona} />}
    </div>
  )
}
