import { ALLERGENS, DIET_TAGS, type Allergen, type DietTag } from '../data/schema'
import type { History } from '../engine/suggest'

const PREFS_KEY = 'breaktime.prefs.v1'
const HISTORY_KEY = 'breaktime.history.v1'
const PASSED_MEMORY = 20

export const BREAK_LENGTHS = [15, 30, 60] as const
export type BreakLength = (typeof BREAK_LENGTHS)[number]

export interface StoredPrefs {
  allergies: Allergen[]
  diets: DietTag[]
  /** Present only once the user has actually been through onboarding. */
  onboarded: true
}

interface StoredHistory extends History {
  /** Local calendar day this history belongs to. */
  day: string
}

/** Local, not UTC — "today" resets at the user's midnight, not London's. */
export function dayKey(now: Date): string {
  const m = `${now.getMonth() + 1}`.padStart(2, '0')
  const d = `${now.getDate()}`.padStart(2, '0')
  return `${now.getFullYear()}-${m}-${d}`
}

function read(key: string): unknown {
  try {
    const raw = localStorage.getItem(key)
    return raw === null ? null : JSON.parse(raw)
  } catch {
    // Private mode, disabled storage, or corrupt JSON. Treat as absent.
    return null
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage full or unavailable. The session still works; it just will not persist.
  }
}

const keepKnown = <T extends readonly string[]>(list: T, v: unknown): T[number][] =>
  Array.isArray(v) ? (v.filter((x) => (list as readonly unknown[]).includes(x)) as T[number][]) : []

/**
 * Returns null when the user has not onboarded — including when stored prefs are
 * unreadable or malformed. Sending someone back through a 20-second onboarding is
 * the safe failure; silently dropping their allergies is not.
 */
export function loadPrefs(): StoredPrefs | null {
  const raw = read(PREFS_KEY)
  if (typeof raw !== 'object' || raw === null) return null
  const o = raw as Record<string, unknown>
  if (o.onboarded !== true) return null
  return {
    allergies: keepKnown(ALLERGENS, o.allergies),
    diets: keepKnown(DIET_TAGS, o.diets),
    onboarded: true,
  }
}

export function savePrefs(prefs: Omit<StoredPrefs, 'onboarded'>): StoredPrefs {
  const next: StoredPrefs = {
    allergies: keepKnown(ALLERGENS, prefs.allergies),
    diets: keepKnown(DIET_TAGS, prefs.diets),
    onboarded: true,
  }
  write(PREFS_KEY, next)
  return next
}

export function loadHistory(now: Date): History {
  const raw = read(HISTORY_KEY)
  const empty: History = { takenToday: [], recentlyPassed: [] }
  if (typeof raw !== 'object' || raw === null) return empty
  const o = raw as Record<string, unknown>
  const strings = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []

  // A new day clears what you ate, but not what you keep skipping.
  const staleDay = o.day !== dayKey(now)
  return {
    takenToday: staleDay ? [] : strings(o.takenToday),
    recentlyPassed: strings(o.recentlyPassed),
  }
}

export function recordDecision(
  id: string,
  direction: 'pass' | 'take',
  now: Date,
  current: History = loadHistory(now),
): History {
  const next: History =
    direction === 'take'
      ? {
          takenToday: current.takenToday.includes(id)
            ? current.takenToday
            : [...current.takenToday, id],
          recentlyPassed: current.recentlyPassed.filter((x) => x !== id),
        }
      : {
          takenToday: current.takenToday,
          recentlyPassed: [id, ...current.recentlyPassed.filter((x) => x !== id)].slice(
            0,
            PASSED_MEMORY,
          ),
        }

  const stored: StoredHistory = { ...next, day: dayKey(now) }
  write(HISTORY_KEY, stored)
  return next
}

export function clearAll(): void {
  try {
    localStorage.removeItem(PREFS_KEY)
    localStorage.removeItem(HISTORY_KEY)
  } catch {
    // Nothing to clear if storage is unavailable.
  }
}
