import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import type { FutureSelfPersona, SavedPersona } from '../types'
import { isPersonaComplete, parsePersonaJson, personaExportFilename } from '../lib/storage'

interface PersonaBuilderProps {
  persona: FutureSelfPersona
  onChange: (persona: FutureSelfPersona) => void
  library: SavedPersona[]
  onSaveToLibrary: (persona: FutureSelfPersona) => void
  onRemoveFromLibrary: (id: string) => void
  onLoadFromLibrary: (persona: SavedPersona) => void
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
  {
    key: 'masteryDomain',
    label: 'Mastery Domain / Proven Trait (optional)',
    placeholder: 'e.g. "Unshakable calm under aggressive executive cross-examination"',
    multiline: true,
  },
]

export function PersonaBuilder({
  persona,
  onChange,
  library,
  onSaveToLibrary,
  onRemoveFromLibrary,
  onLoadFromLibrary,
}: PersonaBuilderProps) {
  const [draft, setDraft] = useState(persona)
  const [savedPulse, setSavedPulse] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [importPulse, setImportPulse] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  function handleSaveToLibrary() {
    if (!draft.name.trim()) return
    onChange(draft)
    onSaveToLibrary(draft)
  }

  function handleLoadFromLibrary(saved: SavedPersona) {
    const rest: FutureSelfPersona = {
      name: saved.name,
      demeanor: saved.demeanor,
      standards: saved.standards,
      mantra: saved.mantra,
      masteryDomain: saved.masteryDomain,
    }
    setDraft(rest)
    onChange(rest)
    onLoadFromLibrary(saved)
  }

  function handleExport() {
    const blob = new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = personaExportFilename(draft)
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  function handleImportClick() {
    setImportError(null)
    fileInputRef.current?.click()
  }

  function handleImportFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      try {
        const imported = parsePersonaJson(String(reader.result))
        setDraft(imported)
        onChange(imported)
        setImportError(null)
        setImportPulse(true)
        setTimeout(() => setImportPulse(false), 1600)
      } catch (err) {
        setImportError(err instanceof Error ? err.message : 'Could not import that file.')
      }
    }
    reader.onerror = () => setImportError('Could not read that file.')
    reader.readAsText(file)
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
        <button
          type="button"
          onClick={handleExport}
          className="min-h-11 rounded-lg border border-white/15 px-5 py-3 text-sm font-medium text-white/80 transition hover:bg-white/5"
        >
          Export Persona
        </button>
        <button
          type="button"
          onClick={handleImportClick}
          className="min-h-11 rounded-lg border border-white/15 px-5 py-3 text-sm font-medium text-white/80 transition hover:bg-white/5"
        >
          Import Persona
        </button>
        <button
          type="button"
          onClick={handleSaveToLibrary}
          disabled={!draft.name.trim()}
          className="min-h-11 rounded-lg border border-violet-400/30 bg-violet-500/10 px-5 py-3 text-sm font-medium text-violet-200 transition hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Save to Library
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          onChange={handleImportFile}
          className="hidden"
        />
        {savedPulse && (
          <span className="animate-fade-in-up text-xs font-medium text-emerald-300">
            Saved to this device ✓
          </span>
        )}
        {importPulse && (
          <span className="animate-fade-in-up text-xs font-medium text-emerald-300">
            Persona imported and saved ✓
          </span>
        )}
      </div>
      {importError && <p className="mt-3 text-xs text-rose-300">{importError}</p>}

      {library.length > 0 && (
        <div className="mt-5 border-t border-white/10 pt-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-white/40">
            Persona Library
          </p>
          <div className="flex flex-wrap gap-2">
            {library.map((saved) => (
              <div
                key={saved.id}
                className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 py-1.5 pl-3 pr-1.5 text-xs text-white/70"
              >
                <button
                  type="button"
                  onClick={() => handleLoadFromLibrary(saved)}
                  className="transition hover:text-white"
                >
                  {saved.name || 'Unnamed persona'}
                </button>
                <button
                  type="button"
                  onClick={() => onRemoveFromLibrary(saved.id)}
                  aria-label={`Remove ${saved.name || 'this persona'} from library`}
                  className="flex h-6 w-6 items-center justify-center rounded-full text-white/40 transition hover:bg-rose-500/20 hover:text-rose-300"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
