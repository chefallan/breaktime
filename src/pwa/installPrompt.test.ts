import { describe, expect, it, vi } from 'vitest'
import {
  createInstallPromptStore,
  type BeforeInstallPromptEvent,
  type InstallChoice,
} from './installPrompt'

/**
 * Chromium's event, near enough: a cancelable event carrying a one-shot
 * `prompt()` and a `userChoice` promise.
 */
function fakeEvent(outcome: InstallChoice['outcome'] = 'accepted'): BeforeInstallPromptEvent {
  const event = new Event('beforeinstallprompt', {
    cancelable: true,
  }) as BeforeInstallPromptEvent
  event.prompt = vi.fn(() => Promise.resolve())
  event.userChoice = Promise.resolve({ outcome, platform: 'web' })
  return event
}

describe('install prompt store', () => {
  it('starts unavailable when the browser has offered nothing', () => {
    const store = createInstallPromptStore({ target: new EventTarget() })
    expect(store.isAvailable()).toBe(false)
  })

  it('becomes available when the browser fires beforeinstallprompt', () => {
    const target = new EventTarget()
    const store = createInstallPromptStore({ target })

    target.dispatchEvent(fakeEvent())

    expect(store.isAvailable()).toBe(true)
  })

  it("suppresses Chrome's own mini-infobar so the gate is the only prompt", () => {
    const target = new EventTarget()
    createInstallPromptStore({ target })
    const event = fakeEvent()

    target.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
  })

  it('notifies subscribers when the event arrives', () => {
    const target = new EventTarget()
    const store = createInstallPromptStore({ target })
    const seen: boolean[] = []
    store.subscribe(() => seen.push(store.isAvailable()))

    target.dispatchEvent(fakeEvent())

    expect(seen).toEqual([true])
  })

  it('stops notifying after unsubscribe', () => {
    const target = new EventTarget()
    const store = createInstallPromptStore({ target })
    const listener = vi.fn()
    store.subscribe(listener)()

    target.dispatchEvent(fakeEvent())

    expect(listener).not.toHaveBeenCalled()
  })

  /**
   * The real failure mode this module exists for: the event fires while the
   * bundle is still parsing, long before React mounts, and is never seen again.
   */
  it('reports an event that fired before anyone subscribed', () => {
    const target = new EventTarget()
    const store = createInstallPromptStore({ target })
    target.dispatchEvent(fakeEvent())

    const listener = vi.fn()
    store.subscribe(listener)

    expect(store.isAvailable()).toBe(true)
  })

  it('accepts an event captured by the inline script before the module loaded', () => {
    const store = createInstallPromptStore({ target: new EventTarget(), initial: fakeEvent() })
    expect(store.isAvailable()).toBe(true)
  })

  it('shows the browser prompt and reports that the user accepted', async () => {
    const target = new EventTarget()
    const store = createInstallPromptStore({ target })
    const event = fakeEvent('accepted')
    target.dispatchEvent(event)

    await expect(store.prompt()).resolves.toBe('accepted')
    expect(event.prompt).toHaveBeenCalledOnce()
  })

  it('reports a dismissal without treating it as an error', async () => {
    const target = new EventTarget()
    const store = createInstallPromptStore({ target })
    target.dispatchEvent(fakeEvent('dismissed'))

    await expect(store.prompt()).resolves.toBe('dismissed')
  })

  it('reports unavailable rather than throwing when there is no event to show', async () => {
    const store = createInstallPromptStore({ target: new EventTarget() })
    await expect(store.prompt()).resolves.toBe('unavailable')
  })

  it('spends the event once — the browser will not honour a second prompt', async () => {
    const target = new EventTarget()
    const store = createInstallPromptStore({ target })
    target.dispatchEvent(fakeEvent('dismissed'))

    await store.prompt()

    expect(store.isAvailable()).toBe(false)
    await expect(store.prompt()).resolves.toBe('unavailable')
  })

  it('reports unavailable when the browser rejects the prompt call', async () => {
    const target = new EventTarget()
    const store = createInstallPromptStore({ target })
    const event = fakeEvent()
    event.prompt = vi.fn(() => Promise.reject(new Error('not allowed')))
    target.dispatchEvent(event)

    await expect(store.prompt()).resolves.toBe('unavailable')
  })

  it('goes unavailable once the app has actually been installed', () => {
    const target = new EventTarget()
    const store = createInstallPromptStore({ target })
    target.dispatchEvent(fakeEvent())

    target.dispatchEvent(new Event('appinstalled'))

    expect(store.isAvailable()).toBe(false)
  })

  it('tells subscribers when the app has been installed', () => {
    const target = new EventTarget()
    const store = createInstallPromptStore({ target })
    const listener = vi.fn()
    store.subscribe(listener)

    target.dispatchEvent(new Event('appinstalled'))

    expect(listener).toHaveBeenCalled()
    expect(store.wasInstalled()).toBe(true)
  })
})
