import { useCallback, useRef, useState } from 'react'

export function useDictation(onTranscript: (text: string) => void) {
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef<InstanceType<NonNullable<Window['SpeechRecognition']>> | null>(
    null,
  )

  const supported =
    typeof window !== 'undefined' && Boolean(window.SpeechRecognition ?? window.webkitSpeechRecognition)

  const toggle = useCallback(() => {
    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition
    if (!Ctor) return

    if (listening) {
      recognitionRef.current?.stop()
      return
    }

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
    recognition.onerror = () => setListening(false)

    recognitionRef.current = recognition
    recognition.start()
    setListening(true)
  }, [listening, onTranscript])

  return { listening, toggle, supported }
}
