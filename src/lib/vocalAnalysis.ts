import type { PassagePart, SpeechMetrics } from '../types'
import { passageDesignatedPauses, passageDictionWords } from './passages'

export interface ScoredDimension {
  score: number | null
  label: string
  note: string
}

export interface DictionDimension extends ScoredDimension {
  missedWords: string[]
}

export interface DeliveryAnalysis {
  pauseDiscipline: ScoredDimension
  dictionClarity: DictionDimension
  pacing: ScoredDimension
  overallScore: number | null
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/**
 * Pause discipline is measured in aggregate: detected pauses (via
 * speech-recognition gaps ≥1.2s) vs. the number the script called for.
 * It's a cadence match, not a location-by-location check.
 */
function analyzePauseDiscipline(designatedPauses: number[], metrics: SpeechMetrics): ScoredDimension {
  const designatedCount = designatedPauses.length
  const actualCount = metrics.pauseCount

  if (designatedCount === 0) {
    return {
      score: 100,
      label: 'On Script',
      note: 'This take has no scripted pauses to observe.',
    }
  }

  const ratio = actualCount / designatedCount

  if (ratio >= 0.75 && ratio <= 1.4) {
    return {
      score: 90,
      label: 'Disciplined',
      note: `You landed ${actualCount} of the ${designatedCount} scripted holds — close to the cadence the script called for.`,
    }
  }

  if (ratio < 0.75) {
    return {
      score: Math.round(clamp(45 + ratio * 40, 15, 89)),
      label: 'Rushed Through',
      note: `The script called for ${designatedCount} strategic holds; you only took ${actualCount}. You're running past the silence instead of letting it land.`,
    }
  }

  return {
    score: Math.round(clamp(80 - (ratio - 1.4) * 30, 15, 89)),
    label: 'Over-Paused',
    note: `You paused ${actualCount} times against ${designatedCount} scripted holds — more hesitation than the script asked for.`,
  }
}

/**
 * Diction is checked by looking for each flagged word in the live transcript.
 * A word missing or garbled in speech-to-text is a reasonable proxy for a
 * cluster that didn't come through clean — not a phoneme-level verdict.
 */
function analyzeDiction(dictionWords: string[], metrics: SpeechMetrics): DictionDimension {
  if (dictionWords.length === 0) {
    return {
      score: 100,
      label: 'Clean',
      note: 'No flagged consonant clusters in this script.',
      missedWords: [],
    }
  }

  if (!metrics.transcript) {
    return {
      score: null,
      label: 'Unmeasured',
      note: 'Voice-to-text was unavailable for this take, so diction on the flagged words could not be checked.',
      missedWords: [],
    }
  }

  const transcript = metrics.transcript.toLowerCase()
  const missedWords = dictionWords.filter((word) => !transcript.includes(word))
  const hitCount = dictionWords.length - missedWords.length
  const score = Math.round((hitCount / dictionWords.length) * 100)
  const label = score >= 85 ? 'Sharp' : score >= 50 ? 'Slipping' : 'Muddled'
  const note =
    missedWords.length === 0
      ? `All ${dictionWords.length} flagged cluster${dictionWords.length === 1 ? '' : 's'} came through clean in the transcript.`
      : `${missedWords.length} of ${dictionWords.length} flagged word${dictionWords.length === 1 ? '' : 's'} didn't come through clean: ${missedWords.join(', ')}.`

  return { score, label, note, missedWords }
}

function analyzePacing(metrics: SpeechMetrics): ScoredDimension {
  const wpm = metrics.wpm
  const idealLow = 110
  const idealHigh = 165

  if (wpm >= idealLow && wpm <= idealHigh) {
    return {
      score: 95,
      label: 'Controlled',
      note: `${wpm} WPM sits inside the controlled-delivery band (${idealLow}–${idealHigh}) — measured, not rushed.`,
    }
  }

  if (wpm > idealHigh) {
    const over = wpm - idealHigh
    return {
      score: Math.round(clamp(85 - over / 3, 20, 84)),
      label: 'Rushed',
      note: `${wpm} WPM is ${over} over the controlled band — the pace is outrunning the content.`,
    }
  }

  const under = idealLow - wpm
  return {
    score: Math.round(clamp(85 - under / 3, 20, 84)),
    label: 'Under-Paced',
    note: `${wpm} WPM is ${under} under the controlled band — likely hesitation rather than deliberate pacing.`,
  }
}

export function analyzeDelivery(parts: PassagePart[], metrics: SpeechMetrics): DeliveryAnalysis {
  const designatedPauses = passageDesignatedPauses(parts)
  const dictionWords = passageDictionWords(parts)

  const pauseDiscipline = analyzePauseDiscipline(designatedPauses, metrics)
  const dictionClarity = analyzeDiction(dictionWords, metrics)
  const pacing = analyzePacing(metrics)

  const weighted: Array<[number | null, number]> = [
    [pauseDiscipline.score, 0.35],
    [dictionClarity.score, 0.35],
    [pacing.score, 0.3],
  ]
  const available = weighted.filter((w): w is [number, number] => w[0] !== null)
  const totalWeight = available.reduce((sum, [, weight]) => sum + weight, 0)
  const overallScore =
    available.length > 0
      ? Math.round(available.reduce((sum, [score, weight]) => sum + score * weight, 0) / totalWeight)
      : null

  return { pauseDiscipline, dictionClarity, pacing, overallScore }
}
