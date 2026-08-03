/**
 * In-drill pattern-interrupt engine: breaks speech autopilot (filler words,
 * rushing, monotone drift) during LIVE recording. This has to run many times
 * a second against raw telemetry with zero network latency, so — like
 * Observer Mode's mid-drill cue — it's pure local signal analysis, not an
 * LLM call. useVoiceDrill builds the windowed inputs from its raw telemetry/
 * transcript refs each tick and hands them to evaluatePatternInterrupt here.
 */

export type PatternInterruptCondition = 'FILLER' | 'RUSHING' | 'MONOTONE'

export interface PatternInterruptResult {
  triggerDetected: boolean
  conditionType: PatternInterruptCondition | null
  interruptNudgeText: string | null
}

export interface PatternInterruptInput {
  /** Transcript spoken within the trailing FILLER_WINDOW_SECONDS. */
  recentTranscriptWindow: string
  /** WPM over a short trailing window (rushing is a recent spike, not a session average). */
  recentWpm: number | null
  /** WPM averaged over the whole take so far, as the "baseline" rushing is measured against. */
  baselineWpm: number | null
  /** Pitch range (Hz) over the trailing few seconds. */
  recentPitchVarianceHz: number | null
  /** Pitch range (Hz) over the take so far, excluding the trailing window above. */
  baselinePitchVarianceHz: number | null
  /** Rotates which nudge phrase is picked so back-to-back triggers of the same
   * condition don't repeat the exact same line. */
  nudgeSeed: number
}

const FILLER_WORDS = ['um', 'uh', 'like', 'you know', 'sort of', 'kind of', 'basically', 'actually']
const FILLER_DENSITY_THRESHOLD = 3
const RUSHING_SPIKE_RATIO = 1.2
const MONOTONE_VARIANCE_RATIO = 0.5
const MIN_VOICED_SAMPLE_HZ = 20

function countFillerWords(text: string): number {
  if (!text) return 0
  const lower = text.toLowerCase()
  return FILLER_WORDS.reduce((count, word) => {
    const matches = lower.match(new RegExp(`\\b${word}\\b`, 'g'))
    return count + (matches?.length ?? 0)
  }, 0)
}

const FILLER_NUDGES = ['Freeze—where is the pause?', 'Catch that word. Now stop.', 'Say nothing for two seconds.']
const RUSHING_NUDGES = ['Who are you rushing for?', "What's chasing you right now?", 'Slow the room down.']
const MONOTONE_NUDGES = ['Drop your voice one octave now.', 'Surprise them. Change pitch.', 'Wake the last word up.']

function pickNudge(pool: string[], seed: number): string {
  return pool[((seed % pool.length) + pool.length) % pool.length]
}

const NO_TRIGGER: PatternInterruptResult = { triggerDetected: false, conditionType: null, interruptNudgeText: null }

export function evaluatePatternInterrupt(input: PatternInterruptInput): PatternInterruptResult {
  if (countFillerWords(input.recentTranscriptWindow) > FILLER_DENSITY_THRESHOLD) {
    return { triggerDetected: true, conditionType: 'FILLER', interruptNudgeText: pickNudge(FILLER_NUDGES, input.nudgeSeed) }
  }

  if (input.baselineWpm && input.recentWpm && input.recentWpm > input.baselineWpm * RUSHING_SPIKE_RATIO) {
    return { triggerDetected: true, conditionType: 'RUSHING', interruptNudgeText: pickNudge(RUSHING_NUDGES, input.nudgeSeed) }
  }

  if (
    input.baselinePitchVarianceHz !== null &&
    input.recentPitchVarianceHz !== null &&
    input.baselinePitchVarianceHz >= MIN_VOICED_SAMPLE_HZ &&
    input.recentPitchVarianceHz < input.baselinePitchVarianceHz * MONOTONE_VARIANCE_RATIO
  ) {
    return { triggerDetected: true, conditionType: 'MONOTONE', interruptNudgeText: pickNudge(MONOTONE_NUDGES, input.nudgeSeed) }
  }

  return NO_TRIGGER
}
