export interface FutureSelfPersona {
  name: string
  demeanor: string
  standards: string
  mantra: string
  /** The specific friction point this persona has already mastered, e.g. "Unshakable calm under aggressive cross-examination". Anchors competence-based coaching rather than generic tone-matching. */
  masteryDomain: string
}

export const DEFAULT_PERSONA: FutureSelfPersona = {
  name: '',
  demeanor: '',
  standards: '',
  mantra: '',
  masteryDomain: '',
}

/** A persona saved to the user's library — the scenario-to-persona
 * recommendation engine picks among these, distinct from whichever one is
 * currently active in App state. */
export interface SavedPersona extends FutureSelfPersona {
  id: string
}

export type PassagePart =
  | { type: 'text'; text: string }
  | { type: 'power'; text: string }
  | { type: 'diction'; text: string }
  | { type: 'pause'; seconds: number }

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
