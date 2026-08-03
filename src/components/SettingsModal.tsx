import { useEffect, useState } from 'react'
import {
  clearCustomApiKey,
  loadCustomApiKey,
  loadUserFirstName,
  saveCustomApiKey,
  saveUserFirstName,
} from '../lib/settings'

interface SettingsModalProps {
  open: boolean
  onClose: () => void
  onKeyChange: () => void
  onNameChange: () => void
}

export function SettingsModal({ open, onClose, onKeyChange, onNameChange }: SettingsModalProps) {
  const [keyDraft, setKeyDraft] = useState('')
  const [nameDraft, setNameDraft] = useState('')
  const [savedPulse, setSavedPulse] = useState(false)

  useEffect(() => {
    if (open) {
      setKeyDraft(loadCustomApiKey() ?? '')
      setNameDraft(loadUserFirstName())
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  function handleSave() {
    saveCustomApiKey(keyDraft)
    saveUserFirstName(nameDraft)
    onKeyChange()
    onNameChange()
    setSavedPulse(true)
    setTimeout(() => setSavedPulse(false), 1600)
  }

  function handleClear() {
    clearCustomApiKey()
    setKeyDraft('')
    onKeyChange()
  }

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden="true"
        className={`fixed inset-0 z-40 bg-black/70 transition-opacity ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        className={`fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 rounded-2xl border border-white/10 bg-[#0e0e15] p-5 shadow-2xl transition-all duration-200 sm:p-6 ${
          open ? 'translate-y-[-50%] opacity-100' : 'translate-y-[-45%] opacity-0 pointer-events-none'
        }`}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Settings</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-white/60 transition hover:text-white"
          >
            ✕
          </button>
        </div>

        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-white/40">
          Your First Name (optional)
        </label>
        <input
          type="text"
          value={nameDraft}
          onChange={(e) => setNameDraft(e.target.value)}
          placeholder="e.g. Alex"
          className="min-h-11 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-3 text-base text-white placeholder:text-white/25 focus:border-violet-400/50 focus:outline-none focus:ring-1 focus:ring-violet-400/50"
        />
        <p className="mt-2 text-xs leading-relaxed text-white/40">
          Powers Observer Mode's third-person self-distancing coaching — no full Future-Self
          persona required.
        </p>

        <label className="mb-1.5 mt-5 block text-xs font-medium uppercase tracking-wide text-white/40">
          Your Anthropic API Key (optional)
        </label>
        <input
          type="password"
          value={keyDraft}
          onChange={(e) => setKeyDraft(e.target.value)}
          placeholder="sk-ant-…"
          autoComplete="off"
          className="min-h-11 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-3 text-base text-white placeholder:text-white/25 focus:border-violet-400/50 focus:outline-none focus:ring-1 focus:ring-violet-400/50"
        />
        <p className="mt-2 text-xs leading-relaxed text-white/40">
          Bring your own key to call Claude directly from this browser. Leave this blank to use the
          server proxy when it's configured, or structured mock diagnostics otherwise. Stored only
          in this browser's localStorage — never sent anywhere but Anthropic.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            className="min-h-11 rounded-lg bg-violet-500 px-5 py-3 text-sm font-medium text-white transition hover:bg-violet-400 active:scale-[0.98]"
          >
            Save Key
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="min-h-11 rounded-lg border border-white/15 px-5 py-3 text-sm font-medium text-white/80 transition hover:bg-white/5"
          >
            Clear
          </button>
          {savedPulse && (
            <span className="animate-fade-in-up text-xs font-medium text-emerald-300">Saved ✓</span>
          )}
        </div>
      </div>
    </>
  )
}
