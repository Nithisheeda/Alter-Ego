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

const PAUSE_THRESHOLD_SECONDS = 1.2
const BAR_COUNT = 24
const PITCH_FFT_SIZE = 2048

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

  const SpeechRecognitionCtor =
    typeof window !== 'undefined' ? window.SpeechRecognition ?? window.webkitSpeechRecognition : undefined

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

    rafRef.current = requestAnimationFrame(tickLevels)
  }, [])

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
        if (finalChunk) transcriptRef.current += finalChunk
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
    hasSpeechRecognition: Boolean(SpeechRecognitionCtor),
    start,
    stop,
    reset,
  }
}
