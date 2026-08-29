import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { SwipeDeck } from './SwipeDeck'
import type { Recipe } from '../data/schema'

const recipe = (id: string, title: string, totalMinutes = 15): Recipe => ({
  id,
  title,
  tagline: `${title} tagline`,
  kind: 'dish',
  totalMinutes,
  effort: 'one-pot',
  serves: 1,
  dayparts: ['merienda'],
  dietTags: ['vegetarian'],
  allergens: [],
  ingredients: [{ item: 'Something', amount: '1 cup' }],
  steps: ['Do the thing.'],
})

const DECK = [recipe('a', 'Champorado'), recipe('b', 'Turon'), recipe('c', 'Arroz Caldo')]

function setup(recipes = DECK) {
  const onDecide = vi.fn()
  const onEmpty = vi.fn()
  render(
    <SwipeDeck recipes={recipes} pairingFor={() => undefined} onDecide={onDecide} onEmpty={onEmpty} />,
  )
  return { onDecide, onEmpty }
}

/** Cards behind the top one and the departing card are aria-hidden, so the
 *  accessible article is always the card the user is actually deciding on. */
const topCard = () => screen.getByRole('article').getAttribute('aria-label')

describe('SwipeDeck', () => {
  it('shows the first recipe on top', () => {
    setup()
    expect(topCard()).toBe('Champorado, 15 minutes')
  })

  it('names both controls for the card in play', () => {
    setup()
    expect(screen.getByRole('button', { name: 'Pass on Champorado' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Take Champorado' })).toBeInTheDocument()
  })

  // The regression. The deck used to advance inside the exit animation's onRest
  // callback, so anywhere animation frames do not run — a backgrounded tab, a
  // dropped frame, reduced motion — the user was stranded on one card forever.
  // jsdom runs no animation frames at all, so this test fails on that design.
  it('advances without waiting for any animation to complete', () => {
    const { onDecide } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Take Champorado' }))
    expect(topCard()).toBe('Turon, 15 minutes')
    expect(onDecide).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }), 'take')
  })

  it('reports a pass and still advances', () => {
    const { onDecide } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Pass on Champorado' }))
    expect(onDecide).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }), 'pass')
    expect(topCard()).toBe('Turon, 15 minutes')
  })

  it('walks the whole deck one decision at a time', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: 'Take Champorado' }))
    fireEvent.click(screen.getByRole('button', { name: 'Pass on Turon' }))
    expect(topCard()).toBe('Arroz Caldo, 15 minutes')
  })

  it('reports the deck as empty once the last card is decided', () => {
    const { onEmpty } = setup([recipe('only', 'Turon')])
    expect(onEmpty).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Take Turon' }))
    expect(onEmpty).toHaveBeenCalled()
  })
})
