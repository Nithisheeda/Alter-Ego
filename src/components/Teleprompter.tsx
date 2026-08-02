import { useEffect, useMemo, useRef } from 'react'
import type { PassagePart } from '../types'
import { tokenizeForTeleprompter } from '../lib/teleprompter'

interface TeleprompterProps {
  parts: PassagePart[]
  targetWpm: number
  elapsedSeconds: number
  active: boolean
}

export function Teleprompter({ parts, targetWpm, elapsedSeconds, active }: TeleprompterProps) {
  const tokens = useMemo(() => tokenizeForTeleprompter(parts), [parts])
  const totalWords = useMemo(
    () => tokens.reduce((count, t) => (t.wordIndex !== null ? count + 1 : count), 0),
    [tokens],
  )
  const currentWordIndex = active ? Math.floor((elapsedSeconds * targetWpm) / 60) : -1
  const activeWordRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!active) return
    activeWordRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [currentWordIndex, active])

  const progressPct = totalWords > 0 ? Math.min(100, (Math.max(0, currentWordIndex) / totalWords) * 100) : 0

  return (
    <div>
      <div className="max-h-[280px] overflow-y-auto rounded-xl border border-white/10 bg-black/30 p-5 text-xl leading-relaxed sm:text-2xl">
        {tokens.map((token) => {
          if (token.isPause) {
            return (
              <span
                key={token.key}
                className="mx-1 inline-flex items-center rounded-md border border-white/15 bg-white/10 px-1.5 py-0.5 align-middle font-mono text-xs font-medium text-white/40"
              >
                {token.text}
              </span>
            )
          }

          const isCurrent = active && token.wordIndex === currentWordIndex
          const isPast = active && token.wordIndex !== null && token.wordIndex < currentWordIndex

          return (
            <span
              key={token.key}
              ref={isCurrent ? activeWordRef : undefined}
              className={[
                'mr-[0.4ch] inline-block rounded transition-colors duration-150',
                token.markType === 'power' ? 'font-bold text-violet-300' : '',
                token.markType === 'diction'
                  ? 'text-amber-200 underline decoration-amber-400/70 decoration-dotted underline-offset-4'
                  : '',
                isCurrent
                  ? 'bg-violet-500/30 px-1 text-white'
                  : isPast
                    ? 'text-white/25'
                    : token.markType
                      ? ''
                      : 'text-white/85',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {token.text}
            </span>
          )
        })}
      </div>

      {active && (
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-violet-400 transition-[width] duration-150"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      )}
    </div>
  )
}
