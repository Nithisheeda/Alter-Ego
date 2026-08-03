import { useEffect, useRef, useState } from 'react'
import { vibrate } from '../lib/haptics'

interface WarmUpStep {
  title: string
  instruction: string
  seconds: number
}

const WARM_UP_STEPS: WarmUpStep[] = [
  {
    title: 'Diaphragmatic Breath',
    instruction:
      'Breathe in through the nose for 4 counts, hold for 4, then exhale slowly for 6. Reset your breath support before anything else.',
    seconds: 15,
  },
  {
    title: 'Consonant Plosives',
    instruction: 'Repeat sharply: "Pa-Ta-Ka, Pa-Ta-Ka." Crisp releases — no mumbling through the stops.',
    seconds: 20,
  },
  {
    title: 'Pitch Range Holds',
    instruction:
      'Hum from your lowest comfortable note up to your highest, then back down. Feel the stretch through your full range.',
    seconds: 20,
  },
  {
    title: 'Ready',
    instruction: 'Shoulders back. Feet planted. You are warmed up and ready to record.',
    seconds: 5,
  },
]

const TOTAL_SECONDS = WARM_UP_STEPS.reduce((sum, s) => sum + s.seconds, 0)

function stepAt(elapsed: number) {
  let acc = 0
  for (let i = 0; i < WARM_UP_STEPS.length; i++) {
    const step = WARM_UP_STEPS[i]
    if (elapsed < acc + step.seconds) {
      return { step, index: i, secondsIntoStep: elapsed - acc }
    }
    acc += step.seconds
  }
  const lastIndex = WARM_UP_STEPS.length - 1
  return { step: WARM_UP_STEPS[lastIndex], index: lastIndex, secondsIntoStep: WARM_UP_STEPS[lastIndex].seconds }
}

interface WarmUpModalProps {
  open: boolean
  onClose: () => void
}

export function WarmUpModal({ open, onClose }: WarmUpModalProps) {
  const [elapsed, setElapsed] = useState(0)
  const [running, setRunning] = useState(false)

  useEffect(() => {
    if (!open) {
      setElapsed(0)
      setRunning(false)
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

  useEffect(() => {
    if (!running) return
    if (elapsed >= TOTAL_SECONDS) {
      setRunning(false)
      vibrate([50, 50, 50])
      return
    }
    const id = setTimeout(() => setElapsed((e) => e + 1), 1000)
    return () => clearTimeout(id)
  }, [running, elapsed])

  const { step, index, secondsIntoStep } = stepAt(Math.min(elapsed, TOTAL_SECONDS - 1))
  const secondsLeftInStep = Math.max(0, step.seconds - secondsIntoStep)
  const done = elapsed >= TOTAL_SECONDS

  const lastVibratedIndexRef = useRef(-1)
  useEffect(() => {
    if (running && lastVibratedIndexRef.current !== -1 && lastVibratedIndexRef.current !== index) {
      vibrate([30])
    }
    lastVibratedIndexRef.current = index
  }, [index, running])

  function handleStart() {
    setElapsed(0)
    setRunning(true)
  }

  function handlePauseResume() {
    setRunning((r) => !r)
  }

  function handleRestart() {
    setElapsed(0)
    setRunning(true)
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
        aria-label="Emergency Warm-Up"
        className={`fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 rounded-2xl border border-white/10 bg-[#0e0e15] p-5 shadow-2xl transition-all duration-200 sm:p-6 ${
          open ? 'translate-y-[-50%] opacity-100' : 'translate-y-[-45%] opacity-0 pointer-events-none'
        }`}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Emergency Warm-Up</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-white/60 transition hover:text-white"
          >
            ✕
          </button>
        </div>

        {!running && elapsed === 0 ? (
          <div>
            <p className="text-sm text-white/50">
              60 seconds. Breath, plosives, and pitch range — get grounded before you record.
            </p>
            <button
              type="button"
              onClick={handleStart}
              className="mt-5 min-h-11 w-full rounded-lg bg-violet-500 px-5 py-3 text-sm font-medium text-white transition hover:bg-violet-400 active:scale-[0.98]"
            >
              Start 60s Warm-Up
            </button>
          </div>
        ) : done ? (
          <div>
            <p className="text-sm font-medium text-emerald-300">Warm-up complete.</p>
            <p className="mt-1 text-sm text-white/50">{step.instruction}</p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={handleRestart}
                className="min-h-11 flex-1 rounded-lg border border-white/15 px-4 py-2.5 text-sm font-medium text-white/80 transition hover:bg-white/5"
              >
                Again
              </button>
              <button
                type="button"
                onClick={onClose}
                className="min-h-11 flex-1 rounded-lg bg-violet-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-violet-400"
              >
                Done — Go Record
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="mb-3 flex items-center justify-between text-xs text-white/40">
              <span>
                Step {index + 1} / {WARM_UP_STEPS.length}
              </span>
              <span className="font-mono">{secondsLeftInStep}s</span>
            </div>
            <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-violet-400 transition-[width] duration-1000 ease-linear"
                style={{ width: `${(elapsed / TOTAL_SECONDS) * 100}%` }}
              />
            </div>

            <p className="text-sm font-semibold uppercase tracking-wide text-violet-300">{step.title}</p>
            <p className="mt-2 text-base leading-relaxed text-white">{step.instruction}</p>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={handlePauseResume}
                className="min-h-11 flex-1 rounded-lg border border-white/15 px-4 py-2.5 text-sm font-medium text-white/80 transition hover:bg-white/5"
              >
                {running ? 'Pause' : 'Resume'}
              </button>
              <button
                type="button"
                onClick={handleRestart}
                className="min-h-11 flex-1 rounded-lg border border-white/15 px-4 py-2.5 text-sm font-medium text-white/80 transition hover:bg-white/5"
              >
                Restart
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
