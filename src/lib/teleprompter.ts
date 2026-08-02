import type { PassagePart } from '../types'

export interface TeleprompterToken {
  key: string
  text: string
  markType?: 'power' | 'diction'
  isPause?: boolean
  wordIndex: number | null
}

/** Flattens passage parts into word-level tokens for pacing/highlighting, preserving markup and pause markers. */
export function tokenizeForTeleprompter(parts: PassagePart[]): TeleprompterToken[] {
  const tokens: TeleprompterToken[] = []
  let wordIndex = 0

  parts.forEach((part, partIndex) => {
    if (part.type === 'pause') {
      tokens.push({ key: `pause-${partIndex}`, text: `⏸ ${part.seconds}s`, isPause: true, wordIndex: null })
      return
    }

    const words = part.text.split(/\s+/).filter(Boolean)
    words.forEach((word, wordPos) => {
      tokens.push({
        key: `w-${partIndex}-${wordPos}`,
        text: word,
        markType: part.type === 'power' ? 'power' : part.type === 'diction' ? 'diction' : undefined,
        wordIndex: wordIndex++,
      })
    })
  })

  return tokens
}
