import { DEFAULT_PERSONA, type FutureSelfPersona, type SavedPersona } from '../types'

const PERSONA_KEY = 'alter-ego:persona'
const PERSONA_LIBRARY_KEY = 'alter-ego:persona-library'

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

/**
 * The persona library holds every persona the user has saved, distinct from
 * whichever single persona is "active" via loadPersona()/savePersona() above.
 * The scenario-to-persona recommendation engine picks among these.
 */
export function loadPersonaLibrary(): SavedPersona[] {
  try {
    const raw = localStorage.getItem(PERSONA_LIBRARY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (entry): entry is SavedPersona => typeof entry === 'object' && entry !== null && typeof entry.id === 'string',
    )
  } catch {
    return []
  }
}

export function savePersonaLibrary(library: SavedPersona[]) {
  localStorage.setItem(PERSONA_LIBRARY_KEY, JSON.stringify(library))
}

export function addPersonaToLibrary(persona: FutureSelfPersona): SavedPersona[] {
  const library = loadPersonaLibrary()
  const saved: SavedPersona = { ...persona, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` }
  const next = [...library, saved]
  savePersonaLibrary(next)
  return next
}

export function removePersonaFromLibrary(id: string): SavedPersona[] {
  const next = loadPersonaLibrary().filter((p) => p.id !== id)
  savePersonaLibrary(next)
  return next
}
