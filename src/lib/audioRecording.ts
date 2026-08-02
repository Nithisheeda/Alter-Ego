const AUDIO_MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/mpeg']

export function pickSupportedAudioMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return undefined
  return AUDIO_MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type))
}

export function describeMediaError(err: unknown): string {
  if (err instanceof DOMException) {
    switch (err.name) {
      case 'NotAllowedError':
      case 'PermissionDeniedError':
        return "Microphone access is blocked. Open Settings → Safari → Microphone (or your browser's site settings) and allow access, then try again."
      case 'NotFoundError':
      case 'DevicesNotFoundError':
        return 'No microphone was found on this device.'
      case 'NotReadableError':
      case 'TrackStartError':
        return 'Your microphone is already in use by another app. Close it and try again.'
      case 'SecurityError':
        return 'Microphone access requires a secure (https) connection.'
      default:
        return `Microphone access failed: ${err.message || err.name}`
    }
  }
  return err instanceof Error ? `Microphone access failed: ${err.message}` : 'Microphone access failed.'
}
