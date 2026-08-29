import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BreakPicker } from './BreakPicker'

const setup = (visits?: number | null) =>
  render(
    <BreakPicker daypart="merienda" onPick={vi.fn()} onEditPrefs={vi.fn()} visits={visits} />,
  )

describe('BreakPicker', () => {
  it('offers every break length', () => {
    setup()
    for (const minutes of [15, 30, 60]) {
      expect(screen.getByRole('button', { name: new RegExp(`^${minutes}`) })).toBeInTheDocument()
    }
  })

  // The counter is inert until an endpoint is configured. An unconfigured app must
  // show no trace of it — not a zero, not a dash, not an empty slot.
  it('says nothing about visits when the counter is unconfigured', () => {
    setup(undefined)
    expect(screen.queryByText(/visits/i)).not.toBeInTheDocument()
  })

  it('says nothing about visits when the request failed', () => {
    setup(null)
    expect(screen.queryByText(/visits/i)).not.toBeInTheDocument()
  })

  it('shows the total once there is one', () => {
    setup(3241)
    expect(screen.getByText('3,241 visits so far')).toBeInTheDocument()
  })

  it('shows a genuine zero rather than hiding it', () => {
    // Distinct from "no counter": zero is a real answer and should read as one.
    setup(0)
    expect(screen.getByText('0 visits so far')).toBeInTheDocument()
  })
})
