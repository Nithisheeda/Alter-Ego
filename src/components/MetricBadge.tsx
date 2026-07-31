interface MetricBadgeProps {
  label: string
  value: string
  tone?: 'default' | 'warn' | 'good'
}

export function MetricBadge({ label, value, tone = 'default' }: MetricBadgeProps) {
  const toneClasses =
    tone === 'warn'
      ? 'border-amber-400/30 bg-amber-400/10 text-amber-300'
      : tone === 'good'
        ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
        : 'border-white/10 bg-white/5 text-white'

  return (
    <div className={`rounded-xl border px-4 py-3 ${toneClasses}`}>
      <p className="text-[10px] font-medium uppercase tracking-wider opacity-60">{label}</p>
      <p className="mt-0.5 text-xl font-semibold">{value}</p>
    </div>
  )
}
