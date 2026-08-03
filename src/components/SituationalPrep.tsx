import { useEffect, useState } from 'react'
import { generateFeedback, generatePushback, type PushbackQuestion } from '../lib/ai'
import { useDictation } from '../hooks/useDictation'
import { useVoiceDrill } from '../hooks/useVoiceDrill'
import { FeedbackCard } from './FeedbackCard'
import { AudioPlayback } from './AudioPlayback'
import { AudioWave } from './AudioWave'
import { MetricBadge } from './MetricBadge'
import { VocalTelemetryGraph } from './VocalTelemetryGraph'
import type { FutureSelfFeedback, FutureSelfPersona, SpeechMetrics } from '../types'
import type { TelemetrySample } from '../lib/pitchAnalysis'

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

interface ResponseTake {
  metrics: SpeechMetrics
  audioUrl: string | null
  telemetry: TelemetrySample[]
}

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

  // Live Pushback mode
  const [livePushback, setLivePushback] = useState(false)
  const responseRecorder = useVoiceDrill(0)
  const [recordingSlot, setRecordingSlot] = useState<'initial' | 'rebuttal' | null>(null)
  const [initialResponse, setInitialResponse] = useState<ResponseTake | null>(null)
  const [rebuttalResponse, setRebuttalResponse] = useState<ResponseTake | null>(null)
  const [pushbackQuestion, setPushbackQuestion] = useState<PushbackQuestion | null>(null)
  const [pushbackLoading, setPushbackLoading] = useState(false)

  useEffect(() => {
    const metrics = responseRecorder.metrics
    if (!metrics || !recordingSlot) return
    const take: ResponseTake = { metrics, audioUrl: null, telemetry: responseRecorder.telemetry }
    if (recordingSlot === 'initial') setInitialResponse(take)
    else setRebuttalResponse(take)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [responseRecorder.metrics])

  useEffect(() => {
    const audioUrl = responseRecorder.audioUrl
    if (!audioUrl || !recordingSlot) return
    if (recordingSlot === 'initial') {
      setInitialResponse((prev) => (prev ? { ...prev, audioUrl } : prev))
    } else {
      setRebuttalResponse((prev) => (prev ? { ...prev, audioUrl } : prev))
    }
  }, [responseRecorder.audioUrl, recordingSlot])

  useEffect(() => {
    if (!livePushback || !initialResponse || pushbackQuestion || pushbackLoading) return
    void requestPushback()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialResponse])

  async function requestPushback() {
    if (!initialResponse) return
    setPushbackLoading(true)
    try {
      const result = await generatePushback(scenario, initialResponse.metrics.transcript)
      setPushbackQuestion(result)
    } finally {
      setPushbackLoading(false)
    }
  }

  function startInitialRecording() {
    setRecordingSlot('initial')
    setInitialResponse(null)
    setPushbackQuestion(null)
    setRebuttalResponse(null)
    setFeedback(null)
    responseRecorder.start()
  }

  function startRebuttalRecording() {
    setRecordingSlot('rebuttal')
    setRebuttalResponse(null)
    setFeedback(null)
    responseRecorder.start()
  }

  function resetPushbackFlow() {
    responseRecorder.reset()
    setRecordingSlot(null)
    setInitialResponse(null)
    setRebuttalResponse(null)
    setPushbackQuestion(null)
    setFeedback(null)
  }

  function handleToggleLivePushback() {
    resetPushbackFlow()
    setLivePushback((v) => !v)
  }

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

  async function handlePushbackFeedback() {
    if (!rebuttalResponse) return
    setLoading(true)
    setFeedback(null)
    try {
      const result = await generateFeedback(persona, {
        kind: 'situational',
        scenario,
        pushback: pushbackQuestion
          ? { question: pushbackQuestion.question, rebuttalTranscript: rebuttalResponse.metrics.transcript }
          : undefined,
      })
      setFeedback(result)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Situational Mindset Prep</h2>
            <p className="mt-1 text-sm text-white/50">
              Describe the high-stakes moment ahead of you. Type it or drop it in by voice — your
              Future-Self will reframe it.
            </p>
          </div>
          <button
            type="button"
            onClick={handleToggleLivePushback}
            className={`min-h-9 shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              livePushback
                ? 'border-rose-400/60 bg-rose-500/20 text-rose-200'
                : 'border-white/15 bg-white/5 text-white/60 hover:text-white'
            }`}
          >
            {livePushback ? 'Live Pushback: On' : 'Live Pushback'}
          </button>
        </div>

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

        {livePushback ? (
          <div className="mt-5 space-y-5">
            {!initialResponse && (
              <RecorderBlock
                recorder={responseRecorder}
                startLabel="Record Your Response"
                disabled={!scenario.trim()}
                onStart={startInitialRecording}
              />
            )}

            {initialResponse && (
              <ResponseSummary title="Your Initial Response" response={initialResponse} />
            )}

            {initialResponse && pushbackLoading && (
              <p className="text-sm text-white/50">Generating pushback…</p>
            )}

            {pushbackQuestion && (
              <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-4">
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-rose-300">
                  Pushback
                </p>
                <p className="text-sm font-medium leading-relaxed text-rose-100">
                  {pushbackQuestion.question}
                </p>
              </div>
            )}

            {pushbackQuestion && !rebuttalResponse && (
              <RecorderBlock
                recorder={responseRecorder}
                startLabel="Record Your Rebuttal"
                onStart={startRebuttalRecording}
              />
            )}

            {rebuttalResponse && (
              <ResponseSummary title="Your Rebuttal" response={rebuttalResponse} />
            )}

            {rebuttalResponse && !feedback && (
              <button
                type="button"
                onClick={handlePushbackFeedback}
                disabled={loading || !personaReady}
                className="min-h-11 w-full rounded-lg bg-white px-5 py-3 text-sm font-medium text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
              >
                {loading ? 'Consulting your Future-Self…' : 'Get Future-Self Feedback'}
              </button>
            )}

            {(initialResponse || pushbackQuestion) && (
              <button
                type="button"
                onClick={resetPushbackFlow}
                className="text-xs font-medium text-white/40 underline decoration-white/20 underline-offset-2 transition hover:text-white/70"
              >
                Start over
              </button>
            )}
          </div>
        ) : (
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
        )}
      </div>

      {!livePushback && dictation.audioUrl && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-6">
          <h3 className="mb-3 text-sm font-semibold text-white">Re-listen to your voice note</h3>
          <AudioPlayback audioUrl={dictation.audioUrl} label="Your voice note" />
        </div>
      )}

      {feedback && <FeedbackCard feedback={feedback} persona={persona} />}
    </div>
  )
}

function RecorderBlock({
  recorder,
  startLabel,
  onStart,
  disabled,
}: {
  recorder: ReturnType<typeof useVoiceDrill>
  startLabel: string
  onStart: () => void
  disabled?: boolean
}) {
  const recording = recorder.status === 'recording'

  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-4">
      <AudioWave levels={recorder.levels} active={recording} />
      {recording && recorder.monotoneWarning && (
        <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-200">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
          Monotone detected — vary pitch/energy
        </div>
      )}

      <div className="mt-4 flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        {recorder.status === 'idle' || recorder.status === 'error' || recorder.status === 'done' ? (
          <button
            type="button"
            onClick={onStart}
            disabled={disabled}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-violet-500 px-5 py-3 text-sm font-medium text-white transition hover:bg-violet-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto sm:justify-start"
          >
            <span className="h-2 w-2 rounded-full bg-white" />
            {startLabel}
          </button>
        ) : recording ? (
          <button
            type="button"
            onClick={recorder.stop}
            className="recording-ring flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-rose-500 px-5 py-3 text-sm font-medium text-white transition hover:bg-rose-400 active:scale-[0.98] sm:w-auto sm:justify-start"
          >
            <span className="h-2 w-2 rounded-sm bg-white" />
            Stop Recording
          </button>
        ) : (
          <button
            type="button"
            disabled
            className="min-h-11 w-full rounded-lg bg-white/10 px-5 py-3 text-sm font-medium text-white/50 sm:w-auto"
          >
            {recorder.status === 'requesting' ? 'Requesting microphone…' : 'Processing…'}
          </button>
        )}
      </div>

      {recorder.errorMessage && <p className="mt-3 text-sm text-rose-200">{recorder.errorMessage}</p>}
      {recorder.transcriptionWarning && (
        <p className="mt-3 text-xs text-amber-200">{recorder.transcriptionWarning}</p>
      )}
    </div>
  )
}

function ResponseSummary({ title, response }: { title: string; response: ResponseTake }) {
  return (
    <div className="space-y-3">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-white/50">{title}</h4>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricBadge label="Words / Min" value={String(response.metrics.wpm)} />
        <MetricBadge label="Duration" value={`${response.metrics.durationSeconds}s`} />
      </div>
      <VocalTelemetryGraph telemetry={response.telemetry} durationSeconds={response.metrics.durationSeconds} />
      {response.audioUrl && <AudioPlayback audioUrl={response.audioUrl} label={title} />}
    </div>
  )
}
