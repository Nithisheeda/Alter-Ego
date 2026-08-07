import type { FutureSelfPersona, SpeechMetrics } from '../types'
import { PERSONA_DIAGNOSTIC_SYSTEM_PROMPT } from './personaDiagnosticPrompt'
import { callClaude } from './ai'

export type TonePreset = 'Executive Precision' | 'Direct Pitch' | 'Crisis Response' | 'Casual Authority'

export const TONE_PRESETS: TonePreset[] = ['Executive Precision', 'Direct Pitch', 'Crisis Response', 'Casual Authority']

/** User-set targets, before deterministic evaluation. `null` means unset — the
 * verdict must say so rather than fabricate a pass. */
export interface ConstraintSettings {
  maxDurationSeconds: number | null
  hedgeBudget: number | null
  tonePreset: TonePreset | null
}

interface DeterministicConstraints {
  max_duration_seconds: number | null
  actual_duration_seconds: number
  duration_passed: boolean | null
  hedge_count: number
  hedge_budget: number | null
  hedge_passed: boolean | null
  tone_preset: TonePreset | null
}

export interface PersonaDiagnostic {
  constraintVerdict: string
  masteryAlignmentCheck: string
  interrogativeCoaching: string
  recommendedRefinement: string
  deterministicConstraints: DeterministicConstraints
  source: 'live' | 'mock'
}

interface DiagnosticInput {
  persona: FutureSelfPersona
  scenarioTag: string
  transcript: string
  metrics: SpeechMetrics
  constraints: ConstraintSettings
}

// Epistemic softening / weak conviction — the only category this feature's
// deterministic_constraints schema gates on (filler words are a distinct,
// non-gating verbal tic already tracked elsewhere, e.g. executiveAnalysis.ts).
const HEDGING_WORDS = ['sort of', 'kind of', 'i guess', 'maybe', 'i think', 'potentially']

function countMatches(transcript: string, words: string[]): number {
  if (!transcript) return 0
  const lower = transcript.toLowerCase()
  return words.reduce((count, word) => {
    const matches = lower.match(new RegExp(`\\b${word}\\b`, 'g'))
    return count + (matches?.length ?? 0)
  }, 0)
}

function computeDeterministicConstraints(
  transcript: string,
  metrics: SpeechMetrics,
  constraints: ConstraintSettings,
): DeterministicConstraints {
  const actualDurationSeconds = metrics.durationSeconds
  const durationPassed =
    constraints.maxDurationSeconds !== null ? actualDurationSeconds <= constraints.maxDurationSeconds : null
  const hedgeCount = countMatches(transcript, HEDGING_WORDS)
  const hedgePassed = constraints.hedgeBudget !== null ? hedgeCount <= constraints.hedgeBudget : null

  return {
    max_duration_seconds: constraints.maxDurationSeconds,
    actual_duration_seconds: actualDurationSeconds,
    duration_passed: durationPassed,
    hedge_count: hedgeCount,
    hedge_budget: constraints.hedgeBudget,
    hedge_passed: hedgePassed,
    tone_preset: constraints.tonePreset,
  }
}

function buildUserMessage(input: DiagnosticInput, deterministicConstraints: DeterministicConstraints): string {
  const payload = {
    transcript: input.transcript || null,
    persona: {
      name: input.persona.name,
      mastery_domain: input.persona.masteryDomain || null,
      demeanor: input.persona.demeanor,
      mental_mantra: input.persona.mantra,
    },
    scenario_tag: input.scenarioTag.trim() || null,
    deterministic_constraints: deterministicConstraints,
  }
  return `Execution payload:\n${JSON.stringify(payload, null, 2)}\n\nEvaluate this take per the system instruction.`
}

const SECTION_PATTERN =
  /\*\*Constraint Verdict:\*\*([\s\S]*?)\*\*Mastery Alignment Check & Diagnostics:\*\*([\s\S]*?)\*\*Alter-Ego Interrogative Coaching:\*\*([\s\S]*?)\*\*Recommended Refinement:\*\*([\s\S]*)/i

function parseDiagnostic(text: string): Omit<PersonaDiagnostic, 'source' | 'deterministicConstraints'> {
  const match = SECTION_PATTERN.exec(text)
  if (!match) throw new Error('Diagnostic response did not match the expected section structure.')
  return {
    constraintVerdict: match[1].trim(),
    masteryAlignmentCheck: match[2].trim(),
    interrogativeCoaching: match[3].trim(),
    recommendedRefinement: match[4].trim(),
  }
}

export async function generatePersonaDiagnostic(input: DiagnosticInput): Promise<PersonaDiagnostic> {
  const deterministicConstraints = computeDeterministicConstraints(input.transcript, input.metrics, input.constraints)
  try {
    const text = await callClaude(
      PERSONA_DIAGNOSTIC_SYSTEM_PROMPT,
      buildUserMessage(input, deterministicConstraints),
      600,
    )
    return { ...parseDiagnostic(text), deterministicConstraints, source: 'live' }
  } catch (err) {
    console.warn('Live persona diagnostic failed, falling back to mock diagnostics.', err)
    return mockPersonaDiagnostic(input, deterministicConstraints)
  }
}

function pickRefinementExcerpt(transcript: string): string | null {
  const sentences = transcript
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
  if (sentences.length === 0) return null
  return sentences.reduce((longest, s) => (s.length > longest.length ? s : longest), sentences[0])
}

function stripHedging(excerpt: string): string {
  let cleaned = excerpt
  for (const word of HEDGING_WORDS) {
    cleaned = cleaned.replace(new RegExp(`\\b${word}\\b[,]?\\s*`, 'gi'), '')
  }
  return cleaned.trim().replace(/\s{2,}/g, ' ')
}

function mockPersonaDiagnostic(input: DiagnosticInput, dc: DeterministicConstraints): PersonaDiagnostic {
  const name = input.persona.name.trim() || 'your Future-Self'
  const masteryDomain = input.persona.masteryDomain.trim() || 'staying composed under pressure'
  const scenario = input.scenarioTag.trim() || 'this moment'
  const m = input.metrics

  const durationLine =
    dc.duration_passed === null
      ? 'No duration constraint was set for this run.'
      : dc.duration_passed
        ? `Duration held at ${dc.actual_duration_seconds}s, inside the ${dc.max_duration_seconds}s cap.`
        : `Duration ran ${dc.actual_duration_seconds}s against a ${dc.max_duration_seconds}s cap — the constraint was broken.`
  const hedgeLine =
    dc.hedge_passed === null
      ? 'No hedge budget was set for this run.'
      : dc.hedge_passed
        ? `Hedging stayed within budget at ${dc.hedge_count} instance(s).`
        : `Hedging hit ${dc.hedge_count} instance(s) against a budget of ${dc.hedge_budget} — the constraint was broken.`
  const toneLine = dc.tone_preset
    ? `Would ${name} call this delivery "${dc.tone_preset}", or did it drift from that register under pressure?`
    : `No tone preset was targeted for this run.`

  const paceQuestion =
    m.wpm > 165
      ? `You hit ${m.wpm} WPM — is that the pace of someone who has already mastered ${masteryDomain}, or the pace of someone still trying to prove it?`
      : m.wpm < 110
        ? `At ${m.wpm} WPM, is ${name} hesitating, or deliberately holding the room?`
        : `${m.wpm} WPM held steady — would ${name} call that controlled, or is there still room to slow down further?`
  const scenarioQuestion = `Given the pressure points of "${scenario}", where did your tone hold up, and where did it soften right when the stakes rose?`

  const excerpt = pickRefinementExcerpt(input.transcript)
  const refinement = excerpt
    ? `Original: "${excerpt}"\n\nGold-standard: "${stripHedging(excerpt)}"`
    : 'No transcript was captured for this take, so no excerpt is available to refine.'

  return {
    constraintVerdict: `${durationLine} ${hedgeLine} ${toneLine}`,
    masteryAlignmentCheck: `${paceQuestion} ${scenarioQuestion}`,
    interrogativeCoaching: `What was the one point you needed them to remember, and did your opening earn the right to say it? Why did you spend the first few seconds warming up instead of landing the thesis?`,
    recommendedRefinement: refinement,
    deterministicConstraints: dc,
    source: 'mock',
  }
}
