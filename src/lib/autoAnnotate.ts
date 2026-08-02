import type { PassagePart } from '../types'

const POWER_WORD_LIST = new Set([
  'never', 'always', 'must', 'will', 'critical', 'guarantee', 'promise', 'exactly',
  'absolutely', 'every', 'only', 'biggest', 'worst', 'best', 'urgent', 'immediately',
  'now', 'today', 'refuse', 'demand', 'proven', 'impossible', 'inevitable', 'undeniable',
  'crucial', 'essential', 'dominant', 'breakthrough', 'unprecedented', 'exact', 'certain',
  'nothing', 'everything', 'everyone', 'no one', 'win', 'lose', 'fail', 'succeed',
])

/** ALL-CAPS words, numbers/money/percent/multipliers, or a curated high-impact word list. */
function isPowerWord(rawWord: string): boolean {
  const clean = rawWord.replace(/[^a-zA-Z0-9%$.]/g, '')
  if (!clean) return false
  if (clean.length >= 2 && /^[A-Z0-9]+$/.test(clean) && /[A-Z]/.test(clean)) return true
  if (/^\$?\d+([.,]\d+)?%?[kKmMbB]?x?$/.test(clean)) return true
  return POWER_WORD_LIST.has(clean.toLowerCase())
}

/** Heuristic: 3+ consecutive consonants in a word tends to mean a hard cluster/plosive run. */
function isTrickyDiction(rawWord: string): boolean {
  const clean = rawWord.replace(/[^a-zA-Z]/g, '')
  if (clean.length < 5) return false
  return /[bcdfgjklmnpqrstvwxz]{3,}/i.test(clean)
}

const TOKEN_RE = /[\w'-]+|[.,;:!?—]+|\s+/g

/**
 * Best-effort markup for pasted scripts: inserts a longer pause after
 * sentence-ending punctuation and a shorter one after clause breaks, and
 * flags likely power words / tricky consonant clusters. It's a heuristic,
 * not linguistic analysis — meant as a fast starting point users can still
 * read past, not a verdict.
 */
export function autoAnnotate(rawText: string): PassagePart[] {
  const text = rawText.trim().replace(/\s+/g, ' ')
  if (!text) return []

  const tokens = text.match(TOKEN_RE) ?? []
  const parts: PassagePart[] = []

  for (const token of tokens) {
    if (/^\s+$/.test(token)) {
      parts.push({ type: 'text', text: ' ' })
      continue
    }
    if (/^[.,;:!?—]+$/.test(token)) {
      parts.push({ type: 'text', text: token })
      if (/[.!?]/.test(token)) {
        parts.push({ type: 'pause', seconds: 1 })
      } else if (/[,;:—]/.test(token)) {
        parts.push({ type: 'pause', seconds: 0.4 })
      }
      continue
    }
    if (isPowerWord(token)) {
      parts.push({ type: 'power', text: token })
    } else if (isTrickyDiction(token)) {
      parts.push({ type: 'diction', text: token })
    } else {
      parts.push({ type: 'text', text: token })
    }
  }

  return parts
}
