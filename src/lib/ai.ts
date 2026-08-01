import type { FutureSelfFeedback, FutureSelfPersona, SpeechMetrics } from '../types'

const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY?.trim() || undefined
const MODEL = 'claude-sonnet-4-5'
const API_URL = 'https://api.anthropic.com/v1/messages'

export const isLiveAiConfigured = Boolean(API_KEY)

interface DrillContext {
  kind: 'drill'
  passageTitle: string
  metrics: SpeechMetrics
}

interface SituationalContext {
  kind: 'situational'
  scenario: string
}

export type FeedbackContext = DrillContext | SituationalContext

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
    return `I just finished a speech drill reading "${context.passageTitle}".
Metrics:
- Words per minute: ${m.wpm}
- Total duration: ${m.durationSeconds}s
- Pause count: ${m.pauseCount} (${m.pauseFrequencyPerMin}/min)
- Longest pause: ${m.longestPauseSeconds}s
${m.transcript ? `Transcript: "${m.transcript}"` : '(No transcript captured — voice recognition unavailable on this device.)'}

Give me feedback as my Future-Self.`
  }
  return `I have an upcoming high-stakes situation I need to mentally prepare for:

"${context.scenario}"

Give me feedback as my Future-Self, reframing how I should walk into this.`
}

export async function generateFeedback(
  persona: FutureSelfPersona,
  context: FeedbackContext,
): Promise<FutureSelfFeedback> {
  if (!API_KEY) {
    return mockFeedback(persona, context)
  }

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 512,
        system: personaSystemPrompt(persona),
        messages: [{ role: 'user', content: userMessage(context) }],
      }),
    })

    if (!response.ok) throw new Error(`Anthropic API error ${response.status}`)

    const data = await response.json()
    const text: string = data?.content?.[0]?.text ?? ''
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
    const paceNote =
      m.wpm > 165
        ? `You hit ${m.wpm} WPM — that's a rushed pace, the kind that shows up when silence feels unsafe.`
        : m.wpm < 110
          ? `You dropped to ${m.wpm} WPM — that's under-energized, more hesitant than deliberate.`
          : `You held ${m.wpm} WPM — a controlled, conversational pace.`
    const pauseNote =
      m.pauseCount > 4
        ? `${m.pauseCount} pauses in ${m.durationSeconds}s tells me you're second-guessing mid-sentence instead of finishing your thought.`
        : m.pauseCount === 0
          ? `Zero real pauses — you're powering through without ever letting a point land.`
          : `${m.pauseCount} pauses is reasonable, but the longest ran ${m.longestPauseSeconds}s — check whether that one was intentional or just nerves.`

    return {
      realityCheck: `${paceNote} ${pauseNote}`,
      tacticalAdjustment:
        m.wpm > 165
          ? `Drop your shoulders and add a full second of silence after your opening line before you continue — that pause is not dead air, it's authority.`
          : `Plant your feet, exhale before you start the next sentence, and speak the last three words of each sentence slower than the rest.`,
      mindsetReframe: `${name} does not fill silence to feel safe — ${name} lets it work. "${mantra}" That's the standard now, not the exception.`,
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
