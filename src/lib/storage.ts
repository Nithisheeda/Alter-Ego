import { DEFAULT_PERSONA, type FutureSelfPersona } from '../types'

const PERSONA_KEY = 'alter-ego:persona'

export function loadPersona(): FutureSelfPersona {
  try {
    const raw = localStorage.getItem(PERSONA_KEY)
    if (!raw) return DEFAULT_PERSONA
    return { ...DEFAULT_PERSONA, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_PERSONA
  }
}

export function savePersona(persona: FutureSelfPersona) {
  localStorage.setItem(PERSONA_KEY, JSON.stringify(persona))
}

export function isPersonaComplete(persona: FutureSelfPersona): boolean {
  return Boolean(
    persona.name.trim() &&
      persona.demeanor.trim() &&
      persona.standards.trim() &&
      persona.mantra.trim(),
  )
}

const PERSONA_FIELDS: Array<keyof FutureSelfPersona> = [
  'name',
  'demeanor',
  'standards',
  'mantra',
  'masteryDomain',
]

/** Parses and validates a persona JSON export. Throws with a user-facing message on invalid input. */
export function parsePersonaJson(raw: string): FutureSelfPersona {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('That file is not valid JSON.')
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('That file does not contain a persona object.')
  }

  const record = parsed as Record<string, unknown>
  const hasAnyField = PERSONA_FIELDS.some((key) => key in record)
  if (!hasAnyField) {
    throw new Error('That file does not look like a Future-Self persona export.')
  }

  const persona: FutureSelfPersona = { ...DEFAULT_PERSONA }
  for (const key of PERSONA_FIELDS) {
    const value = record[key]
    if (typeof value === 'string') persona[key] = value
  }
  return persona
}

export function personaExportFilename(persona: FutureSelfPersona): string {
  const slug = persona.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return `alter-ego-persona${slug ? `-${slug}` : ''}.json`
}
