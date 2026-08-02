export {}

interface SpeechRecognitionResultLike {
  isFinal: boolean
  0: { transcript: string }
  length: number
}

interface SpeechRecognitionEventLike extends Event {
  resultIndex: number
  results: ArrayLike<SpeechRecognitionResultLike> & {
    item(index: number): SpeechRecognitionResultLike
  }
}

type SpeechRecognitionErrorCode =
  | 'no-speech'
  | 'aborted'
  | 'audio-capture'
  | 'network'
  | 'not-allowed'
  | 'service-not-allowed'
  | 'bad-grammar'
  | 'language-not-supported'
  | (string & {})

interface SpeechRecognitionErrorEventLike extends Event {
  error: SpeechRecognitionErrorCode
  message: string
}

interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  abort(): void
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null
  onend: (() => void) | null
  onstart: (() => void) | null
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike
    webkitSpeechRecognition?: new () => SpeechRecognitionLike
  }
}
