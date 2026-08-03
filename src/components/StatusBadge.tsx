interface StatusBadgeProps {
  hasCustomKey: boolean
}

export function StatusBadge({ hasCustomKey }: StatusBadgeProps) {
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${
        hasCustomKey
          ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
          : 'border-white/15 bg-white/5 text-white/60'
      }`}
      title={
        hasCustomKey
          ? 'Calling Claude directly from this browser with your saved API key.'
          : 'No personal API key saved — using the server proxy when configured, with structured mock diagnostics as a fallback.'
      }
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${hasCustomKey ? 'bg-emerald-400' : 'bg-white/40'}`}
      />
      {hasCustomKey ? 'Live Future-Self AI · Your Key' : 'Server Proxy / Mock Fallback'}
    </div>
  )
}
