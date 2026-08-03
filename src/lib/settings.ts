const API_KEY_STORAGE_KEY = 'alter-ego:custom-api-key'

export function loadCustomApiKey(): string | null {
  try {
    const raw = localStorage.getItem(API_KEY_STORAGE_KEY)
    return raw && raw.trim() ? raw.trim() : null
  } catch {
    return null
  }
}

export function saveCustomApiKey(key: string) {
  try {
    if (key.trim()) {
      localStorage.setItem(API_KEY_STORAGE_KEY, key.trim())
    } else {
      localStorage.removeItem(API_KEY_STORAGE_KEY)
    }
  } catch {
    // localStorage unavailable — the key just won't persist across reloads.
  }
}

export function clearCustomApiKey() {
  try {
    localStorage.removeItem(API_KEY_STORAGE_KEY)
  } catch {
    // no-op
  }
}
