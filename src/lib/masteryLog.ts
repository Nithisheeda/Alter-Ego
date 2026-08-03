const STORAGE_KEY = 'alter-ego:mastery-log'
const MAX_ENTRIES = 200

export interface MasteryEntry {
  id: string
  timestamp: number
  passageTitle: string
  wpm: number
  durationSeconds: number
  pauseDisciplineScore: number | null
  pitchVarianceHz: number | null
  overallScore: number | null
}

export function loadMasteryLog(): MasteryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function appendMasteryEntry(entry: MasteryEntry): MasteryEntry[] {
  const next = [...loadMasteryLog(), entry]
  const trimmed = next.length > MAX_ENTRIES ? next.slice(next.length - MAX_ENTRIES) : next
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
  } catch {
    // Storage full or unavailable — the in-memory session experience is unaffected.
  }
  return trimmed
}

export interface MasterySummary {
  totalReps: number
  totalSecondsSpoken: number
  averageWpm: number | null
  averagePauseDiscipline: number | null
  averagePitchVarianceHz: number | null
  recentWpm: number[]
  recentPauseDiscipline: number[]
  recentPitchVariance: number[]
}

function average(values: number[]): number | null {
  if (values.length === 0) return null
  return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length)
}

export function summarizeMasteryLog(log: MasteryEntry[]): MasterySummary {
  const totalSecondsSpoken = log.reduce((sum, e) => sum + e.durationSeconds, 0)
  const recent = log.slice(-10)

  return {
    totalReps: log.length,
    totalSecondsSpoken,
    averageWpm: average(log.map((e) => e.wpm)),
    averagePauseDiscipline: average(
      log.map((e) => e.pauseDisciplineScore).filter((v): v is number => v !== null),
    ),
    averagePitchVarianceHz: average(
      log.map((e) => e.pitchVarianceHz).filter((v): v is number => v !== null),
    ),
    recentWpm: recent.map((e) => e.wpm),
    recentPauseDiscipline: recent
      .map((e) => e.pauseDisciplineScore)
      .filter((v): v is number => v !== null),
    recentPitchVariance: recent
      .map((e) => e.pitchVarianceHz)
      .filter((v): v is number => v !== null),
  }
}
