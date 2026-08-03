import { useCallback, useEffect, useRef, useState } from 'react'

export type TtsRate = 1 | 1.25

export function useSpeechSynthesis() {
  const [speaking, setSpeaking] = useState(false)
  const [rate, setRate] = useState<TtsRate>(1)
  const rateRef = useRef<TtsRate>(1)

  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window

  const stop = useCallback(() => {
    if (!supported) return
    window.speechSynthesis.cancel()
    setSpeaking(false)
  }, [supported])

  const speak = useCallback(
    (text: string, atRate: TtsRate = rateRef.current) => {
      if (!supported || !text.trim()) return
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = atRate
      utterance.onend = () => setSpeaking(false)
      utterance.onerror = () => setSpeaking(false)
      window.speechSynthesis.speak(utterance)
      setSpeaking(true)
    },
    [supported],
  )

  const toggle = useCallback(
    (text: string) => {
      if (speaking) {
        stop()
      } else {
        speak(text)
      }
    },
    [speaking, stop, speak],
  )

  const changeRate = useCallback(
    (nextRate: TtsRate, text: string) => {
      setRate(nextRate)
      rateRef.current = nextRate
      if (speaking) speak(text, nextRate)
    },
    [speaking, speak],
  )

  useEffect(() => {
    return () => {
      if (supported) window.speechSynthesis.cancel()
    }
  }, [supported])

  return { supported, speaking, rate, toggle, changeRate, stop }
}
