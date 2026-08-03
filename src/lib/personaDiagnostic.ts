import type { FutureSelfPersona, SpeechMetrics } from '../types'
import type { DeliveryAnalysis } from './vocalAnalysis'
import { buildPersonaDiagnosticSystemPrompt } from './personaDiagnosticPrompt'
import { callClaude } from './ai'

export interface PersonaDiagnostic {
  masteryAlignmentCheck: string
  scenarioDiagnostics: string
  keyReflectionQuestion: string
  source: 'live' | 'mock'
}

interface DiagnosticInput {
  persona: FutureSelfPersona
  scenarioTag: string
  transcript: string
  metrics: SpeechMetrics
  analysis: DeliveryAnalysis | null
}

function buildUserMessage(input: DiagnosticInput): string {
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

const SECTION_PATTERN =
  /\*\*Mastery Alignment Check:\*\*([\s\S]*?)\*\*Scenario Diagnostics:\*\*([\s\S]*?)\*\*Key Reflection Question:\*\*([\s\S]*)/i

function parseDiagnostic(text: string): Omit<PersonaDiagnostic, 'source'> {
  const match = SECTION_PATTERN.exec(text)
  if (!match) throw new Error('Diagnostic response did not match the expected section structure.')
  return {
    masteryAlignmentCheck: match[1].trim(),
    scenarioDiagnostics: match[2].trim(),
    keyReflectionQuestion: match[3].trim(),
  }
}

export async function generatePersonaDiagnostic(input: DiagnosticInput): Promise<PersonaDiagnostic> {
  try {
    const system = buildPersonaDiagnosticSystemPrompt(input.persona, input.scenarioTag)
    const text = await callClaude(system, buildUserMessage(input), 500)
    return { ...parseDiagnostic(text), source: 'live' }
  } catch (err) {
    console.warn('Live persona diagnostic failed, falling back to mock diagnostics.', err)
    return mockPersonaDiagnostic(input)
  }
}

function mockPersonaDiagnostic(input: DiagnosticInput): PersonaDiagnostic {
  const name = input.persona.name.trim() || 'your Future-Self'
  const masteryDomain = input.persona.masteryDomain.trim() || 'staying composed under pressure'
  const scenario = input.scenarioTag.trim() || 'this moment'
  const m = input.metrics
  const a = input.analysis

  const paceQuestion =
    m.wpm > 165
      ? `You hit ${m.wpm} WPM — is that the pace of someone who has already mastered ${masteryDomain}, or the pace of someone still trying to prove it?`
      : m.wpm < 110
        ? `At ${m.wpm} WPM, is ${name} hesitating, or deliberately holding the room?`
        : `${m.wpm} WPM held steady — would ${name} call that controlled, or is there still room to slow down further?`
  const pauseQuestion = a
    ? `${a.pauseDiscipline.note} How would ${name} use that same silence to their advantage instead?`
    : `${m.pauseCount} pauses landed at ${m.pauseFrequencyPerMin}/min — is that the rhythm ${name} would choose, or the rhythm your nerves chose for you?`

  return {
    masteryAlignmentCheck: `${paceQuestion} ${pauseQuestion}`,
    scenarioDiagnostics: `Given the pressure points of "${scenario}", how did your tone hold up when the stakes were highest? Would ${name} have anchored the same transitions, or found a beat to breathe first?`,
    keyReflectionQuestion: `Next take: before you speak, ask yourself — is this how ${name} would open, or is this how you open when you're just hoping it goes well?`,
    source: 'mock',
  }
}
