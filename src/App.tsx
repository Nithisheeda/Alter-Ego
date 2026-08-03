import { useState, type ReactNode } from 'react'
import { PersonaBuilder } from './components/PersonaBuilder'
import { DrillMode } from './components/DrillMode'
import { SituationalPrep } from './components/SituationalPrep'
import { StatusBadge } from './components/StatusBadge'
import { MasteryAnalyticsDrawer } from './components/MasteryAnalyticsDrawer'
import { WarmUpModal } from './components/WarmUpModal'
import { SettingsModal } from './components/SettingsModal'
import {
  loadPersona,
  savePersona,
  isPersonaComplete,
  loadPersonaLibrary,
  addPersonaToLibrary,
  removePersonaFromLibrary,
} from './lib/storage'
import { hasCustomApiKey } from './lib/ai'
import { loadUserFirstName } from './lib/settings'
import type { FutureSelfPersona, SavedPersona } from './types'

type Tab = 'drill' | 'situational'

function App() {
  const [persona, setPersona] = useState<FutureSelfPersona>(() => loadPersona())
  const [personaLibrary, setPersonaLibrary] = useState<SavedPersona[]>(() => loadPersonaLibrary())
  const [tab, setTab] = useState<Tab>('drill')
  const [analyticsOpen, setAnalyticsOpen] = useState(false)
  const [warmUpOpen, setWarmUpOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [customKeySet, setCustomKeySet] = useState(() => hasCustomApiKey())
  const [userFirstName, setUserFirstName] = useState(() => loadUserFirstName())

  const personaReady = isPersonaComplete(persona)

  function handlePersonaChange(next: FutureSelfPersona) {
    setPersona(next)
    savePersona(next)
  }

  function handleSaveToLibrary(next: FutureSelfPersona) {
    setPersonaLibrary(addPersonaToLibrary(next))
  }

  function handleRemoveFromLibrary(id: string) {
    setPersonaLibrary(removePersonaFromLibrary(id))
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(139,92,246,0.12),_transparent_60%)]" />

      <div className="relative mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
        <header className="mb-6 flex flex-col items-start gap-4 lg:mb-8 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-violet-400">
              Engine 2
            </p>
            <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">
              The Alter-Ego Speech &amp; Mindset Coach
            </h1>
            <p className="mt-2 max-w-xl text-sm text-white/50">
              Vocal cadence tracking meets identity-level coaching. Your Future-Self reviews the
              work — grounded, exacting, unshakeable.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setWarmUpOpen(true)}
              className="min-h-11 rounded-full border border-rose-400/30 bg-rose-500/10 px-4 py-2 text-xs font-medium text-rose-200 transition hover:border-rose-400/50 hover:bg-rose-500/20"
            >
              Emergency Warm-Up
            </button>
            <button
              type="button"
              onClick={() => setAnalyticsOpen(true)}
              className="min-h-11 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-medium text-white/70 transition hover:border-violet-400/40 hover:text-white"
            >
              Mastery Analytics
            </button>
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="min-h-11 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-medium text-white/70 transition hover:border-violet-400/40 hover:text-white"
            >
              Settings
            </button>
            <StatusBadge hasCustomKey={customKeySet} />
          </div>
        </header>

        <div className="space-y-6">
          <PersonaBuilder
            persona={persona}
            onChange={handlePersonaChange}
            library={personaLibrary}
            onSaveToLibrary={handleSaveToLibrary}
            onRemoveFromLibrary={handleRemoveFromLibrary}
            onLoadFromLibrary={() => {}}
          />

          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-1.5">
            <div className="flex flex-col gap-1 sm:flex-row">
              <TabButton active={tab === 'drill'} onClick={() => setTab('drill')}>
                Structured Speech Drill
              </TabButton>
              <TabButton active={tab === 'situational'} onClick={() => setTab('situational')}>
                Situational Mindset Prep
              </TabButton>
            </div>
          </div>

          {tab === 'drill' ? (
            <DrillMode
              persona={persona}
              personaReady={personaReady}
              userFirstName={userFirstName}
              personaLibrary={personaLibrary}
            />
          ) : (
            <SituationalPrep persona={persona} personaReady={personaReady} />
          )}
        </div>

        <footer className="mt-10 text-center text-xs text-white/25">
          Persona data stays on this device via localStorage.
        </footer>
      </div>

      <MasteryAnalyticsDrawer open={analyticsOpen} onClose={() => setAnalyticsOpen(false)} />
      <WarmUpModal open={warmUpOpen} onClose={() => setWarmUpOpen(false)} />
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onKeyChange={() => setCustomKeySet(hasCustomApiKey())}
        onNameChange={() => setUserFirstName(loadUserFirstName())}
      />
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-11 flex-1 rounded-xl px-4 py-3 text-sm font-medium transition ${
        active ? 'bg-violet-500 text-white shadow-lg shadow-violet-500/20' : 'text-white/50 hover:text-white/80'
      }`}
    >
      {children}
    </button>
  )
}

export default App
