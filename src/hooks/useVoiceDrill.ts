import { useCallback, useEffect, useRef, useState } from 'react'
import type { SpeechMetrics } from '../types'
import { describeMediaError, pickSupportedAudioMimeType } from '../lib/audioRecording'
import { vibrate } from '../lib/haptics'
import {
  autocorrelatePitch,
  isMonotoneWindow,
  sampleVolume,
  SAMPLE_INTERVAL_MS,
  type DynamicsSample,
  type TelemetrySample,
} from '../lib/pitchAnalysis'
import {
  evaluatePatternInterrupt,
  type PatternInterruptCondition,
  type PatternInterruptResult,
} from '../lib/patternInterrupt'

const PAUSE_THRESHOLD_SECONDS = 1.2
const BAR_COUNT = 24
const PITCH_FFT_SIZE = 2048
const FILLER_WINDOW_SECONDS = 12
const RUSHING_WINDOW_SECONDS = 8
const PATTERN_CHECK_INTERVAL_MS = 1000
// Baseline Warm-Up Period: nothing can trigger before the engine has enough
// signal to calculate a reliable baseline WPM and pitch variance.
const PATTERN_WARMUP_SECONDS = 10
// Dual-Direction Cooldown: an 8s global gap between any two nudges, plus a
// longer 12s gap before the *same* condition can repeat (so a naturally slow
// talker doesn't get "Dragging" fired at them back-to-back).
const PATTERN_GLOBAL_COOLDOWN_MS = 8000
const PATTERN_CONDITION_COOLDOWN_MS = 12000
const PATTERN_NUDGE_VISIBLE_MS = 4000

type RecognitionResultLike = {
  isFinal: boolean
  0: { transcript: string }
}

export type DrillStatus = 'idle' | 'requesting' | 'recording' | 'processing' | 'done' | 'error'

interface UseVoiceDrillResult {
  status: DrillStatus
  levels: number[]
  errorMessage: string | null
  transcriptionWarning: string | null
  metrics: SpeechMetrics | null
  audioUrl: string | null
  telemetry: TelemetrySample[]
  monotoneWarning: boolean
  patternInterrupt: PatternInterruptResult | null
  hasSpeechRecognition: boolean
  start: () => void
  stop: () => void
  reset: () => void
}

function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length
}

function standardDeviation(values: number[]): number {
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length
  return Math.sqrt(variance)
}

const TERMINAL_PUNCTUATION_PATTERN = /[.!?]\s*$/

function createRecognition(Ctor: NonNullable<Window['SpeechRecognition']> | undefined) {
  if (!Ctor) return null
  const recognition = new Ctor()
  recognition.continuous = true
  recognition.interimResults = true
  recognition.lang = 'en-US'
  return recognition
}

export function useVoiceDrill(fallbackWordCount: number): UseVoiceDrillResult {
  const [status, setStatus] = useState<DrillStatus>('idle')
  const [levels, setLevels] = useState<number[]>(() => new Array(BAR_COUNT).fill(0.05))
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [transcriptionWarning, setTranscriptionWarning] = useState<string | null>(null)
  const [metrics, setMetrics] = useState<SpeechMetrics | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [telemetry, setTelemetry] = useState<TelemetrySample[]>([])
  const [monotoneWarning, setMonotoneWarning] = useState(false)
  const [patternInterrupt, setPatternInterrupt] = useState<PatternInterruptResult | null>(null)

  const streamRef = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const pitchAnalyserRef = useRef<AnalyserNode | null>(null)
  const pitchBufferRef = useRef<Float32Array<ArrayBuffer> | null>(null)
  const dynamicsHistoryRef = useRef<DynamicsSample[]>([])
  const telemetryRef = useRef<TelemetrySample[]>([])
  const lastPitchSampleAtRef = useRef(0)
  const rafRef = useRef<number | null>(null)
  const recognitionRef = useRef<NonNullable<ReturnType<typeof createRecognition>> | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const startTimeRef = useRef<number>(0)
  const transcriptRef = useRef<string>('')
  const resultTimestampsRef = useRef<number[]>([])
  const transcriptChunksRef = useRef<Array<{ t: number; text: string }>>([])
  const lastPatternCheckAtRef = useRef(0)
  const lastNudgeAtRef = useRef(0)
  const lastNudgeAtByConditionRef = useRef<Partial<Record<PatternInterruptCondition, number>>>({})
  const nudgeSeedRef = useRef(0)
  const patternInterruptTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const SpeechRecognitionCtor =
    typeof window !== 'undefined' ? window.SpeechRecognition ?? window.webkitSpeechRecognition : undefined

  // Builds the windowed inputs evaluatePatternInterrupt needs from raw
  // telemetry/transcript refs — trailing windows for "recent" behavior,
  // whole-take-so-far for the "baseline" each is measured against.
  const buildPatternInterruptInput = useCallback((now: number) => {
    const nowSec = (now - startTimeRef.current) / 1000
    const chunks = transcriptChunksRef.current

    const recentTranscriptWindow = chunks
      .filter((c) => nowSec - c.t <= FILLER_WINDOW_SECONDS)
      .map((c) => c.text)
      .join(' ')

    const rushingWindowWords = chunks
      .filter((c) => nowSec - c.t <= RUSHING_WINDOW_SECONDS)
      .reduce((sum, c) => sum + countWords(c.text), 0)
    const recentWpm = nowSec >= RUSHING_WINDOW_SECONDS ? (rushingWindowWords / RUSHING_WINDOW_SECONDS) * 60 : null

    const totalWords = chunks.reduce((sum, c) => sum + countWords(c.text), 0)
    const baselineWpm = nowSec >= 5 ? (totalWords / nowSec) * 60 : null

    const history = dynamicsHistoryRef.current
    const recentPitches = history.map((s) => s.pitchHz).filter((p): p is number => p !== null)
    const recentPitchStdDevHz = recentPitches.length >= 4 ? standardDeviation(recentPitches) : null

    const baselinePitches = telemetryRef.current
      .filter((s) => nowSec - s.t > 5)
      .map((s) => s.pitchHz)
      .filter((p): p is number => p !== null)
    const baselinePitchStdDevHz = baselinePitches.length >= 6 ? standardDeviation(baselinePitches) : null

    const lastResultAtMs = resultTimestampsRef.current[resultTimestampsRef.current.length - 1]
    const liveSilenceSeconds = lastResultAtMs !== undefined ? (now - lastResultAtMs) / 1000 : nowSec

    const lastChunk = chunks[chunks.length - 1]
    const lastChunkEndsWithTerminalPunctuation = lastChunk
      ? TERMINAL_PUNCTUATION_PATTERN.test(lastChunk.text.trim())
      : false

    return {
      recentTranscriptWindow,
      recentWpm,
      baselineWpm,
      liveSilenceSeconds,
      lastChunkEndsWithTerminalPunctuation,
      recentPitchStdDevHz,
      baselinePitchStdDevHz,
      nudgeSeed: nudgeSeedRef.current,
    }
  }, [])

  // Runs on every animation frame while recording: redraws the coarse bar
  // visualizer, and — throttled to a few times a second — samples the
  // higher-resolution pitch analyser to update the rolling monotone check.
  const tickLevels = useCallback(() => {
    const analyser = analyserRef.current
    if (analyser) {
      const data = new Uint8Array(analyser.frequencyBinCount)
      analyser.getByteFrequencyData(data)
      const chunk = Math.floor(data.length / BAR_COUNT) || 1
      const next: number[] = []
      for (let i = 0; i < BAR_COUNT; i++) {
        let sum = 0
        for (let j = 0; j < chunk; j++) sum += data[i * chunk + j] ?? 0
        const avg = sum / chunk / 255
        next.push(Math.max(0.05, Math.min(1, avg * 1.6)))
      }
      setLevels(next)
    }

    const pitchAnalyser = pitchAnalyserRef.current
    const now = performance.now()
    if (pitchAnalyser && now - lastPitchSampleAtRef.current >= SAMPLE_INTERVAL_MS) {
      lastPitchSampleAtRef.current = now
      if (!pitchBufferRef.current || pitchBufferRef.current.length !== pitchAnalyser.fftSize) {
        pitchBufferRef.current = new Float32Array(pitchAnalyser.fftSize)
      }
      const buffer = pitchBufferRef.current
      pitchAnalyser.getFloatTimeDomainData(buffer)

      const sampleRate = audioCtxRef.current?.sampleRate ?? 48000
      const pitchHz = autocorrelatePitch(buffer, sampleRate)
      const volume = sampleVolume(buffer)

      const history = dynamicsHistoryRef.current
      history.push({ time: now, pitchHz, volume })
      const windowStart = now - 5000
      while (history.length > 0 && history[0].time < windowStart) history.shift()

      setMonotoneWarning(isMonotoneWindow(history, now))

      telemetryRef.current.push({ t: (now - startTimeRef.current) / 1000, pitchHz, volume })
    }

    const nowSecForWarmup = (now - startTimeRef.current) / 1000
    if (nowSecForWarmup >= PATTERN_WARMUP_SECONDS && now - lastPatternCheckAtRef.current >= PATTERN_CHECK_INTERVAL_MS) {
      lastPatternCheckAtRef.current = now
      const result = evaluatePatternInterrupt(buildPatternInterruptInput(now))
      if (result.triggerDetected && result.conditionType) {
        const conditionType = result.conditionType
        const globalCooldownOk = now - lastNudgeAtRef.current >= PATTERN_GLOBAL_COOLDOWN_MS
        const conditionCooldownOk =
          now - (lastNudgeAtByConditionRef.current[conditionType] ?? -Infinity) >= PATTERN_CONDITION_COOLDOWN_MS
        if (globalCooldownOk && conditionCooldownOk) {
          lastNudgeAtRef.current = now
          lastNudgeAtByConditionRef.current[conditionType] = now
          nudgeSeedRef.current += 1
          if (patternInterruptTimeoutRef.current) clearTimeout(patternInterruptTimeoutRef.current)
          setPatternInterrupt(result)
          patternInterruptTimeoutRef.current = setTimeout(() => setPatternInterrupt(null), PATTERN_NUDGE_VISIBLE_MS)
        }
      }
    }

    rafRef.current = requestAnimationFrame(tickLevels)
  }, [buildPatternInterruptInput])

  // Stops the visualizer (rAF + analyser) without touching the live mic
  // stream, so an in-flight MediaRecorder can still flush its last chunk.
  const stopVisuals = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    audioCtxRef.current?.close().catch(() => {})
    audioCtxRef.current = null
    analyserRef.current = null
    pitchAnalyserRef.current = null
  }, [])

  const stopMediaStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  const cleanupAudio = useCallback(() => {
    stopVisuals()
    stopMediaStream()
  }, [stopVisuals, stopMediaStream])

  // Kicks off the mic-stream + analyser pipeline that drives the wave visualizer,
  // plus a MediaRecorder capturing the take for playback afterward. Separate from
  // SpeechRecognition so a transcription failure never blocks recording.
  const startAudioPipeline = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const AudioCtx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const audioCtx = new AudioCtx()
      const source = audioCtx.createMediaStreamSource(stream)
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      audioCtxRef.current = audioCtx
      analyserRef.current = analyser

      // A second, higher-resolution analyser tapped off the same source —
      // fftSize 256 is too coarse to resolve speaking-range pitch, but
      // reusing the source node means no extra mic stream or permission.
      const pitchAnalyser = audioCtx.createAnalyser()
      pitchAnalyser.fftSize = PITCH_FFT_SIZE
      source.connect(pitchAnalyser)
      pitchAnalyserRef.current = pitchAnalyser
      pitchBufferRef.current = null
      dynamicsHistoryRef.current = []
      telemetryRef.current = []
      lastPitchSampleAtRef.current = 0
      setMonotoneWarning(false)
      setTelemetry([])

      audioChunksRef.current = []
      try {
        const mimeType = pickSupportedAudioMimeType()
        const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) audioChunksRef.current.push(event.data)
        }
        mediaRecorderRef.current = recorder
        recorder.start()
      } catch {
        // Playback just won't be available; the drill itself is unaffected.
        mediaRecorderRef.current = null
      }

      startTimeRef.current = performance.now()
      setStatus('recording')
      tickLevels()
    } catch (err) {
      setStatus('error')
      setErrorMessage(describeMediaError(err))
      cleanupAudio()
      recognitionRef.current?.abort()
      recognitionRef.current = null
    }
  }, [cleanupAudio, tickLevels])

  // Must be called synchronously inside the tap/click handler — iOS WebKit only
  // grants webkitSpeechRecognition.start() a microphone prompt when it runs
  // inside the original user-gesture call stack, not after an awaited promise.
  const start = useCallback(() => {
    vibrate([50])
    setErrorMessage(null)
    setTranscriptionWarning(null)
    setMetrics(null)
    // Note: does not revoke the previous audioUrl — ownership of completed
    // takes' object URLs transfers to the caller (e.g. a take-history list),
    // which is responsible for revoking them when it's done with them.
    setAudioUrl(null)
    setStatus('requesting')
    transcriptRef.current = ''
    resultTimestampsRef.current = []
    transcriptChunksRef.current = []
    lastPatternCheckAtRef.current = 0
    lastNudgeAtRef.current = 0
    lastNudgeAtByConditionRef.current = {}
    nudgeSeedRef.current = 0
    if (patternInterruptTimeoutRef.current) clearTimeout(patternInterruptTimeoutRef.current)
    setPatternInterrupt(null)

    const recognition = createRecognition(SpeechRecognitionCtor)
    recognitionRef.current = recognition

    if (recognition) {
      recognition.onresult = (event) => {
        resultTimestampsRef.current.push(performance.now())
        let finalChunk = ''
        const results = event.results as unknown as ArrayLike<RecognitionResultLike>
        for (let i = event.resultIndex; i < results.length; i++) {
          const result = results[i]
          if (result.isFinal) {
            finalChunk += result[0].transcript + ' '
          }
        }
        if (finalChunk) {
          transcriptRef.current += finalChunk
          transcriptChunksRef.current.push({
            t: (performance.now() - startTimeRef.current) / 1000,
            text: finalChunk,
          })
        }
      }
      recognition.onerror = (event) => {
        switch (event.error) {
          case 'no-speech':
          case 'aborted':
            return
          case 'not-allowed':
          case 'service-not-allowed':
            recognitionRef.current = null
            setTranscriptionWarning(
              'Speech-to-text permission was blocked — recording continues, but pace will be estimated instead of measured.',
            )
            return
          default:
            setTranscriptionWarning(
              'Speech-to-text dropped out — recording continues, but pace may be estimated instead of measured.',
            )
        }
      }
      try {
        recognition.start()
      } catch {
        recognitionRef.current = null
        setTranscriptionWarning(
          'Speech-to-text could not start — recording continues, but pace will be estimated instead of measured.',
        )
      }
    }

    void startAudioPipeline()
  }, [SpeechRecognitionCtor, startAudioPipeline])

  const stop = useCallback(() => {
    if (status !== 'recording') return
    vibrate([50, 50])
    setStatus('processing')
    setMonotoneWarning(false)
    const endTime = performance.now()
    const durationSeconds = Math.max(0.5, (endTime - startTimeRef.current) / 1000)

    recognitionRef.current?.stop()
    stopVisuals()

    const recorder = mediaRecorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        audioChunksRef.current = []
        // Ownership transfers to the caller — see the note in start().
        setAudioUrl(blob.size > 0 ? URL.createObjectURL(blob) : null)
        stopMediaStream()
      }
      recorder.stop()
    } else {
      stopMediaStream()
    }

    const transcript = transcriptRef.current.trim()
    const timestamps = resultTimestampsRef.current

    let pauseCount = 0
    let longestPauseSeconds = 0
    for (let i = 1; i < timestamps.length; i++) {
      const gap = (timestamps[i] - timestamps[i - 1]) / 1000
      if (gap >= PAUSE_THRESHOLD_SECONDS) {
        pauseCount += 1
        longestPauseSeconds = Math.max(longestPauseSeconds, gap)
      }
    }

    const usedFallback = transcript.length === 0
    const wordCount = usedFallback ? fallbackWordCount : countWords(transcript)
    const wpm = Math.round((wordCount / durationSeconds) * 60)
    const pauseFrequencyPerMin = Number(((pauseCount / durationSeconds) * 60).toFixed(1))

    setMetrics({
      wordCount,
      durationSeconds: Number(durationSeconds.toFixed(1)),
      wpm,
      pauseCount,
      pauseFrequencyPerMin,
      longestPauseSeconds: Number(longestPauseSeconds.toFixed(1)),
      transcript: usedFallback ? '' : transcript,
    })
    setTelemetry([...telemetryRef.current])
    setStatus('done')
  }, [fallbackWordCount, status, stopMediaStream, stopVisuals])

  const reset = useCallback(() => {
    cleanupAudio()
    recognitionRef.current?.abort()
    recognitionRef.current = null
    mediaRecorderRef.current = null
    audioChunksRef.current = []
    setStatus('idle')
    setErrorMessage(null)
    setTranscriptionWarning(null)
    setMetrics(null)
    setLevels(new Array(BAR_COUNT).fill(0.05))
    setMonotoneWarning(false)
    setTelemetry([])
    if (patternInterruptTimeoutRef.current) clearTimeout(patternInterruptTimeoutRef.current)
    setPatternInterrupt(null)
    // Does not revoke — see the note in start().
    setAudioUrl(null)
  }, [cleanupAudio])

  useEffect(() => {
    return () => {
      cleanupAudio()
      recognitionRef.current?.abort()
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop()
      }
      if (patternInterruptTimeoutRef.current) clearTimeout(patternInterruptTimeoutRef.current)
    }
  }, [cleanupAudio])

  return {
    status,
    levels,
    errorMessage,
    transcriptionWarning,
    metrics,
    audioUrl,
    telemetry,
    monotoneWarning,
    patternInterrupt,
    hasSpeechRecognition: Boolean(SpeechRecognitionCtor),
    start,
    stop,
    reset,
  }
}
