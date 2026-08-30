/**
 * Holds Chromium's `beforeinstallprompt` event so the gate can replay it.
 *
 * Two things make this awkward enough to need its own module. The event fires
 * once, early — routinely before React has mounted — and is gone if nobody kept
 * a reference. And `prompt()` only works inside a user gesture, so it cannot be
 * called when the event arrives; it has to be stored and fired from a click.
 *
 * The very earliest capture happens in an inline script in index.html, which
 * runs before this bundle is parsed; that event is handed over as `initial`.
 */

export interface InstallChoice {
  outcome: 'accepted' | 'dismissed'
  platform: string
}

/** Chromium-only, and absent from the DOM lib, so it is declared here. */
export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<InstallChoice>
}

export type InstallOutcome = InstallChoice['outcome'] | 'unavailable'

export interface InstallPromptStore {
  /** True when a one-tap install is ready to show. */
  isAvailable(): boolean
  /** True once the browser has confirmed an install happened. */
  wasInstalled(): boolean
  /** Returns an unsubscribe function. */
  subscribe(listener: () => void): () => void
  /** Must be called from a user gesture, or the browser ignores it. */
  prompt(): Promise<InstallOutcome>
}

declare global {
  interface Window {
    /** Set by the inline capture script in index.html. */
    __breaktimeInstallPrompt?: BeforeInstallPromptEvent | null
  }
}

export function createInstallPromptStore(options: {
  target?: EventTarget
  initial?: BeforeInstallPromptEvent | null
} = {}): InstallPromptStore {
  const { target, initial = null } = options

  let deferred: BeforeInstallPromptEvent | null = initial
  let installed = false
  const listeners = new Set<() => void>()

  const notify = () => {
    for (const listener of [...listeners]) listener()
  }

  if (target) {
    target.addEventListener('beforeinstallprompt', (event) => {
      // Without this Chrome shows its own mini-infobar, which competes with the
      // gate and gives the user a second, quieter thing to dismiss.
      event.preventDefault()
      deferred = event as BeforeInstallPromptEvent
      notify()
    })

    target.addEventListener('appinstalled', () => {
      installed = true
      deferred = null
      notify()
    })
  }

  return {
    isAvailable: () => deferred !== null,
    wasInstalled: () => installed,

    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },

    async prompt() {
      const event = deferred
      if (!event) return 'unavailable'

      // Spent whether or not it succeeds: Chromium ignores a second prompt() on
      // the same event, and holding a dead one would keep the button enabled.
      deferred = null
      notify()

      try {
        await event.prompt()
        const choice = await event.userChoice
        return choice.outcome
      } catch {
        return 'unavailable'
      }
    },
  }
}

/** The instance bound to the real browser, seeded from the inline capture. */
export const installPrompt: InstallPromptStore = createInstallPromptStore(
  typeof window === 'undefined'
    ? {}
    : { target: window, initial: window.__breaktimeInstallPrompt ?? null },
)
