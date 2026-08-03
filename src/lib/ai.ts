import type { FutureSelfFeedback, FutureSelfPersona, SpeechMetrics } from '../types'
import type { DeliveryAnalysis } from './vocalAnalysis'
import { loadCustomApiKey } from './settings'

const MODEL = 'claude-sonnet-4-5'
const ANTHROPIC_DIRECT_URL = 'https://api.anthropic.com/v1/messages'
const PROXY_URL = '/api/claude'
const ANTHROPIC_VERSION = '2023-06-01'

export function hasCustomApiKey(): boolean {
  return Boolean(loadCustomApiKey())
}

/** Tells the /api/claude proxy which analysis lens to layer onto the system prompt — see api/claude.ts. */
export type PromptMode = 'speech' | 'persona' | 'dual'

/**
 * Key resolution, in order:
 * 1. A user-supplied key saved in Settings (localStorage) — called directly
 *    from the browser. The `mode` param is not sent here: Anthropic's API
 *    rejects unrecognized body fields, and dual-mode augmentation is a
 *    proxy-only feature (a bring-your-own-key user's prompt goes through
 *    verbatim).
 * 2. The `/api/claude` serverless proxy, which holds the real key
 *    server-side and applies `mode` to the system prompt.
 * 3. Callers catch failures from this and fall back to mock heuristics.
 */
async function callClaude(
  system: string,
  userContent: string,
  maxTokens: number,
  mode?: PromptMode,
): Promise<string> {
  const customKey = loadCustomApiKey()

  const response = customKey
    ? await fetch(ANTHROPIC_DIRECT_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': customKey,
          'anthropic-version': ANTHROPIC_VERSION,
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: maxTokens,
          system,
          messages: [{ role: 'user', content: userContent }],
        }),
      })
    : await fetch(PROXY_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: maxTokens,
          system,
          mode,
          messages: [{ role: 'user', content: userContent }],
        }),
      })

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null)
    throw new Error(errorBody?.error || `Claude request failed (${response.status})`)
  }

  const data = await response.json()
  return data?.content?.[0]?.text ?? ''
}

interface DrillContext {
  kind: 'drill'
  passageTitle: string
  metrics: SpeechMetrics
  analysis?: DeliveryAnalysis
}

interface SituationalContext {
  kind: 'situational'
  scenario: string
  pushback?: {
    question: string
    rebuttalTranscript: string
  }
}

export type FeedbackContext = DrillContext | SituationalContext

export interface PushbackQuestion {
  question: string
  targetedWeakness: string
  source: 'live' | 'mock'
}

function personaSystemPrompt(persona: FutureSelfPersona): string {
  return `You are the user's Future-Self: the fully realized, unshakeable version of who they are becoming. You go by "${persona.name}". Your core demeanor is: ${persona.demeanor}. Your standards and non-negotiables (things you refuse to tolerate in yourself): ${persona.standards}. Your grounding mantra: "${persona.mantra}".

You speak directly to the user in first person, as them-but-further-along. You are warm but exacting: no fluff, no hedging, no generic motivational language. You notice specifics. You never say "great job" without evidence. You always ground the user back in their own future identity.

Respond with valid JSON only, matching this exact shape, no markdown fences:
{"realityCheck": string, "tacticalAdjustment": string, "mindsetReframe": string}

- realityCheck: A direct, unvarnished observation about what actually happened, citing specifics from the input. 2-3 sentences.
- tacticalAdjustment: One concrete physical or mental posture cue to apply on the next attempt. 1-2 sentences, actionable.
- mindsetReframe: A bold, unshakeable closing statement that grounds the user in their future identity ("${persona.name}"), referencing their mantra or standards. 1-2 sentences.`
}

function userMessage(context: FeedbackContext): string {
  if (context.kind === 'drill') {
    const m = context.metrics
    const a = context.analysis
    const analysisBlock = a
      ? `
Scientific vocal mechanics breakdown (scripted markup vs. what I actually did):
- Pause discipline: ${a.pauseDiscipline.label}${a.pauseDiscipline.score !== null ? ` (${a.pauseDiscipline.score}/100)` : ''} — ${a.pauseDiscipline.note}
- Diction & clarity: ${a.dictionClarity.label}${a.dictionClarity.score !== null ? ` (${a.dictionClarity.score}/100)` : ''} — ${a.dictionClarity.note}
- Pacing & WPM: ${a.pacing.label}${a.pacing.score !== null ? ` (${a.pacing.score}/100)` : ''} — ${a.pacing.note}
${a.overallScore !== null ? `- Overall mechanics score: ${a.overallScore}/100` : ''}`
      : ''

    return `I just finished a speech drill reading "${context.passageTitle}", which has scripted pause markers, power-word emphasis targets, and flagged tricky consonant clusters.
Metrics:
- Words per minute: ${m.wpm}
- Total duration: ${m.durationSeconds}s
- Pause count: ${m.pauseCount} (${m.pauseFrequencyPerMin}/min)
- Longest pause: ${m.longestPauseSeconds}s
${m.transcript ? `Transcript: "${m.transcript}"` : '(No transcript captured — voice recognition unavailable on this device.)'}
${analysisBlock}

Give me feedback as my Future-Self, grounded in the vocal mechanics breakdown above where it's available.`
  }
  const pushbackBlock = context.pushback
    ? `

I also ran a live pushback drill on this. I gave an initial spoken response, then got hit with this follow-up: "${context.pushback.question}" — here's how I responded: "${context.pushback.rebuttalTranscript || '(no transcript captured)'}"`
    : ''

  return `I have an upcoming high-stakes situation I need to mentally prepare for:

"${context.scenario}"${pushbackBlock}

Give me feedback as my Future-Self, reframing how I should walk into this${context.pushback ? ', including how I held up under the pushback' : ''}.`
}

export async function generateFeedback(
  persona: FutureSelfPersona,
  context: FeedbackContext,
): Promise<FutureSelfFeedback> {
  try {
    const text = await callClaude(personaSystemPrompt(persona), userMessage(context), 512, 'dual')
    const parsed = JSON.parse(extractJson(text))

    return {
      realityCheck: parsed.realityCheck,
      tacticalAdjustment: parsed.tacticalAdjustment,
      mindsetReframe: parsed.mindsetReframe,
      source: 'live',
    }
  } catch (err) {
    console.warn('Live Future-Self AI failed, falling back to mock diagnostics.', err)
    return mockFeedback(persona, context)
  }
}

const PUSHBACK_SYSTEM_PROMPT = `You are a sharp, realistic stakeholder in a high-stakes conversation — an investor, a skeptical board member, a tough client, or a direct manager, whichever fits the scenario. You are not the user's ally and not their Future-Self; you're the person pushing back on them in the room.

Given the scenario and the user's spoken response (transcribed from voice, so treat minor transcription artifacts generously), find the single weakest, least-supported, or most-hedged claim in what they said. Fire back exactly ONE pointed follow-up question that exploits that weakness — realistic, a little uncomfortable, the kind of question that actually gets asked in that room. Do not soften it and do not explain your reasoning to the user.

Respond with valid JSON only, matching this exact shape, no markdown fences:
{"question": string, "targetedWeakness": string}

- question: The follow-up pushback question itself, asked directly to the user, 1-2 sentences.
- targetedWeakness: A short internal note (not shown as dialogue) on which specific claim this targets and why it's weak. 1 sentence.`

function pushbackUserMessage(scenario: string, transcript: string): string {
  return `Scenario: "${scenario}"

My spoken response: "${transcript || '(no transcript captured — voice recognition unavailable on this device)'}"

Give me one sharp follow-up pushback question targeting the weakest part of my response.`
}

export async function generatePushback(scenario: string, transcript: string): Promise<PushbackQuestion> {
  try {
    const text = await callClaude(PUSHBACK_SYSTEM_PROMPT, pushbackUserMessage(scenario, transcript), 300)
    const parsed = JSON.parse(extractJson(text))

    return {
      question: parsed.question,
      targetedWeakness: parsed.targetedWeakness,
      source: 'live',
    }
  } catch (err) {
    console.warn('Live pushback AI failed, falling back to mock pushback.', err)
    return mockPushback(scenario, transcript)
  }
}

const HEDGE_WORDS = ['maybe', 'i think', 'probably', 'sort of', 'kind of', 'i guess', 'not sure', 'hopefully']

function pickWeakestSentence(transcript: string): string | null {
  const sentences = transcript
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
  if (sentences.length === 0) return null

  const hedged = sentences.find((s) => HEDGE_WORDS.some((h) => s.toLowerCase().includes(h)))
  if (hedged) return hedged

  return sentences.reduce((shortest, s) => (s.length < shortest.length ? s : shortest), sentences[0])
}

function mockPushback(scenario: string, transcript: string): PushbackQuestion {
  const weak = transcript ? pickWeakestSentence(transcript) : null

  if (weak) {
    return {
      question: `You said "${weak}" — what happens when I tell you that's not good enough? Walk me through the actual numbers, not the intention.`,
      targetedWeakness: `The claim "${weak}" wasn't backed with specifics.`,
      source: 'mock',
    }
  }

  return {
    question: `Before we move on — what's the one objection in this room about "${scenario.slice(0, 80)}${scenario.length > 80 ? '…' : ''}" you're least prepared to answer, and why haven't you addressed it yet?`,
    targetedWeakness: 'No transcript was captured, so this targets the scenario in general rather than a specific claim.',
    source: 'mock',
  }
}

function extractJson(text: string): string {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1) return text
  return text.slice(start, end + 1)
}

function mockFeedback(persona: FutureSelfPersona, context: FeedbackContext): FutureSelfFeedback {
  const name = persona.name.trim() || 'your Future-Self'
  const mantra = persona.mantra.trim() || 'I do not rush what deserves weight.'
  const standards = persona.standards.trim() || 'over-explaining and rushing through silence'

  if (context.kind === 'drill') {
    const m = context.metrics
    const a = context.analysis
    const paceNote =
      m.wpm > 165
        ? `You hit ${m.wpm} WPM — that's a rushed pace, the kind that shows up when silence feels unsafe.`
        : m.wpm < 110
          ? `You dropped to ${m.wpm} WPM — that's under-energized, more hesitant than deliberate.`
          : `You held ${m.wpm} WPM — a controlled, conversational pace.`
    const pauseNote = a
      ? a.pauseDiscipline.note
      : m.pauseCount > 4
        ? `${m.pauseCount} pauses in ${m.durationSeconds}s tells me you're second-guessing mid-sentence instead of finishing your thought.`
        : m.pauseCount === 0
          ? `Zero real pauses — you're powering through without ever letting a point land.`
          : `${m.pauseCount} pauses is reasonable, but the longest ran ${m.longestPauseSeconds}s — check whether that one was intentional or just nerves.`
    const dictionNote =
      a && a.dictionClarity.missedWords.length > 0
        ? ` And the script flagged ${a.dictionClarity.missedWords.join(', ')} for a reason — ${a.dictionClarity.note.toLowerCase()}`
        : ''

    return {
      realityCheck: `${paceNote} ${pauseNote}${dictionNote}`,
      tacticalAdjustment:
        a && a.dictionClarity.missedWords.length > 0
          ? `Slow down specifically on ${a.dictionClarity.missedWords[0]} — over-articulate the consonant cluster on your next pass until it's automatic.`
          : m.wpm > 165
            ? `Drop your shoulders and add a full second of silence after your opening line before you continue — that pause is not dead air, it's authority.`
            : `Plant your feet, exhale before you start the next sentence, and speak the last three words of each sentence slower than the rest.`,
      mindsetReframe: `${name} does not fill silence to feel safe — ${name} lets it work. "${mantra}" That's the standard now, not the exception.`,
      source: 'mock',
    }
  }

  if (context.pushback) {
    const rebuttal = context.pushback.rebuttalTranscript
    return {
      realityCheck: rebuttal
        ? `When it got pushed — "${context.pushback.question}" — you answered with "${rebuttal.slice(0, 140)}${rebuttal.length > 140 ? '…' : ''}" That's the real test, not the opening pitch.`
        : `The pushback landed — "${context.pushback.question}" — and no transcript came through on your rebuttal, so I can't tell you how it held up.`,
      tacticalAdjustment: `Go back to the exact word you reached for right after the pushback hit. That's your tell. Rehearse the three seconds after the hard question, not just the opening.`,
      mindsetReframe: `${name} isn't shaken by the follow-up — ${name} expects it. "${mantra}" The pushback is the room testing whether you meant it.`,
      source: 'mock',
    }
  }

  return {
    realityCheck: `You're walking into "${context.scenario.slice(0, 140)}${context.scenario.length > 140 ? '…' : ''}" already bracing for it — that tension is you rehearsing the worst version of how it goes.`,
    tacticalAdjustment: `Before you walk in, name out loud the one outcome you actually control, and let go of the rest — narrate that, don't just think it.`,
    mindsetReframe: `${name} doesn't need this to go perfectly to walk in steady — ${name} refuses ${standards}, and everything else is just weather. "${mantra}"`,
    source: 'mock',
  }
}
