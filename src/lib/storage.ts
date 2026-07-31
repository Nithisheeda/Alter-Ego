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
