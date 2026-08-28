/**
 * Allergens tagged for Filipino kitchens specifically. `shellfish` covers bagoong
 * and patis, which a generic allergen list would miss entirely.
 */
export const ALLERGENS = [
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
] as const
export type Allergen = (typeof ALLERGENS)[number]

/** What a recipe IS compatible with, not what it excludes. */
export const DIET_TAGS = ['vegetarian', 'vegan', 'pork-free'] as const
export type DietTag = (typeof DIET_TAGS)[number]

export const KINDS = ['dish', 'drink'] as const
export type Kind = (typeof KINDS)[number]

/**
 * `graveyard` is not an edge case — a large share of Filipino remote workers are
 * on US hours, so a 2am break is a normal break.
 */
export const DAYPARTS = ['morning', 'midday', 'merienda', 'evening', 'graveyard'] as const
export type Daypart = (typeof DAYPARTS)[number]

export const EFFORTS = ['no-cook', 'assemble', 'one-pot', 'stovetop'] as const
export type Effort = (typeof EFFORTS)[number]

export interface Ingredient {
  item: string
  amount: string
  allergens?: Allergen[]
}

export interface Recipe {
  id: string
  title: string
  tagline: string
  kind: Kind
  /** Wall-clock minutes including prep and cleanup — NOT "cook time". */
  totalMinutes: number
  effort: Effort
  serves: number
  dayparts: Daypart[]
  dietTags: DietTag[]
  /** Must be a superset of every allergen on every ingredient. */
  allergens: Allergen[]
  ingredients: Ingredient[]
  steps: string[]
  /** id of a drink to sip alongside. Dishes should have one; drinks need not. */
  pairsWith?: string
  note?: string
}

export class RecipeValidationError extends Error {}

const has = <T extends readonly string[]>(list: T, v: unknown): v is T[number] =>
  typeof v === 'string' && (list as readonly string[]).includes(v)

function fail(id: string, msg: string): never {
  throw new RecipeValidationError(`recipe "${id}": ${msg}`)
}

export function validateRecipe(input: unknown): Recipe {
  if (typeof input !== 'object' || input === null) {
    throw new RecipeValidationError('recipe must be an object')
  }
  const r = input as Record<string, unknown>
  const id = typeof r.id === 'string' && r.id.length > 0 ? r.id : null
  if (!id) throw new RecipeValidationError('recipe is missing a non-empty id')

  if (typeof r.title !== 'string' || !r.title) fail(id, 'title must be a non-empty string')
  if (typeof r.tagline !== 'string' || !r.tagline) fail(id, 'tagline must be a non-empty string')
  if (!has(KINDS, r.kind)) fail(id, `kind must be one of ${KINDS.join(', ')}`)
  if (!has(EFFORTS, r.effort)) fail(id, `effort must be one of ${EFFORTS.join(', ')}`)

  if (typeof r.totalMinutes !== 'number' || !Number.isFinite(r.totalMinutes) || r.totalMinutes <= 0) {
    fail(id, 'totalMinutes must be a positive number')
  }
  if (typeof r.serves !== 'number' || !Number.isInteger(r.serves) || r.serves <= 0) {
    fail(id, 'serves must be a positive integer')
  }

  if (!Array.isArray(r.dayparts) || r.dayparts.length === 0) fail(id, 'dayparts must be a non-empty array')
  for (const d of r.dayparts) if (!has(DAYPARTS, d)) fail(id, `unknown daypart "${String(d)}"`)

  if (!Array.isArray(r.dietTags)) fail(id, 'dietTags must be an array')
  for (const d of r.dietTags) if (!has(DIET_TAGS, d)) fail(id, `unknown diet tag "${String(d)}"`)

  if (!Array.isArray(r.allergens)) fail(id, 'allergens must be an array')
  for (const a of r.allergens) if (!has(ALLERGENS, a)) fail(id, `unknown allergen "${String(a)}"`)

  if (!Array.isArray(r.ingredients) || r.ingredients.length === 0) {
    fail(id, 'ingredients must be a non-empty array')
  }
  if (!Array.isArray(r.steps) || r.steps.length === 0) fail(id, 'steps must be a non-empty array')
  for (const s of r.steps) if (typeof s !== 'string' || !s) fail(id, 'every step must be a non-empty string')

  const declared = new Set(r.allergens as Allergen[])
  for (const raw of r.ingredients) {
    if (typeof raw !== 'object' || raw === null) fail(id, 'every ingredient must be an object')
    const ing = raw as Record<string, unknown>
    if (typeof ing.item !== 'string' || !ing.item) fail(id, 'every ingredient needs an item name')
    if (typeof ing.amount !== 'string' || !ing.amount) fail(id, `ingredient "${ing.item}" needs an amount`)
    if (ing.allergens === undefined) continue
    if (!Array.isArray(ing.allergens)) fail(id, `ingredient "${ing.item}" allergens must be an array`)
    for (const a of ing.allergens) {
      if (!has(ALLERGENS, a)) fail(id, `ingredient "${ing.item}" has unknown allergen "${String(a)}"`)
      // The safety seam: an untagged ingredient allergen would slip past the deck filter.
      if (!declared.has(a)) {
        fail(id, `ingredient "${ing.item}" contains "${a}" but the recipe does not declare it`)
      }
    }
  }

  if (r.pairsWith !== undefined && (typeof r.pairsWith !== 'string' || !r.pairsWith)) {
    fail(id, 'pairsWith must be a non-empty recipe id when present')
  }
  if (r.note !== undefined && typeof r.note !== 'string') fail(id, 'note must be a string when present')

  return input as Recipe
}

/** Validates the set and the cross-references between its members. */
export function validateRecipes(input: unknown[]): Recipe[] {
  const recipes = input.map(validateRecipe)
  const byId = new Map<string, Recipe>()
  for (const r of recipes) {
    if (byId.has(r.id)) throw new RecipeValidationError(`duplicate recipe id "${r.id}"`)
    byId.set(r.id, r)
  }
  for (const r of recipes) {
    if (!r.pairsWith) continue
    const drink = byId.get(r.pairsWith)
    if (!drink) fail(r.id, `pairsWith points at unknown recipe "${r.pairsWith}"`)
    if (drink.kind !== 'drink') fail(r.id, `pairsWith "${r.pairsWith}" is not a drink`)
  }
  return recipes
}
