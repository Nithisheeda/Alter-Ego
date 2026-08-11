// Companion to masteryLog.ts, tracking the newer AI diagnostics (constraint
// pass/fail, persona alignment score, persona recommendations) across takes.
// Kept as a separate append-only log rather than folded into MasteryEntry
// because these diagnostics run asynchronously and optionally, well after a
// take's MasteryEntry is already written — trying to retrofit updates onto
// that entry would mean tracking entry IDs across async boundaries for no
// real benefit over a second lightweight log.
const STORAGE_KEY = 'alter-ego:diagnostics-log'
const MAX_ENTRIES = 200

interface ConstraintLogEntry {
  id: string
  timestamp: number
  kind: 'constraint'
  durationPassed: boolean | null
  hedgePassed: boolean | null
}

interface AlignmentLogEntry {
  id: string
  timestamp: number
  kind: 'alignment'
  score: number
}

interface RecommendationLogEntry {
  id: string
  timestamp: number
  kind: 'recommendation'
  archetype: string
}

export type DiagnosticLogEntry = ConstraintLogEntry | AlignmentLogEntry | RecommendationLogEntry

export function loadDiagnosticsLog(): DiagnosticLogEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function appendDiagnosticEntry(entry: DiagnosticLogEntry): DiagnosticLogEntry[] {
  const next = [...loadDiagnosticsLog(), entry]
  const trimmed = next.length > MAX_ENTRIES ? next.slice(next.length - MAX_ENTRIES) : next
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
  } catch {
    // Storage full or unavailable — the in-memory session experience is unaffected.
  }
  return trimmed
}

export function createDiagnosticLogId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export interface DiagnosticsSummary {
  constraintChecksLogged: number
  durationPassRate: number | null
  hedgePassRate: number | null
  recentConstraintResults: Array<{ durationPassed: boolean | null; hedgePassed: boolean | null }>
  alignmentAverage: number | null
  alignmentRecent: number[]
  topArchetype: string | null
  archetypeCounts: Record<string, number>
}

function passRate(results: Array<boolean | null>): number | null {
  const decided = results.filter((r): r is boolean => r !== null)
  if (decided.length === 0) return null
  return Math.round((decided.filter(Boolean).length / decided.length) * 100)
}

export function summarizeDiagnosticsLog(log: DiagnosticLogEntry[]): DiagnosticsSummary {
  const constraintEntries = log.filter((e): e is ConstraintLogEntry => e.kind === 'constraint')
  const alignmentEntries = log.filter((e): e is AlignmentLogEntry => e.kind === 'alignment')
  const recommendationEntries = log.filter((e): e is RecommendationLogEntry => e.kind === 'recommendation')

  const archetypeCounts: Record<string, number> = {}
  for (const entry of recommendationEntries) {
    archetypeCounts[entry.archetype] = (archetypeCounts[entry.archetype] ?? 0) + 1
  }
  const topArchetype =
    Object.entries(archetypeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  return {
    constraintChecksLogged: constraintEntries.length,
    durationPassRate: passRate(constraintEntries.map((e) => e.durationPassed)),
    hedgePassRate: passRate(constraintEntries.map((e) => e.hedgePassed)),
    recentConstraintResults: constraintEntries
      .slice(-10)
      .map((e) => ({ durationPassed: e.durationPassed, hedgePassed: e.hedgePassed })),
    alignmentAverage:
      alignmentEntries.length === 0
        ? null
        : Math.round(alignmentEntries.reduce((sum, e) => sum + e.score, 0) / alignmentEntries.length),
    alignmentRecent: alignmentEntries.slice(-10).map((e) => e.score),
    topArchetype,
    archetypeCounts,
  }
}
