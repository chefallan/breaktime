import type { Allergen, DietTag, Recipe } from '../data/schema'
import { daypartFor } from './daypart'

export interface Prefs {
  /** Hard exclusions. A recipe carrying any of these must never be dealt. */
  allergies: Allergen[]
  /** A recipe must carry every diet the user follows to qualify. */
  diets: DietTag[]
  /** Minutes the user actually has. Wall-clock. */
  breakMinutes: number
}

export interface History {
  /** Taken earlier today. Suppressed so the same merienda is not offered twice. */
  takenToday: string[]
  /** Passed recently. Demoted, not removed — tastes change by the hour. */
  recentlyPassed: string[]
}

export interface SuggestOptions {
  now: Date
  /** Fixes the per-session shuffle. Same seed, same deck — which is what makes this testable. */
  seed?: number
}

export const EMPTY_HISTORY: History = { takenToday: [], recentlyPassed: [] }

const DAYPART_BONUS = 4
const PASSED_PENALTY = 3
const JITTER_WEIGHT = 1.5

/**
 * Deterministic per-recipe jitter, so a deck varies between sessions but not
 * within one. FNV-1a with a murmur3 finalizer: the finalizer is the part that
 * matters, because a hash that merely offsets every id by the seed shifts the
 * whole deck uniformly and can never actually reorder it.
 */
function jitter(id: string, seed: number): number {
  let h = (2166136261 ^ seed) >>> 0
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  h ^= h >>> 15
  h = Math.imul(h, 2246822507)
  h ^= h >>> 13
  h = Math.imul(h, 3266489909)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

/**
 * The two hard filters. Never relaxed, by anything, for any reason:
 * an allergen would hurt someone, and a recipe that overruns the break
 * breaks the only promise the app makes.
 */
function isEligible(recipe: Recipe, prefs: Prefs): boolean {
  if (recipe.totalMinutes > prefs.breakMinutes) return false
  for (const a of prefs.allergies) {
    if (recipe.allergens.includes(a)) return false
  }
  for (const d of prefs.diets) {
    if (!recipe.dietTags.includes(d)) return false
  }
  return true
}

function score(recipe: Recipe, history: History, opts: Required<SuggestOptions>): number {
  let s = 0
  if (recipe.dayparts.includes(daypartFor(opts.now))) s += DAYPART_BONUS
  if (history.recentlyPassed.includes(recipe.id)) s -= PASSED_PENALTY
  return s + jitter(recipe.id, opts.seed) * JITTER_WEIGHT
}

/**
 * Builds the deck, best card first.
 *
 * Ordering is a soft concern; eligibility is not. Anything ineligible is absent,
 * never merely ranked low.
 */
export function suggest(
  recipes: Recipe[],
  prefs: Prefs,
  history: History = EMPTY_HISTORY,
  opts: SuggestOptions = { now: new Date() },
): Recipe[] {
  const resolved: Required<SuggestOptions> = { now: opts.now, seed: opts.seed ?? 0 }
  const eligible = recipes.filter((r) => isEligible(r, prefs))

  const byScore = (a: Recipe, b: Recipe) => score(b, history, resolved) - score(a, history, resolved)

  const fresh = eligible.filter((r) => !history.takenToday.includes(r.id)).sort(byScore)

  // Degrade rather than deal an empty deck: a repeat beats a blank screen. Only
  // the "already taken today" suppression is relaxed — never a hard filter.
  if (fresh.length === 0) {
    return eligible.slice().sort(byScore)
  }
  return fresh
}
