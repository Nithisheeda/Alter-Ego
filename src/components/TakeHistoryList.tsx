import type { Take } from '../lib/takes'

interface TakeHistoryListProps {
  takes: Take[]
  selectedIds: string[]
  onToggle: (id: string) => void
}

export function TakeHistoryList({ takes, selectedIds, onToggle }: TakeHistoryListProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-white">Your Takes</h3>
        <span className="text-xs text-white/40">
          {selectedIds.length === 2
            ? 'Comparing 2 takes below'
            : takes.length < 2
              ? 'Record another take to unlock comparison'
              : 'Select two takes to compare'}
        </span>
      </div>

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {takes.map((take) => {
          const selected = selectedIds.includes(take.id)
          return (
            <button
              key={take.id}
              type="button"
              onClick={() => onToggle(take.id)}
              aria-pressed={selected}
              className={`min-h-11 shrink-0 rounded-xl border px-3 py-2 text-left transition ${
                selected
                  ? 'border-violet-400/60 bg-violet-500/15'
                  : 'border-white/10 bg-white/5 hover:border-white/20'
              }`}
            >
              <p className="flex items-center gap-1.5 text-xs font-semibold text-white">
                {selected && <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />}
                {take.label}
              </p>
              <p className="text-[11px] text-white/50">
                {take.metrics.wpm} WPM
                {take.analysis?.overallScore !== null && take.analysis
                  ? ` · ${take.analysis.overallScore}/100`
                  : ''}
              </p>
            </button>
          )
        })}
      </div>
    </div>
  )
}
