/**
 * In-drill pattern-interrupt engine: breaks speech autopilot (rushing,
 * dragging, filler words, monotone drift) during LIVE recording. This has to
 * run many times a second against raw telemetry with zero network latency,
 * so — like Observer Mode's mid-drill cue — it's pure local signal analysis,
 * not an LLM call. useVoiceDrill builds the windowed inputs from its raw
 * telemetry/transcript refs each tick and hands them to
 * evaluatePatternInterrupt here; cooldown/warm-up bookkeeping (stateful,
 * tied to a specific recording take) lives in the hook, not here.
 */

export type PatternInterruptCondition = 'RUSHING' | 'DRAGGING' | 'FILLER' | 'MONOTONE'

export interface PatternInterruptResult {
  triggerDetected: boolean
  conditionType: PatternInterruptCondition | null
  interruptNudgeText: string | null
}

export interface PatternInterruptInput {
  /** Transcript spoken within the trailing FILLER_WINDOW_SECONDS. */
  recentTranscriptWindow: string
  /** WPM over a short trailing window (rushing/dragging are recent spikes/drops, not session averages). */
  recentWpm: number | null
  /** WPM averaged over the whole take so far, the baseline rushing/dragging are measured against. */
  baselineWpm: number | null
  /** Seconds since the last recognized speech activity — an in-progress live pause. */
  liveSilenceSeconds: number
  /** Whether the transcript chunk immediately before the current silence ended
   * with terminal punctuation — our proxy for "a completed key statement,"
   * used to tell a deliberate strategic pause apart from trailing off
   * mid-thought (see the Pause Distinction tuning rule). */
  lastChunkEndsWithTerminalPunctuation: boolean
  /** Pitch standard deviation (Hz) over the trailing few seconds. */
  recentPitchStdDevHz: number | null
  /** Pitch standard deviation (Hz) over the take so far, excluding the trailing window above. */
  baselinePitchStdDevHz: number | null
  /** Rotates which nudge phrase is picked so back-to-back triggers of the same
   * condition don't repeat the exact same line. */
  nudgeSeed: number
}

const FILLER_WORDS = ['um', 'uh', 'like', 'you know', 'sort of', 'kind of', 'basically', 'actually']
const FILLER_DENSITY_THRESHOLD = 3
const RUSHING_SPIKE_RATIO = 1.3
const DRAGGING_DROP_RATIO = 0.7
const DRAGGING_PAUSE_SECONDS = 3.5
const MONOTONE_STDDEV_RATIO = 0.5
const MIN_BASELINE_STDDEV_HZ = 4

function countFillerWords(text: string): number {
  if (!text) return 0
  const lower = text.toLowerCase()
  return FILLER_WORDS.reduce((count, word) => {
    const matches = lower.match(new RegExp(`\\b${word}\\b`, 'g'))
    return count + (matches?.length ?? 0)
  }, 0)
}

const RUSHING_NUDGES = ['Who are you rushing for?', 'Breathe—let the room weight settle.', 'Slow the room down.']
const DRAGGING_NUDGES = ['Where did the energy go?', 'Drive forward—finish the thought.', 'Pick the thread back up.']
const FILLER_NUDGES = ['Freeze—where is the pause?', 'Replace the filler with silence.', 'Catch that word. Now stop.']
const MONOTONE_NUDGES = ['Drop your voice one octave now.', 'Inject vocal contrast here.', 'Surprise them. Change pitch.']

function pickNudge(pool: string[], seed: number): string {
  return pool[((seed % pool.length) + pool.length) % pool.length]
}

const NO_TRIGGER: PatternInterruptResult = { triggerDetected: false, conditionType: null, interruptNudgeText: null }

export function evaluatePatternInterrupt(input: PatternInterruptInput): PatternInterruptResult {
  if (input.baselineWpm && input.recentWpm && input.recentWpm > input.baselineWpm * RUSHING_SPIKE_RATIO) {
    return { triggerDetected: true, conditionType: 'RUSHING', interruptNudgeText: pickNudge(RUSHING_NUDGES, input.nudgeSeed) }
  }

  const wpmDragging = Boolean(
    input.baselineWpm && input.recentWpm !== null && input.recentWpm < input.baselineWpm * DRAGGING_DROP_RATIO,
  )
  // A pause only counts as "dragging" when it reads as trailing off mid-thought
  // rather than a deliberate beat after a finished statement — see the Pause
  // Distinction rule in the module doc comment.
  const unintentionalPause =
    input.liveSilenceSeconds > DRAGGING_PAUSE_SECONDS && !input.lastChunkEndsWithTerminalPunctuation
  if (wpmDragging || unintentionalPause) {
    return { triggerDetected: true, conditionType: 'DRAGGING', interruptNudgeText: pickNudge(DRAGGING_NUDGES, input.nudgeSeed) }
  }

  if (countFillerWords(input.recentTranscriptWindow) >= FILLER_DENSITY_THRESHOLD) {
    return { triggerDetected: true, conditionType: 'FILLER', interruptNudgeText: pickNudge(FILLER_NUDGES, input.nudgeSeed) }
  }

  if (
    input.baselinePitchStdDevHz !== null &&
    input.recentPitchStdDevHz !== null &&
    input.baselinePitchStdDevHz >= MIN_BASELINE_STDDEV_HZ &&
    input.recentPitchStdDevHz < input.baselinePitchStdDevHz * MONOTONE_STDDEV_RATIO
  ) {
    return { triggerDetected: true, conditionType: 'MONOTONE', interruptNudgeText: pickNudge(MONOTONE_NUDGES, input.nudgeSeed) }
  }

  return NO_TRIGGER
}
