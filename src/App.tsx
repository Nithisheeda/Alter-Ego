import { useState, type ReactNode } from 'react'
import { PersonaBuilder } from './components/PersonaBuilder'
import { DrillMode } from './components/DrillMode'
import { SituationalPrep } from './components/SituationalPrep'
import { StatusBadge } from './components/StatusBadge'
import { loadPersona, savePersona, isPersonaComplete } from './lib/storage'
import type { FutureSelfPersona } from './types'

type Tab = 'drill' | 'situational'

function App() {
  const [persona, setPersona] = useState<FutureSelfPersona>(() => loadPersona())
  const [tab, setTab] = useState<Tab>('drill')

  const personaReady = isPersonaComplete(persona)

  function handlePersonaChange(next: FutureSelfPersona) {
    setPersona(next)
    savePersona(next)
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
          <StatusBadge />
        </header>

        <div className="space-y-6">
          <PersonaBuilder persona={persona} onChange={handlePersonaChange} />

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
            <DrillMode persona={persona} personaReady={personaReady} />
          ) : (
            <SituationalPrep persona={persona} personaReady={personaReady} />
          )}
        </div>

        <footer className="mt-10 text-center text-xs text-white/25">
          Persona data stays on this device via localStorage.
        </footer>
      </div>
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
