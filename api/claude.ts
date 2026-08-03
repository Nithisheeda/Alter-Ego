// Vercel Edge Function — secure proxy for Anthropic Messages API calls.
// Keeps the real API key server-side; the client never sees it.
import { EXECUTIVE_ANALYZER_SYSTEM_PROMPT } from '../src/lib/executiveAnalyzerPrompt'

export const config = { runtime: 'edge' }

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'
const DEFAULT_MODEL = 'claude-sonnet-4-5'
const MAX_TOKENS_CAP = 1024

type PromptMode = 'speech' | 'persona' | 'dual' | 'executive-analyzer'

function isPromptMode(value: unknown): value is PromptMode {
  return value === 'speech' || value === 'persona' || value === 'dual' || value === 'executive-analyzer'
}

// Layered on top of whatever system prompt the client sends, only when it
// explicitly asks for a mode. Callers using their own saved API key bypass
// this proxy entirely (see ai.ts), so this only governs proxy-routed calls.
const PROMPT_MODE_DIRECTIVES: Record<Exclude<PromptMode, 'executive-analyzer'>, string> = {
  speech:
    'Analysis mode: SPEECH. Focus on concrete vocal delivery mechanics — pacing, pause discipline, diction, and pitch/volume — drawn strictly from the metrics and transcript provided. Treat identity/persona framing as color, not the main analysis.',
  persona:
    "Analysis mode: PERSONA. Focus on whether the user's words and posture align with their stated Future-Self identity, standards, and mantra. Vocal delivery mechanics are secondary context only.",
  dual: "Analysis mode: DUAL. Give equal weight to (1) SPEECH ANALYSIS — concrete vocal delivery mechanics (pace, pauses, diction, pitch/volume) drawn from the metrics provided, and (2) PERSONA ANALYSIS — whether the delivery and content reflect the user's stated Future-Self identity, standards, and mantra. Address both dimensions explicitly in the response; do not collapse into only one.",
}

/**
 * Dual-mode Speech & Persona analysis: 'executive-analyzer' is the full
 * structured analyzer (Mode A standalone speech / Mode B alter-ego coaching,
 * selected server-side by presence of a persona_profile in the payload). It
 * REPLACES whatever system prompt the client sent — this is the one prompt
 * we don't want a client (even a modified one) able to override, since its
 * JSON contract is load-bearing for the UI that parses the response.
 * The lighter 'speech' | 'persona' | 'dual' modes still just append a short
 * directive to the client's own prompt, for the existing Future-Self flows.
 */
function applyPromptMode(system: string | undefined, mode: unknown): string | undefined {
  if (!isPromptMode(mode)) return system
  if (mode === 'executive-analyzer') return EXECUTIVE_ANALYZER_SYSTEM_PROMPT
  const directive = PROMPT_MODE_DIRECTIVES[mode]
  return system ? `${system}\n\n${directive}` : directive
}

interface ClaudeProxyPayload {
  system?: string
  mode?: string
  messages?: Array<{ role: string; content: string }>
  max_tokens?: number
  model?: string
}

function isAllowedOrigin(origin: string, selfHostname: string): boolean {
  try {
    const { hostname } = new URL(origin)
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.endsWith('.vercel.app') ||
      hostname === selfHostname
    )
  } catch {
    return false
  }
}

function corsHeaders(origin: string | null): HeadersInit {
  if (!origin) return {}
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    vary: 'origin',
  }
}

function jsonResponse(body: unknown, status: number, extraHeaders: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...extraHeaders },
  })
}

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const origin = req.headers.get('origin')
  // Requests without an Origin header (server-to-server, curl, same-origin
  // fetches some browsers omit it for) are allowed through; any Origin that
  // IS present must match localhost, a *.vercel.app domain, or this deploy's
  // own host.
  const originAllowed = !origin || isAllowedOrigin(origin, url.hostname)

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: originAllowed ? 204 : 403, headers: corsHeaders(origin) })
  }

  if (!originAllowed) {
    return jsonResponse({ error: 'Origin not allowed.' }, 403)
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed. Use POST.' }, 405, corsHeaders(origin))
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return jsonResponse(
      { error: 'ANTHROPIC_API_KEY is not configured on the server.' },
      500,
      corsHeaders(origin),
    )
  }

  let payload: ClaudeProxyPayload
  try {
    payload = await req.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON body.' }, 400, corsHeaders(origin))
  }

  if (!Array.isArray(payload.messages) || payload.messages.length === 0) {
    return jsonResponse(
      { error: 'Request body must include a non-empty "messages" array.' },
      400,
      corsHeaders(origin),
    )
  }

  try {
    const upstream = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: payload.model || DEFAULT_MODEL,
        max_tokens: Math.min(payload.max_tokens ?? 512, MAX_TOKENS_CAP),
        system: applyPromptMode(payload.system, payload.mode),
        messages: payload.messages,
      }),
    })

    const text = await upstream.text()
    return new Response(text, {
      status: upstream.status,
      headers: { 'content-type': 'application/json', ...corsHeaders(origin) },
    })
  } catch (err) {
    return jsonResponse(
      { error: 'Failed to reach the Anthropic API.', detail: err instanceof Error ? err.message : String(err) },
      502,
      corsHeaders(origin),
    )
  }
}
