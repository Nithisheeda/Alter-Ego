import { useCallback, useRef, useState } from 'react'
import type { SpeechMetrics } from '../types'

const PAUSE_THRESHOLD_SECONDS = 1.2
const BAR_COUNT = 24

type RecognitionResultLike = {
  isFinal: boolean
  0: { transcript: string }
}

export type DrillStatus = 'idle' | 'requesting' | 'recording' | 'processing' | 'done' | 'error'

interface UseVoiceDrillResult {
  status: DrillStatus
  levels: number[]
  errorMessage: string | null
  metrics: SpeechMetrics | null
  hasSpeechRecognition: boolean
  start: () => Promise<void>
  stop: () => void
  reset: () => void
}

function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length
}

export function useVoiceDrill(fallbackWordCount: number): UseVoiceDrillResult {
  const [status, setStatus] = useState<DrillStatus>('idle')
  const [levels, setLevels] = useState<number[]>(() => new Array(BAR_COUNT).fill(0.05))
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [metrics, setMetrics] = useState<SpeechMetrics | null>(null)

  const streamRef = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const rafRef = useRef<number | null>(null)
  const recognitionRef = useRef<ReturnType<typeof createRecognition> | null>(null)
  const startTimeRef = useRef<number>(0)
  const transcriptRef = useRef<string>('')
  const resultTimestampsRef = useRef<number[]>([])

  const SpeechRecognitionCtor =
    typeof window !== 'undefined' ? window.SpeechRecognition ?? window.webkitSpeechRecognition : undefined

  function createRecognition() {
    if (!SpeechRecognitionCtor) return null
    const recognition = new SpeechRecognitionCtor()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'
    return recognition
  }

  const tickLevels = useCallback(() => {
    const analyser = analyserRef.current
    if (!analyser) return
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
    rafRef.current = requestAnimationFrame(tickLevels)
  }, [])

  const cleanupAudio = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    audioCtxRef.current?.close().catch(() => {})
    audioCtxRef.current = null
    analyserRef.current = null
  }, [])

  const start = useCallback(async () => {
    setErrorMessage(null)
    setMetrics(null)
    setStatus('requesting')
    transcriptRef.current = ''
    resultTimestampsRef.current = []

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const audioCtx = new AudioCtx()
      const source = audioCtx.createMediaStreamSource(stream)
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      audioCtxRef.current = audioCtx
      analyserRef.current = analyser

      const recognition = createRecognition()
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
        recognition.onerror = () => {
          // Non-fatal: recognition can drop out (network, silence) while audio keeps recording.
        }
        try {
          recognition.start()
        } catch {
          recognitionRef.current = null
        }
      }

      startTimeRef.current = performance.now()
      setStatus('recording')
      tickLevels()
    } catch (err) {
      setStatus('error')
      setErrorMessage(
        err instanceof Error
          ? `Microphone access failed: ${err.message}`
          : 'Microphone access failed.',
      )
      cleanupAudio()
    }
  }, [cleanupAudio, tickLevels])

  const stop = useCallback(() => {
    if (status !== 'recording') return
    setStatus('processing')
    const endTime = performance.now()
    const durationSeconds = Math.max(0.5, (endTime - startTimeRef.current) / 1000)

    recognitionRef.current?.stop()
    cleanupAudio()

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
    setStatus('done')
  }, [cleanupAudio, fallbackWordCount, status])

  const reset = useCallback(() => {
    cleanupAudio()
    recognitionRef.current?.abort()
    recognitionRef.current = null
    setStatus('idle')
    setErrorMessage(null)
    setMetrics(null)
    setLevels(new Array(BAR_COUNT).fill(0.05))
  }, [cleanupAudio])

  return {
    status,
    levels,
    errorMessage,
    metrics,
    hasSpeechRecognition: Boolean(SpeechRecognitionCtor),
    start,
    stop,
    reset,
  }
}
