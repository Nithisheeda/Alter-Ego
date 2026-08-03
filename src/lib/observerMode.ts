import type { SpeechMetrics } from '../types'
import type { DeliveryAnalysis } from './vocalAnalysis'
import { buildObserverModeSystemPrompt } from './observerModePrompt'
import { callClaude } from './ai'

export interface ObserverAnalysis {
  observerAnalysis: string
  nextTakeCalibration: string
  source: 'live' | 'mock'
}

interface ObserverInput {
  userFirstName: string
  drillGoal: string
  transcript: string
  metrics: SpeechMetrics
  analysis: DeliveryAnalysis | null
}

function buildUserMessage(input: ObserverInput): string {
  const a = input.analysis
  const analysisBlock = a
    ? `\nVocal mechanics breakdown: pacing — ${a.pacing.label}; pause discipline — ${a.pauseDiscipline.label}; diction & clarity — ${a.dictionClarity.label}.`
    : ''

  return `Speech input to evaluate:
- Transcript: "${input.transcript || '(no transcript captured — voice recognition unavailable on this device)'}"
- Words per minute: ${input.metrics.wpm}
- Pause count: ${input.metrics.pauseCount} (${input.metrics.pauseFrequencyPerMin}/min), longest pause ${input.metrics.longestPauseSeconds}s${analysisBlock}

Evaluate this take per the system instruction.`
}

// The header text embeds the user's name ("Observer Analysis for Alex:"), so
// match up to the colon generically rather than requiring an exact name echo.
const SECTION_PATTERN = /\*\*Observer Analysis for [^*]*?:\*\*([\s\S]*?)\*\*Next-Take Calibration:\*\*([\s\S]*)/i

function parseObserverAnalysis(text: string): Omit<ObserverAnalysis, 'source'> {
  const match = SECTION_PATTERN.exec(text)
  if (!match) throw new Error('Observer analysis response did not match the expected section structure.')
  return {
    observerAnalysis: match[1].trim(),
    nextTakeCalibration: match[2].trim(),
  }
}

export async function generateObserverAnalysis(input: ObserverInput): Promise<ObserverAnalysis> {
  try {
    const system = buildObserverModeSystemPrompt(input.userFirstName, input.drillGoal)
    const text = await callClaude(system, buildUserMessage(input), 450)
    return { ...parseObserverAnalysis(text), source: 'live' }
  } catch (err) {
    console.warn('Live observer analysis failed, falling back to mock diagnostics.', err)
    return mockObserverAnalysis(input)
  }
}

function mockObserverAnalysis(input: ObserverInput): ObserverAnalysis {
  const name = input.userFirstName.trim() || 'the speaker'
  const goal = input.drillGoal.trim() || 'delivering this speech with steady control'
  const m = input.metrics
  const a = input.analysis

  const paceQuestion =
    m.wpm > 165
      ? `Did ${name} notice the pace climbing to ${m.wpm} WPM, and what was pulling ${name} forward so fast?`
      : m.wpm < 110
        ? `At ${m.wpm} WPM, was ${name} holding back deliberately, or losing momentum?`
        : `${name} held ${m.wpm} WPM — was that a chosen pace, or just the pace that happened?`
  const pauseQuestion = a
    ? `${a.pauseDiscipline.note} Where could ${name} have let the silence do more work?`
    : `${m.pauseCount} pauses landed at ${m.pauseFrequencyPerMin}/min — did ${name} choose those breaks, or did they just happen?`
  const goalQuestion = `Against the goal of ${goal}, where did ${name}'s delivery fall short of the mark, and where did it land closest to it?`

  return {
    observerAnalysis: `${paceQuestion} ${pauseQuestion} ${goalQuestion}`,
    nextTakeCalibration: `On the next take, what is the one thing ${name} needs to do differently in the first ten seconds?`,
    source: 'mock',
  }
}

// Pure local generation — a mid-drill cue has to render in real time while
// recording, so this deliberately avoids a network round trip.
const CUE_TEMPLATES = [
  (name: string) => `Is ${name} anchoring their breath right now?`,
  (name: string) => `Where is ${name}'s pace headed in the next five seconds?`,
  (name: string) => `Is ${name} letting silence work, or rushing past it?`,
  (name: string) => `Would ${name} call this delivery steady right now?`,
  (name: string) => `Is ${name} still aiming at the goal, or drifting from it?`,
]

export function generateMidDrillCue(userFirstName: string, cueIndex: number): string {
  const name = userFirstName.trim() || 'the speaker'
  const template = CUE_TEMPLATES[cueIndex % CUE_TEMPLATES.length]
  return template(name)
}
