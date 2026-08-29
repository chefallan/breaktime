import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ErrorBoundary } from './ErrorBoundary'

function Boom({ throws }: { throws: boolean }): React.ReactElement {
  if (throws) throw new Error('kaboom')
  return <p>the deck</p>
}

/** React logs caught errors to console.error; that noise is expected here. */
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  localStorage.clear()
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe('ErrorBoundary', () => {
  it('renders children when nothing throws', () => {
    render(
      <ErrorBoundary>
        <Boom throws={false} />
      </ErrorBoundary>,
    )
    expect(screen.getByText('the deck')).toBeInTheDocument()
  })

  it('shows a way out instead of a white screen when a child throws', () => {
    render(
      <ErrorBoundary>
        <Boom throws />
      </ErrorBoundary>,
    )
    expect(screen.getByText('Something broke.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start over' })).toBeInTheDocument()
  })

  it('reports the error so it can be logged', () => {
    const onError = vi.fn()
    render(
      <ErrorBoundary onError={onError}>
        <Boom throws />
      </ErrorBoundary>,
    )
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'kaboom' }), expect.anything())
  })

  it('recovers when the cause was transient', () => {
    // The child is remounted on retry, so this exercises the boundary resetting,
    // not the child healing itself.
    const { rerender } = render(
      <ErrorBoundary>
        <Boom throws />
      </ErrorBoundary>,
    )
    expect(screen.getByText('Something broke.')).toBeInTheDocument()

    rerender(
      <ErrorBoundary>
        <Boom throws={false} />
      </ErrorBoundary>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(screen.getByText('the deck')).toBeInTheDocument()
  })

  // Retrying cannot fix a crash caused by unreadable stored preferences — the
  // bad value is still there on the next render. This is the real escape hatch.
  it('clears stored data when starting over', () => {
    const reload = vi.fn()
    Object.defineProperty(window, 'location', {
      value: { ...window.location, reload },
      writable: true,
    })
    localStorage.setItem('breaktime.prefs.v1', 'corrupt')

    render(
      <ErrorBoundary>
        <Boom throws />
      </ErrorBoundary>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Start over' }))

    expect(localStorage.getItem('breaktime.prefs.v1')).toBeNull()
    expect(reload).toHaveBeenCalled()
  })
})
