import { useSpeechSynthesis, type TtsRate } from '../hooks/useSpeechSynthesis'

const RATES: TtsRate[] = [1, 1.25]

interface TtsControlsProps {
  text: string
  label?: string
}

export function TtsControls({ text, label = 'Listen to Feedback' }: TtsControlsProps) {
  const tts = useSpeechSynthesis()

  if (!tts.supported) return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => tts.toggle(text)}
        className={`flex min-h-9 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
          tts.speaking
            ? 'border-violet-400/60 bg-violet-500/20 text-violet-200'
            : 'border-white/15 bg-white/5 text-white/60 hover:text-white'
        }`}
      >
        <SpeakerIcon />
        {tts.speaking ? 'Stop' : label}
      </button>

      <div className="flex items-center gap-0.5 rounded-full border border-white/15 bg-white/5 p-0.5">
        {RATES.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => tts.changeRate(r, text)}
            className={`min-h-8 rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
              tts.rate === r ? 'bg-violet-500 text-white' : 'text-white/50 hover:text-white'
            }`}
          >
            {r}x
          </button>
        ))}
      </div>
    </div>
  )
}

function SpeakerIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden="true">
      <path d="M11 5 6 9H2v6h4l5 4V5Z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
    </svg>
  )
}
