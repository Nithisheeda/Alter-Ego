import { useCallback, useRef, useState } from 'react'

export function useDictation(onTranscript: (text: string) => void) {
  const [listening, setListening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const recognitionRef = useRef<InstanceType<NonNullable<Window['SpeechRecognition']>> | null>(
    null,
  )

  const supported =
    typeof window !== 'undefined' && Boolean(window.SpeechRecognition ?? window.webkitSpeechRecognition)

  // Called synchronously from the mic button's onClick — iOS WebKit requires
  // SpeechRecognition.start() to run inside the original tap gesture.
  const toggle = useCallback(() => {
    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition
    if (!Ctor) {
      setError('Voice input is not supported in this browser.')
      return
    }

    if (listening) {
      recognitionRef.current?.stop()
      return
    }

    setError(null)
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
    recognition.onend = () => setListening(false)
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
    } catch {
      setError('Voice input could not start — try again or type instead.')
    }
  }, [listening, onTranscript])

  return { listening, toggle, supported, error }
}
