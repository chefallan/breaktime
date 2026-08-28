import { beforeEach, describe, expect, it } from 'vitest'
import { clearAll, dayKey, loadHistory, loadPrefs, recordDecision, savePrefs } from './prefs'

const TODAY = new Date(2026, 0, 15, 15, 0)
const TOMORROW = new Date(2026, 0, 16, 15, 0)

beforeEach(() => {
  localStorage.clear()
})

describe('prefs', () => {
  it('reports no prefs before onboarding', () => {
    expect(loadPrefs()).toBeNull()
  })

  it('round-trips what was saved', () => {
    savePrefs({ allergies: ['peanut', 'shellfish'], diets: ['vegetarian'] })
    expect(loadPrefs()).toEqual({
      allergies: ['peanut', 'shellfish'],
      diets: ['vegetarian'],
      onboarded: true,
    })
  })

  it('survives a page reload', () => {
    savePrefs({ allergies: ['dairy'], diets: [] })
    expect(loadPrefs()?.allergies).toEqual(['dairy'])
  })

  // Returning null sends the user back through a 20-second onboarding. Returning a
  // partially-parsed object would silently drop an allergy, which is the bad failure.
  it('treats unparseable prefs as not onboarded', () => {
    localStorage.setItem('breaktime.prefs.v1', '{ not json')
    expect(loadPrefs()).toBeNull()
  })

  it('treats prefs missing the onboarded flag as not onboarded', () => {
    localStorage.setItem('breaktime.prefs.v1', JSON.stringify({ allergies: ['peanut'] }))
    expect(loadPrefs()).toBeNull()
  })

  it('drops values it does not recognise rather than trusting them', () => {
    localStorage.setItem(
      'breaktime.prefs.v1',
      JSON.stringify({ onboarded: true, allergies: ['peanut', 'moon-dust'], diets: 'vegetarian' }),
    )
    expect(loadPrefs()).toEqual({ allergies: ['peanut'], diets: [], onboarded: true })
  })

  it('clears everything on request', () => {
    savePrefs({ allergies: ['egg'], diets: [] })
    clearAll()
    expect(loadPrefs()).toBeNull()
  })
})

describe('history', () => {
  it('starts empty', () => {
    expect(loadHistory(TODAY)).toEqual({ takenToday: [], recentlyPassed: [] })
  })

  it('remembers what was taken today', () => {
    recordDecision('champorado', 'take', TODAY)
    expect(loadHistory(TODAY).takenToday).toEqual(['champorado'])
  })

  it('remembers what was passed, most recent first', () => {
    recordDecision('turon', 'pass', TODAY)
    recordDecision('salabat', 'pass', TODAY)
    expect(loadHistory(TODAY).recentlyPassed).toEqual(['salabat', 'turon'])
  })

  it('does not record the same take twice', () => {
    recordDecision('champorado', 'take', TODAY)
    recordDecision('champorado', 'take', TODAY)
    expect(loadHistory(TODAY).takenToday).toEqual(['champorado'])
  })

  it('clears the fridge at local midnight but keeps what you keep skipping', () => {
    recordDecision('champorado', 'take', TODAY)
    recordDecision('turon', 'pass', TODAY)
    const tomorrow = loadHistory(TOMORROW)
    expect(tomorrow.takenToday).toEqual([])
    expect(tomorrow.recentlyPassed).toEqual(['turon'])
  })

  it('promotes a recipe out of passed once it is finally taken', () => {
    recordDecision('turon', 'pass', TODAY)
    recordDecision('turon', 'take', TODAY)
    const h = loadHistory(TODAY)
    expect(h.recentlyPassed).not.toContain('turon')
    expect(h.takenToday).toContain('turon')
  })

  it('caps how far back passes are remembered', () => {
    for (let i = 0; i < 30; i++) recordDecision(`r${i}`, 'pass', TODAY)
    expect(loadHistory(TODAY).recentlyPassed).toHaveLength(20)
  })

  it('recovers from corrupt history instead of throwing', () => {
    localStorage.setItem('breaktime.history.v1', '{{{')
    expect(loadHistory(TODAY)).toEqual({ takenToday: [], recentlyPassed: [] })
  })
})

describe('dayKey', () => {
  it('uses the local calendar day', () => {
    expect(dayKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
    expect(dayKey(new Date(2026, 0, 6, 0, 1))).toBe('2026-01-06')
  })
})
