import { useEffect, useRef, useState } from 'react'

const WAVEFORM_BARS = 56

interface AudioPlaybackProps {
  audioUrl: string
  label?: string
}

export function AudioPlayback({ audioUrl, label = 'Your take' }: AudioPlaybackProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [peaks, setPeaks] = useState<number[] | null>(null)

  useEffect(() => {
    let cancelled = false
    setPeaks(null)
    setProgress(0)
    setCurrentTime(0)
    setPlaying(false)

    async function extractPeaks() {
      try {
        const AudioCtx =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        const ctx = new AudioCtx()
        const response = await fetch(audioUrl)
        const arrayBuffer = await response.arrayBuffer()
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer)
        const channel = audioBuffer.getChannelData(0)
        const bucketSize = Math.max(1, Math.floor(channel.length / WAVEFORM_BARS))
        const next: number[] = []
        for (let i = 0; i < WAVEFORM_BARS; i++) {
          let max = 0
          const start = i * bucketSize
          for (let j = start; j < start + bucketSize && j < channel.length; j++) {
            const abs = Math.abs(channel[j])
            if (abs > max) max = abs
          }
          next.push(max)
        }
        const peakMax = Math.max(...next, 0.01)
        void ctx.close()
        if (!cancelled) setPeaks(next.map((v) => Math.max(0.08, v / peakMax)))
      } catch {
        if (!cancelled) setPeaks(new Array(WAVEFORM_BARS).fill(0.35))
      }
    }

    void extractPeaks()
    return () => {
      cancelled = true
    }
  }, [audioUrl])

  function togglePlay() {
    const audio = audioRef.current
    if (!audio) return
    if (playing) {
      audio.pause()
    } else {
      void audio.play()
    }
  }

  function handleSeek(ratio: number) {
    const audio = audioRef.current
    if (!audio || !duration) return
    audio.currentTime = ratio * duration
    setProgress(ratio)
  }

  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3 sm:p-4">
      <audio
        ref={audioRef}
        src={audioUrl}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false)
          setProgress(0)
          setCurrentTime(0)
        }}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onTimeUpdate={(e) => {
          const audio = e.currentTarget
          setCurrentTime(audio.currentTime)
          if (audio.duration) setProgress(audio.currentTime / audio.duration)
        }}
        className="hidden"
      />

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={togglePlay}
          aria-label={playing ? 'Pause playback' : 'Play your recording'}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-violet-500 text-white transition hover:bg-violet-400 active:scale-[0.96]"
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
        </button>

        <div className="min-w-0 flex-1">
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-white/40">
            {label}
          </p>
          <div
            role="slider"
            aria-label="Seek playback"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
            tabIndex={0}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect()
              handleSeek(Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)))
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') handleSeek(Math.min(1, progress + 0.05))
              if (e.key === 'ArrowLeft') handleSeek(Math.max(0, progress - 0.05))
            }}
            className="flex h-11 cursor-pointer items-end gap-[2px]"
          >
            {(peaks ?? new Array(WAVEFORM_BARS).fill(0.15)).map((peak, i) => {
              const barRatio = i / WAVEFORM_BARS
              const played = barRatio <= progress
              return (
                <div
                  key={i}
                  className={`min-w-[2px] flex-1 rounded-full transition-colors ${
                    played ? 'bg-violet-400' : 'bg-white/15'
                  }`}
                  style={{ height: `${Math.max(10, peak * 100)}%` }}
                />
              )
            })}
          </div>
        </div>

        <span className="w-16 shrink-0 text-right text-[11px] tabular-nums text-white/40">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>
    </div>
  )
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <path d="M8 5v14l11-7z" />
    </svg>
  )
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
    </svg>
  )
}
