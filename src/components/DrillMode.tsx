import { useMemo, useRef, useState } from 'react'
import { CUSTOM_PASSAGE_ID, PASSAGES, passageWordCount } from '../lib/passages'
import { autoAnnotate } from '../lib/autoAnnotate'
import { analyzeDelivery } from '../lib/vocalAnalysis'
import { useVoiceDrill } from '../hooks/useVoiceDrill'
import { AudioWave } from './AudioWave'
import { AudioPlayback } from './AudioPlayback'
import { PassageDisplay } from './PassageDisplay'
import { MetricBadge } from './MetricBadge'
import { VocalAnalysisCard } from './VocalAnalysisCard'
import { FeedbackCard } from './FeedbackCard'
import { generateFeedback } from '../lib/ai'
import type { FutureSelfFeedback, FutureSelfPersona, PassagePart } from '../types'

interface DrillModeProps {
  persona: FutureSelfPersona
  personaReady: boolean
}

export function DrillMode({ persona, personaReady }: DrillModeProps) {
  const [passageId, setPassageId] = useState<string>(PASSAGES[0].id)
  const [customDraft, setCustomDraft] = useState('')
  const [customParts, setCustomParts] = useState<PassagePart[] | null>(null)

  const isCustom = passageId === CUSTOM_PASSAGE_ID
  const builtInPassage = useMemo(() => PASSAGES.find((p) => p.id === passageId), [passageId])
  const activePassage = useMemo(() => {
    if (isCustom) return customParts ? { title: 'Custom Drill', parts: customParts } : null
    return builtInPassage ? { title: builtInPassage.title, parts: builtInPassage.parts } : null
  }, [isCustom, customParts, builtInPassage])

  const activeWordCount = activePassage ? passageWordCount(activePassage.parts) : 0

  const drill = useVoiceDrill(activeWordCount)
  const [feedback, setFeedback] = useState<FutureSelfFeedback | null>(null)
  const [feedbackLoading, setFeedbackLoading] = useState(false)
  const drillCardRef = useRef<HTMLDivElement>(null)

  const recording = drill.status === 'recording'
  const canRecord = Boolean(activePassage) && !recording

  const analysis = useMemo(
    () => (activePassage && drill.metrics ? analyzeDelivery(activePassage.parts, drill.metrics) : null),
    [activePassage, drill.metrics],
  )

  async function handleRequestFeedback() {
    if (!drill.metrics || !activePassage) return
    setFeedbackLoading(true)
    setFeedback(null)
    try {
      const result = await generateFeedback(persona, {
        kind: 'drill',
        passageTitle: activePassage.title,
        metrics: drill.metrics,
        analysis: analysis ?? undefined,
      })
      setFeedback(result)
    } finally {
      setFeedbackLoading(false)
    }
  }

  function handleNewAttempt() {
    // Keeps the selected passage — only the recorder/metrics/feedback reset.
    drill.reset()
    setFeedback(null)
    drillCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function handlePassageChange(nextId: string) {
    setPassageId(nextId)
    handleNewAttempt()
  }

  function handleAnnotate() {
    if (!customDraft.trim()) return
    setCustomParts(autoAnnotate(customDraft))
    handleNewAttempt()
  }

  function handleEditScript() {
    setCustomParts(null)
    handleNewAttempt()
  }

  return (
    <div className="space-y-6">
      <div ref={drillCardRef} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Structured Speech Drill</h2>
            <p className="mt-1 text-sm text-white/50">
              Read the passage aloud. Your Future-Self is listening for pace, pause discipline, and diction.
            </p>
          </div>
          <select
            value={passageId}
            onChange={(e) => handlePassageChange(e.target.value)}
            disabled={recording}
            className="min-h-11 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-base text-white focus:border-violet-400/50 focus:outline-none sm:w-auto"
          >
            {PASSAGES.map((p) => (
              <option key={p.id} value={p.id} className="bg-[#16161e]">
                {p.title}
              </option>
            ))}
            <option value={CUSTOM_PASSAGE_ID} className="bg-[#16161e]">
              Custom Drill
            </option>
          </select>
        </div>

        {isCustom && !customParts ? (
          <div>
            <textarea
              value={customDraft}
              onChange={(e) => setCustomDraft(e.target.value)}
              placeholder="Paste your keynote, pitch, or meeting script here — we'll auto-mark pauses, power words, and tricky diction."
              rows={7}
              className="min-h-[180px] w-full resize-none rounded-xl border border-white/10 bg-black/30 p-4 text-base leading-relaxed text-white placeholder:text-white/25 focus:border-violet-400/50 focus:outline-none focus:ring-1 focus:ring-violet-400/50"
            />
            <button
              type="button"
              onClick={handleAnnotate}
              disabled={!customDraft.trim()}
              className="mt-3 min-h-11 w-full rounded-lg bg-violet-500 px-5 py-3 text-sm font-medium text-white transition hover:bg-violet-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
            >
              Annotate &amp; Use This Script
            </button>
          </div>
        ) : activePassage ? (
          <div>
            <PassageDisplay parts={activePassage.parts} />
            {isCustom && (
              <button
                type="button"
                onClick={handleEditScript}
                disabled={recording}
                className="mt-2 text-xs font-medium text-violet-300 underline decoration-violet-400/40 underline-offset-2 transition hover:text-violet-200 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Edit script
              </button>
            )}
          </div>
        ) : null}

        {activePassage && (
          <p className="mt-2 text-xs text-white/30">{activeWordCount} words</p>
        )}

        <div className="mt-5">
          <AudioWave levels={drill.levels} active={recording} />
        </div>

        <div className="mt-5 flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          {drill.status === 'idle' || drill.status === 'error' ? (
            <button
              type="button"
              onClick={drill.start}
              disabled={!canRecord}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-violet-500 px-5 py-3 text-sm font-medium text-white transition hover:bg-violet-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto sm:justify-start"
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
        </div>

        {drill.errorMessage && (
          <div className="mt-4 flex flex-col items-start gap-3 rounded-xl border border-rose-400/30 bg-rose-500/10 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-rose-200">{drill.errorMessage}</p>
            <button
              type="button"
              onClick={drill.start}
              className="min-h-11 w-full shrink-0 rounded-lg border border-rose-300/40 px-4 py-2.5 text-sm font-medium text-rose-100 transition hover:bg-rose-500/20 sm:w-auto"
            >
              Retry
            </button>
          </div>
        )}

        {drill.transcriptionWarning && (
          <p className="mt-4 rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-xs text-amber-200">
            {drill.transcriptionWarning}
          </p>
        )}

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

      {analysis && <VocalAnalysisCard analysis={analysis} />}

      {drill.audioUrl && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-6">
          <h3 className="mb-3 text-sm font-semibold text-white">Re-listen to your delivery</h3>
          <AudioPlayback audioUrl={drill.audioUrl} />
        </div>
      )}

      {feedback && (
        <FeedbackCard feedback={feedback} persona={persona} onTryAgain={handleNewAttempt} />
      )}
    </div>
  )
}

