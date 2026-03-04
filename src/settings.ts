/**
 * Centralised browser-side settings store.
 *
 * All user preferences that should persist across sessions live here.
 * A single namespaced localStorage key holds a JSON blob so every setting
 * is easy to inspect, back up, or wipe in DevTools.
 *
 * Adding a new setting:
 *   1. Add an optional field to AppSettings.
 *   2. Provide a default in DEFAULTS.
 *   3. Call saveSettings({ yourNewField: value }) wherever it changes.
 *   4. Read it back with loadSettings().yourNewField.
 *
 * Breaking schema changes (rename / type change):
 *   Bump SETTINGS_VERSION. Stored data from the previous version will be
 *   discarded and DEFAULTS will be used instead.
 */

const STORAGE_KEY = 'fusion-demo-v3:settings'
const SETTINGS_VERSION = 1

export interface AppSettings {
  /** IDs of BOM columns the user has chosen to display. */
  bomVisibleColumns?: string[]
}

const DEFAULTS: AppSettings = {
  // bomVisibleColumns default is intentionally absent here so BomTab can
  // supply DEFAULT_VISIBLE_COLUMNS as the fallback, keeping column
  // definitions as the single source of truth.
}

interface StoredEnvelope {
  _version: number
  data: AppSettings
}

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULTS }
    const envelope: StoredEnvelope = JSON.parse(raw)
    if (envelope._version !== SETTINGS_VERSION) return { ...DEFAULTS }
    return { ...DEFAULTS, ...envelope.data }
  } catch {
    return { ...DEFAULTS }
  }
}

export function saveSettings(patch: Partial<AppSettings>): void {
  const current = loadSettings()
  const next: StoredEnvelope = {
    _version: SETTINGS_VERSION,
    data: { ...current, ...patch },
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
}
