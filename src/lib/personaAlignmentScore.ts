import type { FutureSelfPersona, SpeechMetrics } from '../types'
import type { DeliveryAnalysis } from './vocalAnalysis'
import type { TelemetrySample } from './pitchAnalysis'
import { computeAuthorityBand } from './telemetryAnalysis'
import { PERSONA_ROUTING_SYSTEM_PROMPT } from './personaRoutingPrompt'
import { callClaude } from './ai'

export interface PersonaAlignmentScore {
  score: number
  cadenceMatch: string
  composureIndex: string
  strategicAlignment: string
  source: 'live' | 'mock'
}

interface AlignmentInput {
  persona: FutureSelfPersona
  transcript: string
  metrics: SpeechMetrics
  analysis: DeliveryAnalysis | null
  telemetry: TelemetrySample[]
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function buildUserMessage(input: AlignmentInput): string {
  const band = computeAuthorityBand(input.telemetry)
  const a = input.analysis

  return `Run TASK 2 (Persona Alignment Score) for this input:

Target Persona:
- Name: ${input.persona.name}
- Mastery Domain: ${input.persona.masteryDomain || 'not specified'}
- Demeanor & Standards: ${[input.persona.demeanor, input.persona.standards].filter(Boolean).join(' | ') || 'not specified'}

Audio Metrics Context:
- Words per minute: ${input.metrics.wpm}
- Pause count: ${input.metrics.pauseCount} (${input.metrics.pauseFrequencyPerMin}/min), longest pause ${input.metrics.longestPauseSeconds}s
- Pitch stability baseline: ${band ? `${Math.round(band.baseline)}Hz` : 'unmeasured'}
${a ? `- Vocal mechanics: pacing ${a.pacing.label}; pause discipline ${a.pauseDiscipline.label}; diction ${a.dictionClarity.label}` : ''}
- Transcript: "${input.transcript || '(no transcript captured)'}"`
}

const SECTION_PATTERN =
  /\*\*Persona Alignment Score:\*\*\s*(\d+)%?([\s\S]*?)\*\*Cadence Match:\*\*([\s\S]*?)\*\*Composure Index:\*\*([\s\S]*?)\*\*Strategic Alignment:\*\*([\s\S]*)/i

function parseAlignmentScore(text: string): Omit<PersonaAlignmentScore, 'source'> {
  const match = SECTION_PATTERN.exec(text)
  if (!match) throw new Error('Alignment score response did not match the expected section structure.')
  return {
    score: clamp(Number(match[1]), 0, 100),
    cadenceMatch: match[3].trim(),
    composureIndex: match[4].trim(),
    strategicAlignment: match[5].trim(),
  }
}

export async function generatePersonaAlignmentScore(input: AlignmentInput): Promise<PersonaAlignmentScore> {
  try {
    const text = await callClaude(PERSONA_ROUTING_SYSTEM_PROMPT, buildUserMessage(input), 350)
    return { ...parseAlignmentScore(text), source: 'live' }
  } catch (err) {
    console.warn('Live persona alignment score failed, falling back to mock diagnostics.', err)
    return mockPersonaAlignmentScore(input)
  }
}

function mockPersonaAlignmentScore(input: AlignmentInput): PersonaAlignmentScore {
  const name = input.persona.name.trim() || 'your Future-Self'
  const m = input.metrics
  const a = input.analysis
  const band = computeAuthorityBand(input.telemetry)

  const cadenceScore = m.wpm >= 130 && m.wpm <= 160 ? 90 : clamp(90 - Math.abs(m.wpm - 145) / 2, 20, 89)
  const composureScore = a?.pauseDiscipline.score ?? (m.pauseCount === 0 ? 45 : m.pauseCount > 4 ? 55 : 80)
  const strategicScore = band ? 70 : 50
  const score = Math.round((cadenceScore + composureScore + strategicScore) / 3)

  return {
    score,
    cadenceMatch: `At ${m.wpm} WPM, does that pace match the baseline ${name} would set, or is it drifting from it?`,
    composureIndex: a
      ? `${a.pauseDiscipline.note} Would ${name} call that composure, or a tell?`
      : `${m.pauseCount} pauses at ${m.pauseFrequencyPerMin}/min — is that the composure ${name} holds under pressure?`,
    strategicAlignment: `Did the tone carry the authority ${name} demands, or did it soften right when the stakes rose?`,
    source: 'mock',
  }
}
