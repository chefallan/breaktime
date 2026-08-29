import { Component, type ErrorInfo, type ReactNode } from 'react'
import { clearAll } from '../state/prefs'

interface Props {
  children: ReactNode
  /** Test seam. Production reporting would go here. */
  onError?: (error: Error, info: ErrorInfo) => void
}

interface State {
  error: Error | null
}

/**
 * Without this, a throw anywhere in the tree unmounts everything and leaves a
 * white screen with no way back — on an app someone opened for a ten-minute
 * break, that is the end of the break.
 *
 * Two escapes on purpose. Retrying fixes a transient render error. It cannot fix
 * a crash caused by unreadable stored preferences, because the bad value is
 * still there on the next render — so there is a second button that clears
 * storage and starts over.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.onError?.(error, info)
  }

  private retry = () => this.setState({ error: null })

  private startOver = () => {
    clearAll()
    this.setState({ error: null })
    location.reload()
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="flex h-full flex-col items-center justify-center px-8 text-center">
        <h1 className="font-display text-[2.2rem] leading-tight font-extrabold tracking-tight text-balance text-gata">
          Something broke.
        </h1>
        <p className="mt-3 max-w-xs text-sm leading-relaxed text-gata/60">
          Not your fault, and nothing you saved is lost. Try again, and if it keeps
          happening, start over to clear what this app has stored.
        </p>

        <div className="mt-8 flex w-full max-w-xs flex-col gap-3">
          <button
            type="button"
            onClick={this.retry}
            className="font-display w-full rounded-2xl bg-ube py-4 text-base font-extrabold tracking-tight text-ground transition hover:bg-ube/90 active:scale-[0.99]"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={this.startOver}
            className="w-full rounded-2xl border border-gata/15 py-3 text-sm text-gata/60 transition hover:border-gata/35 hover:text-gata"
          >
            Start over
          </button>
        </div>
      </div>
    )
  }
}
