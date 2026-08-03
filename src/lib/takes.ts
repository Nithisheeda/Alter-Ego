import type { SpeechMetrics } from '../types'
import type { DeliveryAnalysis } from './vocalAnalysis'
import type { TelemetrySample } from './pitchAnalysis'

export interface Take {
  id: string
  label: string
  passageTitle: string
  createdAt: number
  metrics: SpeechMetrics
  analysis: DeliveryAnalysis | null
  audioUrl: string | null
  telemetry: TelemetrySample[]
}

export function createTakeId(): string {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `take-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

/** Takes own their object-URL audio blobs once captured — revoke them when the list is discarded. */
export function revokeTakeAudio(takes: Take[]) {
  for (const take of takes) {
    if (take.audioUrl) URL.revokeObjectURL(take.audioUrl)
  }
}
