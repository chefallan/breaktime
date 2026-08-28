import { describe, expect, it } from 'vitest'
import { RECIPES } from './recipes'
import { BREAK_LENGTHS } from '../state/prefs'
import { EMPTY_HISTORY, suggest, type Prefs } from '../engine/suggest'
import type { Allergen, Daypart } from '../data/schema'

/**
 * Coverage, not correctness. These guard the thing a user notices and a unit test
 * does not: a deck that is technically valid but has nothing in it.
 */

const AT_MERIENDA = { now: new Date(2026, 0, 15, 15, 0), seed: 11 }

/** Someone with two common restrictions — not a worst case, a typical one. */
const TYPICAL: Omit<Prefs, 'breakMinutes'> = {
  allergies: ['shellfish', 'peanut'],
  diets: [],
}

const MINIMUM_PER_BUCKET = 15

describe('deck depth', () => {
  it.each(BREAK_LENGTHS)('has enough for a %i-minute break with no restrictions', (minutes) => {
    const deck = suggest(RECIPES, { ...TYPICAL, allergies: [], breakMinutes: minutes }, EMPTY_HISTORY, AT_MERIENDA)
    expect(deck.length).toBeGreaterThanOrEqual(MINIMUM_PER_BUCKET)
  })

  it.each(BREAK_LENGTHS)('still has enough for a %i-minute break under typical exclusions', (minutes) => {
    const deck = suggest(RECIPES, { ...TYPICAL, breakMinutes: minutes }, EMPTY_HISTORY, AT_MERIENDA)
    expect(deck.length, `only ${deck.length} cards survive a ${minutes}-minute break`).toBeGreaterThanOrEqual(
      MINIMUM_PER_BUCKET,
    )
  })

  it('leaves a vegetarian something to eat at every break length', () => {
    for (const minutes of BREAK_LENGTHS) {
      const deck = suggest(
        RECIPES,
        { allergies: [], diets: ['vegetarian'], breakMinutes: minutes },
        EMPTY_HISTORY,
        AT_MERIENDA,
      )
      expect(deck.length, `vegetarian ${minutes}-minute deck is thin`).toBeGreaterThanOrEqual(8)
    }
  })

  it('leaves a vegan something to eat on a normal break', () => {
    const deck = suggest(
      RECIPES,
      { allergies: [], diets: ['vegan'], breakMinutes: 30 },
      EMPTY_HISTORY,
      AT_MERIENDA,
    )
    expect(deck.length).toBeGreaterThanOrEqual(8)
  })

  it('never leaves a single allergy exclusion with an empty 30-minute deck', () => {
    const all: Allergen[] = [
      'peanut',
      'treenut',
      'shellfish',
      'fish',
      'egg',
      'dairy',
      'soy',
      'gluten',
      'sesame',
      'coconut',
    ]
    for (const a of all) {
      const deck = suggest(
        RECIPES,
        { allergies: [a], diets: [], breakMinutes: 30 },
        EMPTY_HISTORY,
        AT_MERIENDA,
      )
      expect(deck.length, `excluding ${a} leaves too little`).toBeGreaterThanOrEqual(10)
    }
  })
})

describe('daypart depth', () => {
  // A night-shift worker at 2am must not get a visibly thinner app than
  // someone taking a 3pm merienda.
  it.each(['morning', 'midday', 'merienda', 'evening', 'graveyard'] as Daypart[])(
    'has real choice during %s',
    (daypart) => {
      const matching = RECIPES.filter((r) => r.dayparts.includes(daypart))
      expect(matching.length, `${daypart} has only ${matching.length} recipes`).toBeGreaterThanOrEqual(10)
    },
  )
})

describe('the set as a whole', () => {
  it('is at least 60 recipes', () => {
    expect(RECIPES.length).toBeGreaterThanOrEqual(60)
  })

  it('has both something to cook and something to sip', () => {
    expect(RECIPES.filter((r) => r.kind === 'dish').length).toBeGreaterThanOrEqual(30)
    expect(RECIPES.filter((r) => r.kind === 'drink').length).toBeGreaterThanOrEqual(15)
  })

  it('gives every dish a drink that actually exists', () => {
    const drinks = new Set(RECIPES.filter((r) => r.kind === 'drink').map((r) => r.id))
    for (const dish of RECIPES.filter((r) => r.kind === 'dish')) {
      expect(dish.pairsWith, `${dish.id} has no sip`).toBeTruthy()
      expect(drinks.has(dish.pairsWith!), `${dish.id} points at a missing drink`).toBe(true)
    }
  })

  it('keeps every recipe inside the longest break', () => {
    const longest = Math.max(...BREAK_LENGTHS)
    for (const r of RECIPES) {
      expect(r.totalMinutes, `${r.id} cannot fit any break`).toBeLessThanOrEqual(longest)
    }
  })

  it('writes a distinct tagline for every recipe', () => {
    const taglines = RECIPES.map((r) => r.tagline)
    expect(new Set(taglines).size).toBe(taglines.length)
  })
})
