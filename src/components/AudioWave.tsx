interface AudioWaveProps {
  levels: number[]
  active: boolean
}

export function AudioWave({ levels, active }: AudioWaveProps) {
  return (
    <div className="flex h-16 items-center justify-center gap-[3px] rounded-xl bg-black/30 px-4">
      {levels.map((level, i) => (
        <div
          key={i}
          className={`w-1.5 rounded-full ${active ? 'bg-violet-400 shadow-[0_0_8px_rgba(167,139,250,0.6)]' : 'bg-white/15'}`}
          style={{
            height: `${Math.max(8, level * 56)}px`,
            transition: 'height 0.08s ease-out, background-color 0.3s ease',
          }}
        />
      ))}
    </div>
  )
}
