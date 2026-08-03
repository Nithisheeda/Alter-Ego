import { useEffect, useMemo, useRef, useState } from 'react'
import { CUSTOM_PASSAGE_ID, PASSAGES, passageWordCount } from '../lib/passages'
import { autoAnnotate } from '../lib/autoAnnotate'
import { analyzeDelivery } from '../lib/vocalAnalysis'
import { createTakeId, revokeTakeAudio, type Take } from '../lib/takes'
import { computePitchVarianceHz } from '../lib/pitchAnalysis'
import { appendMasteryEntry } from '../lib/masteryLog'
import { useVoiceDrill } from '../hooks/useVoiceDrill'
import { AudioWave } from './AudioWave'
import { AudioPlayback } from './AudioPlayback'
import { VocalTelemetryGraph } from './VocalTelemetryGraph'
import { PassageDisplay } from './PassageDisplay'
import { Teleprompter } from './Teleprompter'
import { MetricBadge } from './MetricBadge'
import { VocalAnalysisCard } from './VocalAnalysisCard'
import { TakeHistoryList } from './TakeHistoryList'
import { TakeComparisonCard } from './TakeComparisonCard'
import { FeedbackCard } from './FeedbackCard'
import { generateFeedback } from '../lib/ai'
import { generateExecutiveAnalysis, type ExecutiveAnalysis } from '../lib/executiveAnalysis'
import { ExecutiveAnalysisCard } from './ExecutiveAnalysisCard'
import { generatePersonaDiagnostic, type PersonaDiagnostic } from '../lib/personaDiagnostic'
import { PersonaDiagnosticCard } from './PersonaDiagnosticCard'
import { generateObserverAnalysis, generateMidDrillCue, type ObserverAnalysis } from '../lib/observerMode'
import { ObserverAnalysisCard } from './ObserverAnalysisCard'
import type { FutureSelfFeedback, FutureSelfPersona, PassagePart } from '../types'

const DEFAULT_TARGET_WPM = 130
const MID_DRILL_CUE_INTERVAL_SECONDS = 15

interface DrillModeProps {
  persona: FutureSelfPersona
  personaReady: boolean
  userFirstName: string
}

export function DrillMode({ persona, personaReady, userFirstName }: DrillModeProps) {
  const [passageId, setPassageId] = useState<string>(PASSAGES[0].id)
  const [customDraft, setCustomDraft] = useState('')
  const [customParts, setCustomParts] = useState<PassagePart[] | null>(null)
  const [teleprompterMode, setTeleprompterMode] = useState(false)
  const [targetWpm, setTargetWpm] = useState(DEFAULT_TARGET_WPM)

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
  const [executiveAnalysis, setExecutiveAnalysis] = useState<ExecutiveAnalysis | null>(null)
  const [executiveLoading, setExecutiveLoading] = useState(false)
  const [scenarioTag, setScenarioTag] = useState('')
  const [personaDiagnostic, setPersonaDiagnostic] = useState<PersonaDiagnostic | null>(null)
  const [personaDiagnosticLoading, setPersonaDiagnosticLoading] = useState(false)
  const [drillGoal, setDrillGoal] = useState('')
  const [observerAnalysis, setObserverAnalysis] = useState<ObserverAnalysis | null>(null)
  const [observerLoading, setObserverLoading] = useState(false)
  const [midDrillCue, setMidDrillCue] = useState<string | null>(null)
  const drillCardRef = useRef<HTMLDivElement>(null)

  const recording = drill.status === 'recording'
  const canRecord = Boolean(activePassage) && !recording

  const analysis = useMemo(
    () =>
      activePassage && drill.metrics
        ? analyzeDelivery(activePassage.parts, drill.metrics, drill.telemetry)
        : null,
    [activePassage, drill.metrics, drill.telemetry],
  )

  // Live elapsed-time ticker driving the teleprompter's auto-scroll pace —
  // independent of useVoiceDrill's own duration bookkeeping since this only
  // needs to be a smooth visual guide, not the metric source of truth.
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  useEffect(() => {
    if (!recording) {
      setElapsedSeconds(0)
      return
    }
    const start = performance.now()
    let raf: number
    const tick = () => {
      setElapsedSeconds((performance.now() - start) / 1000)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [recording])

  // Observer Mode's mid-drill re-cue: a punchy third-person question, rotated
  // on a fixed cadence while recording. Generated locally (no network round
  // trip) since it has to render in real time during the take.
  useEffect(() => {
    if (!recording || !userFirstName.trim()) {
      setMidDrillCue(null)
      return
    }
    let cueIndex = 0
    setMidDrillCue(generateMidDrillCue(userFirstName, cueIndex))
    const interval = setInterval(() => {
      cueIndex += 1
      setMidDrillCue(generateMidDrillCue(userFirstName, cueIndex))
    }, MID_DRILL_CUE_INTERVAL_SECONDS * 1000)
    return () => clearInterval(interval)
  }, [recording, userFirstName])

  // Take history: every completed recording of the current passage/script is
  // kept (not just the latest) so takes can be selected and compared side by
  // side. Cleared whenever the passage or custom script changes.
  const [takes, setTakes] = useState<Take[]>([])
  const [selectedTakeIds, setSelectedTakeIds] = useState<string[]>([])
  const pendingTakeIdRef = useRef<string | null>(null)
  const takesRef = useRef<Take[]>(takes)
  useEffect(() => {
    takesRef.current = takes
  }, [takes])

  useEffect(() => {
    const metrics = drill.metrics
    if (!metrics || !activePassage) return
    const id = createTakeId()
    pendingTakeIdRef.current = id
    setTakes((prev) => [
      ...prev,
      {
        id,
        label: `Take ${prev.length + 1}`,
        passageTitle: activePassage.title,
        createdAt: Date.now(),
        metrics,
        analysis,
        audioUrl: null,
        telemetry: drill.telemetry,
      },
    ])

    appendMasteryEntry({
      id: createTakeId(),
      timestamp: Date.now(),
      passageTitle: activePassage.title,
      wpm: metrics.wpm,
      durationSeconds: metrics.durationSeconds,
      pauseDisciplineScore: analysis?.pauseDiscipline.score ?? null,
      pitchVarianceHz: computePitchVarianceHz(drill.telemetry),
      overallScore: analysis?.overallScore ?? null,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drill.metrics])

  useEffect(() => {
    const audioUrl = drill.audioUrl
    const id = pendingTakeIdRef.current
    if (!audioUrl || !id) return
    setTakes((prev) => prev.map((t) => (t.id === id ? { ...t, audioUrl } : t)))
  }, [drill.audioUrl])

  useEffect(() => {
    return () => revokeTakeAudio(takesRef.current)
  }, [])

  function clearTakeHistory() {
    revokeTakeAudio(takes)
    setTakes([])
    setSelectedTakeIds([])
    pendingTakeIdRef.current = null
  }

  function toggleTakeSelection(id: string) {
    setSelectedTakeIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (prev.length >= 2) return [prev[1], id]
      return [...prev, id]
    })
  }

  const takeA = takes.find((t) => t.id === selectedTakeIds[0])
  const takeB = takes.find((t) => t.id === selectedTakeIds[1])

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

  async function handleRequestExecutiveAnalysis() {
    if (!drill.metrics) return
    setExecutiveLoading(true)
    setExecutiveAnalysis(null)
    try {
      const result = await generateExecutiveAnalysis({
        transcript: drill.metrics.transcript,
        metrics: drill.metrics,
        telemetry: drill.telemetry,
        analysis,
        persona: personaReady ? persona : null,
      })
      setExecutiveAnalysis(result)
    } finally {
      setExecutiveLoading(false)
    }
  }

  async function handleRequestPersonaDiagnostic() {
    if (!drill.metrics || !personaReady) return
    setPersonaDiagnosticLoading(true)
    setPersonaDiagnostic(null)
    try {
      const result = await generatePersonaDiagnostic({
        persona,
        scenarioTag,
        transcript: drill.metrics.transcript,
        metrics: drill.metrics,
        analysis,
      })
      setPersonaDiagnostic(result)
    } finally {
      setPersonaDiagnosticLoading(false)
    }
  }

  async function handleRequestObserverAnalysis() {
    if (!drill.metrics || !userFirstName.trim()) return
    setObserverLoading(true)
    setObserverAnalysis(null)
    try {
      const result = await generateObserverAnalysis({
        userFirstName,
        drillGoal: drillGoal || activePassage?.title || '',
        transcript: drill.metrics.transcript,
        metrics: drill.metrics,
        analysis,
      })
      setObserverAnalysis(result)
    } finally {
      setObserverLoading(false)
    }
  }

  function handleNewAttempt() {
    // Keeps the selected passage — only the recorder/metrics/feedback reset.
    drill.reset()
    setFeedback(null)
    setExecutiveAnalysis(null)
    setPersonaDiagnostic(null)
    setObserverAnalysis(null)
    drillCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function handlePassageChange(nextId: string) {
    clearTakeHistory()
    setPassageId(nextId)
    handleNewAttempt()
  }

  function handleAnnotate() {
    if (!customDraft.trim()) return
    clearTakeHistory()
    setCustomParts(autoAnnotate(customDraft))
    handleNewAttempt()
  }

  function handleEditScript() {
    clearTakeHistory()
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
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTeleprompterMode((v) => !v)}
                  className={`min-h-9 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    teleprompterMode
                      ? 'border-violet-400/60 bg-violet-500/20 text-violet-200'
                      : 'border-white/15 bg-white/5 text-white/60 hover:text-white'
                  }`}
                >
                  {teleprompterMode ? 'Teleprompter: On' : 'Teleprompter View'}
                </button>
                {teleprompterMode && (
                  <label className="flex items-center gap-1.5 text-xs text-white/50">
                    Target WPM
                    <input
                      type="number"
                      min={80}
                      max={220}
                      step={5}
                      value={targetWpm}
                      onChange={(e) => setTargetWpm(Number(e.target.value) || DEFAULT_TARGET_WPM)}
                      className="min-h-9 w-16 rounded-lg border border-white/15 bg-black/30 px-2 py-1 text-sm text-white focus:border-violet-400/50 focus:outline-none"
                    />
                  </label>
                )}
              </div>
              {isCustom && (
                <button
                  type="button"
                  onClick={handleEditScript}
                  disabled={recording}
                  className="text-xs font-medium text-violet-300 underline decoration-violet-400/40 underline-offset-2 transition hover:text-violet-200 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Edit script
                </button>
              )}
            </div>

            {teleprompterMode ? (
              <Teleprompter
                parts={activePassage.parts}
                targetWpm={targetWpm}
                elapsedSeconds={elapsedSeconds}
                active={recording}
              />
            ) : (
              <PassageDisplay parts={activePassage.parts} />
            )}
          </div>
        ) : null}

        {activePassage && (
          <p className="mt-2 text-xs text-white/30">{activeWordCount} words</p>
        )}

        <div className="mt-5">
          <AudioWave levels={drill.levels} active={recording} />
          {recording && drill.monotoneWarning && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-200">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
              Monotone detected — vary pitch/energy
            </div>
          )}
          {recording && midDrillCue && (
            <div className="animate-fade-in-up mt-3 rounded-lg border border-teal-400/30 bg-teal-500/10 px-3 py-2 text-xs font-medium text-teal-200">
              {midDrillCue}
            </div>
          )}
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

        {drill.metrics && (
          <div className="mt-5 flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            {!feedback && (
              <button
                type="button"
                onClick={handleRequestFeedback}
                disabled={feedbackLoading || !personaReady}
                className="min-h-11 w-full rounded-lg bg-white px-5 py-3 text-sm font-medium text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
              >
                {feedbackLoading ? 'Consulting your Future-Self…' : 'Get Future-Self Feedback'}
              </button>
            )}
            {!executiveAnalysis && (
              <button
                type="button"
                onClick={handleRequestExecutiveAnalysis}
                disabled={executiveLoading}
                className="min-h-11 w-full rounded-lg border border-sky-400/40 bg-sky-500/10 px-5 py-3 text-sm font-medium text-sky-200 transition hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
              >
                {executiveLoading ? 'Running executive analysis…' : 'Get Executive Analysis'}
              </button>
            )}
            {!personaDiagnostic && (
              <button
                type="button"
                onClick={handleRequestPersonaDiagnostic}
                disabled={personaDiagnosticLoading || !personaReady}
                className="min-h-11 w-full rounded-lg border border-amber-400/40 bg-amber-500/10 px-5 py-3 text-sm font-medium text-amber-200 transition hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
              >
                {personaDiagnosticLoading ? 'Running self-distancing diagnostic…' : 'Run Persona Diagnostic'}
              </button>
            )}
            {!observerAnalysis && (
              <button
                type="button"
                onClick={handleRequestObserverAnalysis}
                disabled={observerLoading || !userFirstName.trim()}
                className="min-h-11 w-full rounded-lg border border-teal-400/40 bg-teal-500/10 px-5 py-3 text-sm font-medium text-teal-200 transition hover:bg-teal-500/20 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
              >
                {observerLoading ? 'Running observer analysis…' : 'Run Observer Analysis'}
              </button>
            )}
            {!personaReady && (
              <p className="text-xs text-white/40">
                Complete your Future-Self persona above to unlock Future-Self feedback, Mode B
                alter-ego coaching, and the persona diagnostic.
              </p>
            )}
            {!userFirstName.trim() && (
              <p className="text-xs text-white/40">
                Add your first name in Settings to unlock Observer Mode's third-person coaching —
                no full persona required.
              </p>
            )}
          </div>
        )}

        {drill.metrics && personaReady && (
          <div className="mt-3">
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-white/40">
              Target Scenario (optional, for Persona Diagnostic)
            </label>
            <input
              type="text"
              value={scenarioTag}
              onChange={(e) => setScenarioTag(e.target.value)}
              placeholder="e.g. Salary Negotiation, Crisis Update"
              className="min-h-11 w-full max-w-sm rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white placeholder:text-white/25 focus:border-amber-400/50 focus:outline-none focus:ring-1 focus:ring-amber-400/50"
            />
          </div>
        )}

        {drill.metrics && userFirstName.trim() && (
          <div className="mt-3">
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-white/40">
              Current Drill Goal (optional, for Observer Mode)
            </label>
            <input
              type="text"
              value={drillGoal}
              onChange={(e) => setDrillGoal(e.target.value)}
              placeholder={activePassage?.title || 'e.g. Delivering with steady, unhurried control'}
              className="min-h-11 w-full max-w-sm rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white placeholder:text-white/25 focus:border-teal-400/50 focus:outline-none focus:ring-1 focus:ring-teal-400/50"
            />
          </div>
        )}
      </div>

      {analysis && <VocalAnalysisCard analysis={analysis} />}

      {executiveAnalysis && <ExecutiveAnalysisCard analysis={executiveAnalysis} />}

      {personaDiagnostic && (
        <PersonaDiagnosticCard diagnostic={personaDiagnostic} personaName={persona.name.trim() || 'your Future-Self'} />
      )}

      {observerAnalysis && <ObserverAnalysisCard analysis={observerAnalysis} userFirstName={userFirstName} />}

      {drill.audioUrl && drill.metrics && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-6">
          <h3 className="mb-3 text-sm font-semibold text-white">Re-listen to your delivery</h3>
          <div className="space-y-3">
            <VocalTelemetryGraph telemetry={drill.telemetry} durationSeconds={drill.metrics.durationSeconds} />
            <AudioPlayback audioUrl={drill.audioUrl} />
          </div>
        </div>
      )}

      {takes.length > 0 && (
        <TakeHistoryList takes={takes} selectedIds={selectedTakeIds} onToggle={toggleTakeSelection} />
      )}

      {takeA && takeB && <TakeComparisonCard takeA={takeA} takeB={takeB} />}

      {feedback && (
        <FeedbackCard feedback={feedback} persona={persona} onTryAgain={handleNewAttempt} />
      )}
    </div>
  )
}
