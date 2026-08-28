import { validateRecipes, type Recipe } from './schema'
import { RAW_DRINKS } from './drinks'
import { RAW_MERIENDA } from './merienda'
import { RAW_MEALS } from './meals'

/**
 * Filipino merienda, sized to a break. Every totalMinutes is wall-clock from
 * standing up to sitting back down — prep, cook, and the pan you have to rinse.
 *
 * Drinks are declared first so the pairing cross-reference always resolves.
 */
const RAW: unknown[] = [...RAW_DRINKS, ...RAW_MERIENDA, ...RAW_MEALS]

export const RECIPES: Recipe[] = validateRecipes(RAW)

export const RECIPES_BY_ID = new Map(RECIPES.map((r) => [r.id, r]))
