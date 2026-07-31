export interface FutureSelfPersona {
  name: string
  demeanor: string
  standards: string
  mantra: string
}

export const DEFAULT_PERSONA: FutureSelfPersona = {
  name: '',
  demeanor: '',
  standards: '',
  mantra: '',
}

export interface SpeechMetrics {
  wordCount: number
  durationSeconds: number
  wpm: number
  pauseCount: number
  pauseFrequencyPerMin: number
  longestPauseSeconds: number
  transcript: string
}

export interface FutureSelfFeedback {
  realityCheck: string
  tacticalAdjustment: string
  mindsetReframe: string
  source: 'live' | 'mock'
}

export type DrillSource = 'drill' | 'situational'
