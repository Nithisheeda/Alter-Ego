import type { FutureSelfPersona, SpeechMetrics } from '../types'
import type { DeliveryAnalysis } from './vocalAnalysis'
import type { TelemetrySample } from './pitchAnalysis'
import { computeAuthorityBand } from './telemetryAnalysis'
import { loadMasteryLog, summarizeMasteryLog } from './masteryLog'
import { EXECUTIVE_ANALYZER_SYSTEM_PROMPT } from './executiveAnalyzerPrompt'
import { callClaude } from './ai'

export type ExecutionMode = 'MODE_A_STANDALONE' | 'MODE_B_ALTER_EGO'

export interface VocalMechanicsDimension {
  score: number
  label: string
  insight: string
}

export interface VocalMechanicsBlock {
  overall_score: number
  pacing: VocalMechanicsDimension
  pause_discipline: VocalMechanicsDimension
  pitch_control: VocalMechanicsDimension
}

export interface MindsetDiagnosis {
  core_trigger: string
  analysis: string
}

export interface PersonaRecommendation {
  show_recommendation: boolean
  suggested_archetype: string
  why_recommended: string
  core_focus: string
}

export interface AlterEgoEvaluation {
  persona_name: string
  alignment_score: number
  direct_persona_note: string
  recalibration_cue: string
}

export interface ExecutiveAnalysis {
  execution_mode: ExecutionMode
  vocal_mechanics: VocalMechanicsBlock
  mindset_diagnosis: MindsetDiagnosis
  persona_recommendation: PersonaRecommendation
  alter_ego_evaluation: AlterEgoEvaluation | null
  source: 'live' | 'mock'
}

interface AnalyzerInput {
  transcript: string
  metrics: SpeechMetrics
  telemetry: TelemetrySample[]
  analysis: DeliveryAnalysis | null
  persona: FutureSelfPersona | null
}

const FILLER_WORDS = ['um', 'uh', 'like', 'you know', 'sort of', 'kind of', 'basically', 'actually', 'so yeah']

function countFillerWords(transcript: string): number {
  if (!transcript) return 0
  const lower = transcript.toLowerCase()
  return FILLER_WORDS.reduce((count, word) => {
    const matches = lower.match(new RegExp(`\\b${word}\\b`, 'g'))
    return count + (matches?.length ?? 0)
  }, 0)
}

function buildAcousticMetrics(input: AnalyzerInput) {
  const band = computeAuthorityBand(input.telemetry)
  return {
    wpm: input.metrics.wpm,
    pause_cadence: `${input.metrics.pauseCount} pauses (${input.metrics.pauseFrequencyPerMin}/min), longest ${input.metrics.longestPauseSeconds}s`,
    pitch_stability_hz: band ? Math.round(band.baseline) : null,
    filler_word_count: countFillerWords(input.transcript),
  }
}

function buildPersonaProfile(persona: FutureSelfPersona | null) {
  if (!persona || !persona.name.trim()) return null
  return {
    name: persona.name,
    core_demands: persona.mantra,
    non_negotiables: persona.standards,
    tone_baseline: persona.demeanor,
  }
}

function buildDrillHistorySummary(): string | null {
  const summary = summarizeMasteryLog(loadMasteryLog())
  if (summary.totalReps === 0) return null
  return `${summary.totalReps} prior reps. Average WPM ${summary.averageWpm ?? 'n/a'}, average pause discipline ${
    summary.averagePauseDiscipline ?? 'n/a'
  }/100, average pitch variance ${summary.averagePitchVarianceHz ?? 'n/a'}Hz. Recent WPM trend: ${
    summary.recentWpm.join(', ') || 'n/a'
  }.`
}

function buildAnalyzerUserMessage(input: AnalyzerInput): string {
  const payload = {
    transcript: input.transcript || null,
    acoustic_metrics: buildAcousticMetrics(input),
    persona_profile: buildPersonaProfile(input.persona),
    drill_history: buildDrillHistorySummary(),
  }
  return `Execution payload:\n${JSON.stringify(payload, null, 2)}\n\nAnalyze this take per the system instruction.`
}

export async function generateExecutiveAnalysis(input: AnalyzerInput): Promise<ExecutiveAnalysis> {
  try {
    const text = await callClaude(
      EXECUTIVE_ANALYZER_SYSTEM_PROMPT,
      buildAnalyzerUserMessage(input),
      900,
      'executive-analyzer',
    )
    const parsed = JSON.parse(extractJson(text))
    return { ...parsed, source: 'live' }
  } catch (err) {
    console.warn('Live executive analysis failed, falling back to mock diagnostics.', err)
    return mockExecutiveAnalysis(input)
  }
}

function extractJson(text: string): string {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1) return text
  return text.slice(start, end + 1)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function scorePacing(wpm: number): VocalMechanicsDimension {
  if (wpm >= 130 && wpm <= 160) {
    return { score: 92, label: `Controlled - ${wpm} WPM`, insight: 'Pacing sits inside the executive delivery band (130-160 WPM).' }
  }
  if (wpm > 160) {
    const over = wpm - 160
    return {
      score: Math.round(clamp(85 - over / 3, 15, 84)),
      label: `Rushed - ${wpm} WPM`,
      insight: `${over} WPM over the executive band — the pace is outrunning the content.`,
    }
  }
  const under = 130 - wpm
  return {
    score: Math.round(clamp(85 - under / 3, 15, 84)),
    label: `Under-Paced - ${wpm} WPM`,
    insight: `${under} WPM under the executive band — likely hesitation rather than deliberate pacing.`,
  }
}

function scorePauseDiscipline(analysis: DeliveryAnalysis | null, metrics: SpeechMetrics): VocalMechanicsDimension {
  if (analysis) {
    return {
      score: analysis.pauseDiscipline.score ?? 50,
      label: analysis.pauseDiscipline.label,
      insight: analysis.pauseDiscipline.note,
    }
  }
  const score = metrics.pauseCount === 0 ? 45 : metrics.pauseCount > 4 ? 55 : 80
  return {
    score,
    label: metrics.pauseCount === 0 ? 'Rushed Through' : 'Holding Some Ground',
    insight: `${metrics.pauseCount} pauses detected at ${metrics.pauseFrequencyPerMin}/min.`,
  }
}

function scorePitchControl(telemetry: TelemetrySample[]): VocalMechanicsDimension {
  const band = computeAuthorityBand(telemetry)
  if (!band) {
    return { score: 50, label: 'Unmeasured', insight: 'Not enough voiced signal was captured to assess pitch stability.' }
  }
  return {
    score: 70,
    label: 'Grounded Baseline',
    insight: `Baseline pitch stayed steady around ${Math.round(band.baseline)}Hz.`,
  }
}

function mockExecutiveAnalysis(input: AnalyzerInput): ExecutiveAnalysis {
  const pacing = scorePacing(input.metrics.wpm)
  const pauseDiscipline = scorePauseDiscipline(input.analysis, input.metrics)
  const pitchControl = scorePitchControl(input.telemetry)
  const overallScore = Math.round((pacing.score + pauseDiscipline.score + pitchControl.score) / 3)

  const personaProfile = buildPersonaProfile(input.persona)
  const executionMode: ExecutionMode = personaProfile ? 'MODE_B_ALTER_EGO' : 'MODE_A_STANDALONE'

  const coreTrigger = pauseDiscipline.score < 55 ? 'Space Justification' : pitchControl.score < 55 ? 'Approval Seeking' : 'Controlled Delivery'
  const mindsetAnalysis =
    pauseDiscipline.score < 55
      ? 'You are treating silence as dead air rather than leverage. Rushing past the natural breaks in your content suggests a subconscious drive to finish before anyone can interrupt.'
      : pitchControl.score < 55
        ? 'Your pitch is drifting rather than holding a grounded baseline — that reads as searching for reassurance mid-sentence rather than stating something you already know to be true.'
        : 'Your delivery holds its own weight — the pace and pauses are working together instead of fighting each other.'

  const suggestedArchetype = pauseDiscipline.score < 55 ? 'The Anchor' : pitchControl.score < 55 ? 'The Catalyst' : 'The Commander'
  const archetypeFocus =
    suggestedArchetype === 'The Anchor'
      ? 'Grounded authority, silence discipline.'
      : suggestedArchetype === 'The Catalyst'
        ? 'Dynamic inflection, energetic hooks.'
        : 'Concise declarations, definitive cadence.'

  return {
    execution_mode: executionMode,
    vocal_mechanics: {
      overall_score: overallScore,
      pacing,
      pause_discipline: pauseDiscipline,
      pitch_control: pitchControl,
    },
    mindset_diagnosis: {
      core_trigger: coreTrigger,
      analysis: mindsetAnalysis,
    },
    persona_recommendation: {
      show_recommendation: !personaProfile,
      suggested_archetype: suggestedArchetype,
      why_recommended: `Your delivery's biggest friction point is ${
        pauseDiscipline.score < 55 ? 'skipped pauses' : pitchControl.score < 55 ? 'pitch drift' : 'over-explaining'
      } — "${suggestedArchetype}" is built to train exactly that. Focus: ${archetypeFocus}`,
      core_focus: archetypeFocus,
    },
    alter_ego_evaluation: personaProfile
      ? {
          persona_name: personaProfile.name,
          alignment_score: clamp(overallScore - 5, 10, 95),
          direct_persona_note: `You delivered the content, but you gave away your power in the process. I don't rush for the room; I make the room wait for the point. "${personaProfile.core_demands}"`,
          recalibration_cue: 'Take 2: Hold every period for two full seconds before speaking the next phrase.',
        }
      : null,
    source: 'mock',
  }
}
