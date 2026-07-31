import { isLiveAiConfigured } from '../lib/ai'

export function StatusBadge() {
  const live = isLiveAiConfigured
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${
        live
          ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
          : 'border-amber-400/30 bg-amber-400/10 text-amber-300'
      }`}
      title={
        live
          ? 'Connected to the Anthropic API for live Future-Self responses.'
          : 'No VITE_ANTHROPIC_API_KEY detected — using structured mock diagnostics.'
      }
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${live ? 'bg-emerald-400' : 'bg-amber-400'}`}
      />
      {live ? 'Live Future-Self AI' : 'Mock Diagnostics'}
    </div>
  )
}
