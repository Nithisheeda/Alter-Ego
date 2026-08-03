const API_KEY_STORAGE_KEY = 'alter-ego:custom-api-key'
const USER_FIRST_NAME_STORAGE_KEY = 'alter-ego:user-first-name'

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

/** Used by Observer Mode's third-person self-distancing coaching, which needs
 * only a first name — no full Future-Self persona required. */
export function loadUserFirstName(): string {
  try {
    return localStorage.getItem(USER_FIRST_NAME_STORAGE_KEY)?.trim() ?? ''
  } catch {
    return ''
  }
}

export function saveUserFirstName(name: string) {
  try {
    if (name.trim()) {
      localStorage.setItem(USER_FIRST_NAME_STORAGE_KEY, name.trim())
    } else {
      localStorage.removeItem(USER_FIRST_NAME_STORAGE_KEY)
    }
  } catch {
    // localStorage unavailable — the name just won't persist across reloads.
  }
}
