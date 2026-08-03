import type { SavedPersona } from '../types'
import { PERSONA_ROUTING_SYSTEM_PROMPT } from './personaRoutingPrompt'
import { callClaude } from './ai'

export interface SuggestedArchetype {
  name: string
  masteryDomain: string
  demeanor: string
}

export interface PersonaRecommendation {
  recommendedPersonaName: string | null
  rationale: string
  suggestedArchetype: SuggestedArchetype | null
  source: 'live' | 'mock'
}

interface RecommendationInput {
  savedPersonas: SavedPersona[]
  targetScenario: string
}

function buildUserMessage(input: RecommendationInput): string {
  const personas = input.savedPersonas.map((p) => ({
    name: p.name,
    mastery_domain: p.masteryDomain || null,
    demeanor_and_standards: [p.demeanor, p.standards].filter(Boolean).join(' | ') || null,
  }))

  return `Run TASK 1 (Scenario-to-Persona Recommendation) for this input:

Saved Personas: ${JSON.stringify(personas, null, 2)}
Target Scenario: "${input.targetScenario || 'General high-stakes speaking moment'}"`
}

const SECTION_PATTERN =
  /\*\*Recommended Persona:\*\*([\s\S]*?)\*\*Rationale:\*\*([\s\S]*?)\*\*Suggested Archetype:\*\*([\s\S]*)/i

function parseRecommendation(text: string): Omit<PersonaRecommendation, 'source'> {
  const match = SECTION_PATTERN.exec(text)
  if (!match) throw new Error('Recommendation response did not match the expected section structure.')

  const nameRaw = match[1].trim()
  const recommendedPersonaName = /^none$/i.test(nameRaw) ? null : nameRaw
  const rationale = match[2].trim()
  const archetypeRaw = match[3].trim()

  if (recommendedPersonaName || /^n\/a$/i.test(archetypeRaw)) {
    return { recommendedPersonaName, rationale, suggestedArchetype: null }
  }

  const parts = archetypeRaw.split('—').map((p) => p.trim())
  return {
    recommendedPersonaName: null,
    rationale,
    suggestedArchetype: {
      name: parts[0] || archetypeRaw,
      masteryDomain: parts[1] || '',
      demeanor: parts[2] || '',
    },
  }
}

export async function generatePersonaRecommendation(input: RecommendationInput): Promise<PersonaRecommendation> {
  try {
    const text = await callClaude(PERSONA_ROUTING_SYSTEM_PROMPT, buildUserMessage(input), 350)
    return { ...parseRecommendation(text), source: 'live' }
  } catch (err) {
    console.warn('Live persona recommendation failed, falling back to mock diagnostics.', err)
    return mockPersonaRecommendation(input)
  }
}

const SCENARIO_ARCHETYPES: Array<{ keywords: string[]; archetype: SuggestedArchetype }> = [
  {
    keywords: ['negotiation', 'pricing', 'salary', 'deal'],
    archetype: {
      name: 'The Commander',
      masteryDomain: 'Holding firm value under pressure to concede',
      demeanor: 'Concise, definitive, unrushed under pushback',
    },
  },
  {
    keywords: ['board', 'pitch', 'investor', 'crisis'],
    archetype: {
      name: 'The Anchor',
      masteryDomain: 'Grounded authority when the room is watching for cracks',
      demeanor: 'Calm, unhurried, commanding silence',
    },
  },
  {
    keywords: ['q&a', 'cross-examination', 'interview', 'panel'],
    archetype: {
      name: 'The Catalyst',
      masteryDomain: 'Staying dynamic and responsive under rapid-fire questioning',
      demeanor: 'Energetic, precise, never defensive',
    },
  },
]

const DEFAULT_ARCHETYPE: SuggestedArchetype = {
  name: 'The Anchor',
  masteryDomain: 'Staying composed and precise under general pressure',
  demeanor: 'Calm, exacting, no wasted words',
}

function pickArchetypeForScenario(scenario: string): SuggestedArchetype {
  const lower = scenario.toLowerCase()
  const match = SCENARIO_ARCHETYPES.find((entry) => entry.keywords.some((k) => lower.includes(k)))
  return match ? match.archetype : DEFAULT_ARCHETYPE
}

function scenarioOverlapScore(scenario: string, persona: SavedPersona): number {
  const scenarioWords = new Set(scenario.toLowerCase().match(/[a-z]{4,}/g) ?? [])
  if (scenarioWords.size === 0) return 0
  const personaText = `${persona.masteryDomain} ${persona.demeanor} ${persona.standards}`.toLowerCase()
  let hits = 0
  for (const word of scenarioWords) {
    if (personaText.includes(word)) hits++
  }
  return hits
}

function mockPersonaRecommendation(input: RecommendationInput): PersonaRecommendation {
  const scenario = input.targetScenario.trim() || 'this high-stakes moment'

  if (input.savedPersonas.length === 0) {
    const archetype = pickArchetypeForScenario(scenario)
    return {
      recommendedPersonaName: null,
      rationale: `No saved personas yet — would building "${archetype.name}" first give you a persona already matched to this kind of moment?`,
      suggestedArchetype: archetype,
      source: 'mock',
    }
  }

  const scored = input.savedPersonas
    .map((p) => ({ persona: p, score: scenarioOverlapScore(scenario, p) }))
    .sort((a, b) => b.score - a.score)
  const best = scored[0]

  if (best.score === 0) {
    return {
      recommendedPersonaName: best.persona.name,
      rationale: `None of your saved personas explicitly target "${scenario}" — would ${best.persona.name} still be the closest fit given their standards apply broadly?`,
      suggestedArchetype: null,
      source: 'mock',
    }
  }

  return {
    recommendedPersonaName: best.persona.name,
    rationale: `Would ${best.persona.name} be ideal here, given their mastery of "${best.persona.masteryDomain || best.persona.demeanor}" lines up with the demands of "${scenario}"?`,
    suggestedArchetype: null,
    source: 'mock',
  }
}
