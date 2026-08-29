import type { Daypart } from '../data/schema'

/**
 * Graveyard runs 22:00–05:00 and is deliberately the widest band: for a BPO
 * worker on US hours it is the entire shift, not the tail of a normal day.
 */
export function daypartFor(now: Date): Daypart {
  const h = now.getHours()
  if (h >= 5 && h < 11) return 'morning'
  if (h >= 11 && h < 14) return 'midday'
  if (h >= 14 && h < 18) return 'merienda'
  if (h >= 18 && h < 22) return 'evening'
  return 'graveyard'
}

export const DAYPART_LABEL: Record<Daypart, string> = {
  morning: 'Umaga',
  midday: 'Tanghali',
  merienda: 'Merienda',
  evening: 'Gabi',
  graveyard: 'Graveyard',
}

/** The signature: the lamp behind the deck is tinted by the hour of your break. */
export const DAYPART_LAMP: Record<Daypart, string> = {
  morning: '#8a5a2a',
  midday: '#8f6321',
  merienda: '#7d4620',
  evening: '#5b3520',
  graveyard: '#2f3550',
}
