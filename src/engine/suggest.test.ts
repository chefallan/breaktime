import { describe, expect, it } from 'vitest'
import { EMPTY_HISTORY, suggest, type Prefs } from './suggest'
import type { Allergen, Daypart, DietTag, Recipe } from '../data/schema'
import { RECIPES } from '../data/recipes'

const make = (over: Partial<Recipe> & { id: string }): Recipe => ({
  title: over.id,
  tagline: 'tagline',
  kind: 'dish',
  totalMinutes: 15,
  effort: 'one-pot',
  serves: 1,
  dayparts: ['merienda'],
  dietTags: [],
  allergens: [],
  ingredients: [{ item: 'Something', amount: '1' }],
  steps: ['Cook it.'],
  ...over,
})

const prefs = (over: Partial<Prefs> = {}): Prefs => ({
  allergies: [],
  diets: [],
  breakMinutes: 30,
  ...over,
})

/** 15:00 — squarely inside merienda. */
const AT_MERIENDA = { now: new Date(2026, 0, 15, 15, 0), seed: 7 }
const ids = (rs: Recipe[]) => rs.map((r) => r.id)

describe('hard filters', () => {
  // The one place in this app where being wrong hurts someone. An excluded
  // allergen must be ABSENT, not merely ranked last.
  it('never deals a recipe containing a declared allergen', () => {
    const deck = [
      make({ id: 'kare-kare', allergens: ['peanut'] }),
      make({ id: 'turon', allergens: ['gluten'] }),
      make({ id: 'salabat' }),
    ]
    const out = suggest(deck, prefs({ allergies: ['peanut'] }), EMPTY_HISTORY, AT_MERIENDA)
    expect(ids(out)).not.toContain('kare-kare')
    expect(ids(out)).toEqual(expect.arrayContaining(['turon', 'salabat']))
  })

  it('excludes a recipe if ANY declared allergen matches', () => {
    const deck = [make({ id: 'multi', allergens: ['dairy', 'egg'] })]
    expect(suggest(deck, prefs({ allergies: ['egg'] }), EMPTY_HISTORY, AT_MERIENDA)).toEqual([])
  })

  it('keeps the allergy filter even when it empties the deck completely', () => {
    const deck = [make({ id: 'a', allergens: ['peanut'] }), make({ id: 'b', allergens: ['peanut'] })]
    // Degrading must never reach for an unsafe card to avoid a blank screen.
    expect(suggest(deck, prefs({ allergies: ['peanut'] }), EMPTY_HISTORY, AT_MERIENDA)).toEqual([])
  })

  it('holds across the real recipe set for every allergen', () => {
    const all: Allergen[] = ['peanut', 'shellfish', 'fish', 'egg', 'dairy', 'gluten', 'coconut']
    for (const a of all) {
      const out = suggest(RECIPES, prefs({ allergies: [a], breakMinutes: 60 }), EMPTY_HISTORY, AT_MERIENDA)
      for (const r of out) {
        expect(r.allergens, `${r.id} leaked ${a}`).not.toContain(a)
      }
    }
  })

  it('never deals a recipe that overruns the break', () => {
    const deck = [make({ id: 'quick', totalMinutes: 10 }), make({ id: 'long', totalMinutes: 45 })]
    expect(ids(suggest(deck, prefs({ breakMinutes: 15 }), EMPTY_HISTORY, AT_MERIENDA))).toEqual(['quick'])
  })

  it('treats the break length as inclusive', () => {
    const deck = [make({ id: 'exact', totalMinutes: 15 })]
    expect(ids(suggest(deck, prefs({ breakMinutes: 15 }), EMPTY_HISTORY, AT_MERIENDA))).toEqual(['exact'])
  })

  it('holds break length across the real recipe set', () => {
    for (const minutes of [15, 30, 60]) {
      for (const r of suggest(RECIPES, prefs({ breakMinutes: minutes }), EMPTY_HISTORY, AT_MERIENDA)) {
        expect(r.totalMinutes).toBeLessThanOrEqual(minutes)
      }
    }
  })

  it('requires every diet the user follows, not just one', () => {
    const deck = [
      make({ id: 'both', dietTags: ['vegetarian', 'pork-free'] }),
      make({ id: 'one', dietTags: ['vegetarian'] }),
    ]
    const diets: DietTag[] = ['vegetarian', 'pork-free']
    expect(ids(suggest(deck, prefs({ diets }), EMPTY_HISTORY, AT_MERIENDA))).toEqual(['both'])
  })
})

describe('ranking', () => {
  it('puts recipes matching the current daypart first', () => {
    const deck = [
      make({ id: 'evening-only', dayparts: ['evening'] }),
      make({ id: 'merienda-one', dayparts: ['merienda'] }),
    ]
    expect(ids(suggest(deck, prefs(), EMPTY_HISTORY, AT_MERIENDA))[0]).toBe('merienda-one')
  })

  it('treats 2am as graveyard, not as an afterthought', () => {
    const deck = [
      make({ id: 'merienda-one', dayparts: ['merienda'] }),
      make({ id: 'graveyard-one', dayparts: ['graveyard'] }),
    ]
    const at2am = { now: new Date(2026, 0, 15, 2, 0), seed: 7 }
    expect(ids(suggest(deck, prefs(), EMPTY_HISTORY, at2am))[0]).toBe('graveyard-one')
  })

  it('demotes a recently passed recipe without removing it', () => {
    const deck = [make({ id: 'passed' }), make({ id: 'unseen' })]
    const out = suggest(deck, prefs(), { takenToday: [], recentlyPassed: ['passed'] }, AT_MERIENDA)
    expect(ids(out)).toContain('passed')
    expect(ids(out)[ids(out).length - 1]).toBe('passed')
  })

  it('is stable for a given seed and varies across seeds', () => {
    const deck = ['a', 'b', 'c', 'd', 'e'].map((id) => make({ id }))
    const one = ids(suggest(deck, prefs(), EMPTY_HISTORY, { ...AT_MERIENDA, seed: 1 }))
    const same = ids(suggest(deck, prefs(), EMPTY_HISTORY, { ...AT_MERIENDA, seed: 1 }))
    const other = ids(suggest(deck, prefs(), EMPTY_HISTORY, { ...AT_MERIENDA, seed: 99 }))
    expect(one).toEqual(same)
    expect(one).not.toEqual(other)
  })
})

describe('history', () => {
  it('drops what was already taken today', () => {
    const deck = [make({ id: 'had-it' }), make({ id: 'fresh' })]
    const out = suggest(deck, prefs(), { takenToday: ['had-it'], recentlyPassed: [] }, AT_MERIENDA)
    expect(ids(out)).toEqual(['fresh'])
  })

  it('offers a repeat rather than an empty deck when everything was taken', () => {
    const deck = [make({ id: 'a' }), make({ id: 'b' })]
    const out = suggest(deck, prefs(), { takenToday: ['a', 'b'], recentlyPassed: [] }, AT_MERIENDA)
    expect(ids(out).sort()).toEqual(['a', 'b'])
  })

  it('degrades only the suppression, never the break length', () => {
    const deck = [make({ id: 'short', totalMinutes: 10 }), make({ id: 'long', totalMinutes: 45 })]
    const out = suggest(
      deck,
      prefs({ breakMinutes: 15 }),
      { takenToday: ['short'], recentlyPassed: [] },
      AT_MERIENDA,
    )
    expect(ids(out)).toEqual(['short'])
  })
})

describe('the real deck', () => {
  it('deals something for every break length with no restrictions', () => {
    for (const minutes of [15, 30, 60]) {
      expect(
        suggest(RECIPES, prefs({ breakMinutes: minutes }), EMPTY_HISTORY, AT_MERIENDA).length,
        `${minutes}-minute break came up empty`,
      ).toBeGreaterThan(0)
    }
  })

  it('deals something at every hour of the day', () => {
    const hours = [7, 12, 15, 20, 2]
    for (const h of hours) {
      const out = suggest(RECIPES, prefs({ breakMinutes: 30 }), EMPTY_HISTORY, {
        now: new Date(2026, 0, 15, h, 0),
        seed: 3,
      })
      expect(out.length, `${h}:00 came up empty`).toBeGreaterThan(0)
    }
  })
})

describe('daypart coverage', () => {
  it('gives every daypart at least one recipe in the real set', () => {
    const dayparts: Daypart[] = ['morning', 'midday', 'merienda', 'evening', 'graveyard']
    for (const d of dayparts) {
      const count = RECIPES.filter((r) => r.dayparts.includes(d)).length
      expect(count, `no recipe covers ${d}`).toBeGreaterThan(0)
    }
  })
})
