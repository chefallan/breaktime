import { describe, expect, it } from 'vitest'
import { RecipeValidationError, validateRecipe, validateRecipes } from './schema'
import { RECIPES } from './recipes'

/** A known-good recipe to mutate into each failure case. */
const base = () => ({
  id: 'test-dish',
  title: 'Test Dish',
  tagline: 'A dish for testing',
  kind: 'dish',
  totalMinutes: 15,
  effort: 'one-pot',
  serves: 1,
  dayparts: ['merienda'],
  dietTags: ['vegetarian'],
  allergens: ['dairy'],
  ingredients: [{ item: 'Milk', amount: '1 cup', allergens: ['dairy'] }],
  steps: ['Warm the milk.'],
})

describe('the seed set', () => {
  it('validates every entry', () => {
    expect(() => validateRecipes(RECIPES)).not.toThrow()
    expect(RECIPES.length).toBeGreaterThanOrEqual(8)
  })

  it('reports wall-clock times that fit a real break', () => {
    for (const r of RECIPES) {
      expect(r.totalMinutes, `${r.id} exceeds the longest break`).toBeLessThanOrEqual(60)
    }
  })

  it('gives every dish a drink to pair with', () => {
    for (const dish of RECIPES.filter((r) => r.kind === 'dish')) {
      expect(dish.pairsWith, `${dish.id} has no sip`).toBeTruthy()
    }
  })
})

describe('validateRecipe', () => {
  it('accepts a well-formed recipe', () => {
    expect(() => validateRecipe(base())).not.toThrow()
  })

  it.each([
    ['a missing id', { id: undefined }],
    ['an empty title', { title: '' }],
    ['an unknown kind', { kind: 'beverage' }],
    ['a zero totalMinutes', { totalMinutes: 0 }],
    ['a negative totalMinutes', { totalMinutes: -5 }],
    ['a fractional serves', { serves: 1.5 }],
    ['no dayparts', { dayparts: [] }],
    ['an unknown daypart', { dayparts: ['brunch'] }],
    ['an unknown allergen', { allergens: ['gluten-free'] }],
    ['no ingredients', { ingredients: [] }],
    ['no steps', { steps: [] }],
    ['an ingredient with no amount', { ingredients: [{ item: 'Milk' }] }],
  ])('rejects %s', (_label, patch) => {
    expect(() => validateRecipe({ ...base(), ...patch })).toThrow(RecipeValidationError)
  })

  // The safety seam. An ingredient allergen the recipe fails to declare would
  // pass straight through the deck filter and reach someone who cannot eat it.
  it('rejects an ingredient allergen the recipe does not declare', () => {
    const leaky = {
      ...base(),
      allergens: [],
      ingredients: [{ item: 'Peanut sauce', amount: '2 tbsp', allergens: ['peanut'] }],
    }
    expect(() => validateRecipe(leaky)).toThrow(/does not declare/)
  })

  it('holds that guard across the whole seed set', () => {
    for (const r of RECIPES) {
      const declared = new Set(r.allergens)
      for (const ing of r.ingredients) {
        for (const a of ing.allergens ?? []) {
          expect(declared.has(a), `${r.id} hides ${a} in "${ing.item}"`).toBe(true)
        }
      }
    }
  })
})

describe('validateRecipes', () => {
  it('rejects duplicate ids', () => {
    expect(() => validateRecipes([base(), base()])).toThrow(/duplicate/)
  })

  it('rejects a pairing that points at nothing', () => {
    expect(() => validateRecipes([{ ...base(), pairsWith: 'ghost-drink' }])).toThrow(/unknown recipe/)
  })

  it('rejects a pairing that points at another dish', () => {
    const dish = { ...base(), id: 'other-dish' }
    expect(() => validateRecipes([{ ...base(), pairsWith: 'other-dish' }, dish])).toThrow(/not a drink/)
  })
})
