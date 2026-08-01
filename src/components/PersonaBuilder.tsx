import { useEffect, useState } from 'react'
import type { FutureSelfPersona } from '../types'
import { isPersonaComplete } from '../lib/storage'

interface PersonaBuilderProps {
  persona: FutureSelfPersona
  onChange: (persona: FutureSelfPersona) => void
}

const FIELDS: Array<{
  key: keyof FutureSelfPersona
  label: string
  placeholder: string
  multiline?: boolean
}> = [
  { key: 'name', label: 'Persona Name', placeholder: 'e.g. "The Anchor"' },
  {
    key: 'demeanor',
    label: 'Core Demeanor',
    placeholder: 'e.g. Calm, unhurried, commanding',
  },
  {
    key: 'standards',
    label: 'Standards / Non-Negotiables',
    placeholder: 'What this future self refuses to tolerate — over-explaining, rushing, apologizing for taking up space…',
    multiline: true,
  },
  {
    key: 'mantra',
    label: 'Mental Mantra',
    placeholder: 'e.g. "I do not rush what deserves weight."',
    multiline: true,
  },
]

export function PersonaBuilder({ persona, onChange }: PersonaBuilderProps) {
  const [draft, setDraft] = useState(persona)
  const [savedPulse, setSavedPulse] = useState(false)

  useEffect(() => setDraft(persona), [persona])

  const complete = isPersonaComplete(draft)

  function handleField(key: keyof FutureSelfPersona, value: string) {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  function handleSave() {
    onChange(draft)
    setSavedPulse(true)
    setTimeout(() => setSavedPulse(false), 1600)
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-6">
      <div className="mb-5 flex flex-col items-start gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Future-Self Identity Mapping</h2>
          <p className="mt-1 text-sm text-white/50">
            Define who you're already becoming. Every piece of feedback is delivered from this
            persona.
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium ${
            complete
              ? 'border-violet-400/30 bg-violet-400/10 text-violet-300'
              : 'border-white/10 bg-white/5 text-white/40'
          }`}
        >
          {complete ? 'Persona active' : 'Incomplete'}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {FIELDS.map((field) => (
          <div
            key={field.key}
            className={field.multiline ? 'lg:col-span-2' : undefined}
          >
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-white/40">
              {field.label}
            </label>
            {field.multiline ? (
              <textarea
                value={draft[field.key]}
                onChange={(e) => handleField(field.key, e.target.value)}
                placeholder={field.placeholder}
                rows={3}
                className="min-h-[96px] w-full resize-none rounded-lg border border-white/10 bg-black/30 px-3 py-3 text-base text-white placeholder:text-white/25 focus:border-violet-400/50 focus:outline-none focus:ring-1 focus:ring-violet-400/50"
              />
            ) : (
              <input
                type="text"
                value={draft[field.key]}
                onChange={(e) => handleField(field.key, e.target.value)}
                placeholder={field.placeholder}
                className="min-h-11 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-3 text-base text-white placeholder:text-white/25 focus:border-violet-400/50 focus:outline-none focus:ring-1 focus:ring-violet-400/50"
              />
            )}
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          className="min-h-11 rounded-lg bg-violet-500 px-5 py-3 text-sm font-medium text-white transition hover:bg-violet-400 active:scale-[0.98]"
        >
          Save Persona
        </button>
        {savedPulse && (
          <span className="animate-fade-in-up text-xs font-medium text-emerald-300">
            Saved to this device ✓
          </span>
        )}
      </div>
    </div>
  )
}
