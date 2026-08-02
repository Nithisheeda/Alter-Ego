import type { PassagePart } from '../types'

interface PassageDisplayProps {
  parts: PassagePart[]
  showLegend?: boolean
}

export function PassageDisplay({ parts, showLegend = true }: PassageDisplayProps) {
  return (
    <div>
      <div className="min-h-[140px] rounded-xl border border-white/10 bg-black/20 p-4 text-[15px] leading-relaxed text-white/80 sm:p-5">
        {parts.map((part, i) => {
          if (part.type === 'pause') {
            return (
              <span
                key={i}
                className="mx-1 inline-flex items-center rounded-md border border-white/15 bg-white/10 px-1.5 py-0.5 align-middle font-mono text-[11px] font-medium text-white/50"
                title={`Strategic pause — hold for ${part.seconds}s`}
              >
                ⏸ {part.seconds}s
              </span>
            )
          }
          if (part.type === 'power') {
            return (
              <strong key={i} className="font-bold text-violet-300">
                {part.text}
              </strong>
            )
          }
          if (part.type === 'diction') {
            return (
              <span
                key={i}
                className="text-amber-200 underline decoration-amber-400/70 decoration-dotted decoration-2 underline-offset-4"
                title="Tricky consonant cluster — enunciate sharply"
              >
                {part.text}
              </span>
            )
          }
          return <span key={i}>{part.text}</span>
        })}
      </div>

      {showLegend && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-white/40">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-violet-300" /> Power word — stress it
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-400" /> Diction focus — enunciate sharply
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-md bg-white/30" /> [ ⏸ ] — strategic pause
          </span>
        </div>
      )}
    </div>
  )
}
