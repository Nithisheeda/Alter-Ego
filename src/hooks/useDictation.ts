import { useCallback, useEffect, useRef, useState } from 'react'
import { pickSupportedAudioMimeType } from '../lib/audioRecording'
import { vibrate } from '../lib/haptics'

export function useDictation(onTranscript: (text: string) => void) {
  const [listening, setListening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const recognitionRef = useRef<InstanceType<NonNullable<Window['SpeechRecognition']>> | null>(
    null,
  )
  const streamRef = useRef<MediaStream | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const audioUrlRef = useRef<string | null>(null)

  useEffect(() => {
    audioUrlRef.current = audioUrl
  }, [audioUrl])

  const supported =
    typeof window !== 'undefined' && Boolean(window.SpeechRecognition ?? window.webkitSpeechRecognition)

  const stopAudioCapture = useCallback(() => {
    const recorder = mediaRecorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop()
    } else {
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [])

  // Best-effort and independent of SpeechRecognition — runs after the
  // gesture-critical recognition.start() call, so a failure here (or on
  // browsers without MediaRecorder) never blocks dictation itself.
  const startAudioCapture = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      audioChunksRef.current = []
      const mimeType = pickSupportedAudioMimeType()
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data)
      }
      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        audioChunksRef.current = []
        setAudioUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev)
          return blob.size > 0 ? URL.createObjectURL(blob) : null
        })
        streamRef.current?.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
      mediaRecorderRef.current = recorder
      recorder.start()
    } catch {
      // No playback available this time; dictation continues via SpeechRecognition alone.
    }
  }, [])

  // Called synchronously from the mic button's onClick — iOS WebKit requires
  // SpeechRecognition.start() to run inside the original tap gesture.
  const toggle = useCallback(() => {
    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition
    if (!Ctor) {
      setError('Voice input is not supported in this browser.')
      return
    }

    if (listening) {
      vibrate([50, 50])
      recognitionRef.current?.stop()
      return
    }

    vibrate([50])
    setError(null)
    setAudioUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })

    const recognition = new Ctor()
    recognition.continuous = true
    recognition.interimResults = false
    recognition.lang = 'en-US'
    recognition.onresult = (event) => {
      let finalChunk = ''
      const results = event.results
      for (let i = event.resultIndex; i < results.length; i++) {
        const result = results.item ? results.item(i) : (results as unknown as Record<number, { isFinal: boolean; 0: { transcript: string } }>)[i]
        if (result.isFinal) finalChunk += result[0].transcript + ' '
      }
      if (finalChunk) onTranscript(finalChunk.trim())
    }
    recognition.onend = () => {
      setListening(false)
      stopAudioCapture()
    }
    recognition.onerror = (event) => {
      setListening(false)
      switch (event.error) {
        case 'no-speech':
        case 'aborted':
          return
        case 'not-allowed':
        case 'service-not-allowed':
          setError('Microphone access was blocked. Allow it in your browser settings and try again.')
          return
        default:
          setError('Voice input dropped out — try again or type instead.')
      }
    }

    try {
      recognitionRef.current = recognition
      recognition.start()
      setListening(true)
      void startAudioCapture()
    } catch {
      setError('Voice input could not start — try again or type instead.')
    }
  }, [listening, onTranscript, startAudioCapture, stopAudioCapture])

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop())
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop()
      }
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current)
    }
  }, [])

  return { listening, toggle, supported, error, audioUrl }
}
