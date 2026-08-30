import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { InstallGate } from './InstallGate'
import { createInstallPromptStore, type BeforeInstallPromptEvent } from '../pwa/installPrompt'
import type { Platform } from '../pwa/platform'

const DECK = 'the deck'

/** Every platform that is not already installed. The gate must hold all of them. */
const BLOCKED: Platform[] = ['chromium', 'ios', 'macos-safari', 'in-app', 'unsupported']

function fakeEvent(outcome: 'accepted' | 'dismissed' = 'accepted'): BeforeInstallPromptEvent {
  const event = new Event('beforeinstallprompt', {
    cancelable: true,
  }) as BeforeInstallPromptEvent
  event.prompt = vi.fn(() => Promise.resolve())
  event.userChoice = Promise.resolve({ outcome, platform: 'web' })
  return event
}

function setup(
  platform: Platform,
  options: { withPrompt?: boolean; installedAlready?: boolean } = {},
) {
  const target = new EventTarget()
  const prompt = createInstallPromptStore({ target })
  if (options.withPrompt) act(() => void target.dispatchEvent(fakeEvent()))
  const detectInstalled = () => Promise.resolve(options.installedAlready ?? false)

  render(
    <InstallGate
      platform={platform}
      prompt={prompt}
      detectInstalled={detectInstalled}
      appUrl="https://breaktime.chefallan.xyz/"
    >
      <p>{DECK}</p>
    </InstallGate>,
  )
  return { target, prompt }
}

beforeEach(() => {
  vi.stubGlobal('navigator', Object.create(navigator, {
    clipboard: { value: { writeText: vi.fn(() => Promise.resolve()) }, configurable: true },
  }))
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('InstallGate', () => {
  it('renders the app when it was launched from the home screen', () => {
    setup('standalone')
    expect(screen.getByText(DECK)).toBeInTheDocument()
  })

  // The negative case, and the whole point of the component.
  it.each(BLOCKED)('refuses to render the app in a %s browser tab', (platform) => {
    setup(platform)
    expect(screen.queryByText(DECK)).not.toBeInTheDocument()
    // Wording follows the platform: a Mac gets a Dock, everything else a home screen.
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/home screen|dock/i)
  })

  it.each(BLOCKED)('offers no way past the gate on %s', (platform) => {
    setup(platform)
    for (const control of [...screen.queryAllByRole('button'), ...screen.queryAllByRole('link')]) {
      expect(control).not.toHaveAccessibleName(/continue|skip|browser anyway|not now|later|dismiss/i)
    }
  })

  describe('on Chromium, where a real install prompt exists', () => {
    it('shows an install button once the browser has offered the prompt', async () => {
      const { prompt } = setup('chromium', { withPrompt: true })
      const button = screen.getByRole('button', { name: /install breaktime/i })

      fireEvent.click(button)

      await waitFor(() => expect(prompt.isAvailable()).toBe(false))
    })

    it('waits for a prompt that has not arrived yet rather than showing a dead button', () => {
      setup('chromium')
      expect(screen.queryByRole('button', { name: /install breaktime/i })).not.toBeInTheDocument()
      expect(screen.getByText(/install/i)).toBeInTheDocument()
    })

    it('shows the button when the prompt arrives after the first render', async () => {
      const { target } = setup('chromium')

      act(() => void target.dispatchEvent(fakeEvent()))

      expect(
        await screen.findByRole('button', { name: /install breaktime/i }),
      ).toBeInTheDocument()
    })

    it('says so when the user dismisses the browser dialog, and offers another go', async () => {
      const target = new EventTarget()
      const prompt = createInstallPromptStore({ target })
      act(() => void target.dispatchEvent(fakeEvent('dismissed')))
      render(
        <InstallGate platform="chromium" prompt={prompt} appUrl="https://breaktime.chefallan.xyz/">
          <p>{DECK}</p>
        </InstallGate>,
      )

      fireEvent.click(screen.getByRole('button', { name: /install breaktime/i }))

      expect(await screen.findByText(/menu/i)).toBeInTheDocument()
      expect(screen.queryByText(DECK)).not.toBeInTheDocument()
    })
  })

  describe('on platforms that install by hand', () => {
    it('gives iOS the share-sheet steps and no install button', () => {
      setup('ios')
      expect(screen.getByText(/add to home screen/i)).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /install breaktime/i })).not.toBeInTheDocument()
    })

    it('gives macOS Safari the Add to Dock steps', () => {
      setup('macos-safari')
      expect(screen.getByText(/add to dock/i)).toBeInTheDocument()
    })
  })

  describe('on platforms that cannot install at all', () => {
    it('tells an in-app browser to open the link in a real browser', () => {
      setup('in-app')
      expect(screen.getByText(/open in browser/i)).toBeInTheDocument()
    })

    it('names browsers that work when this one cannot install', () => {
      setup('unsupported')
      expect(screen.getByText(/chrome/i)).toBeInTheDocument()
    })

    it.each(['in-app', 'unsupported'] as const)('copies the address on %s', async (platform) => {
      setup(platform)

      fireEvent.click(screen.getByRole('button', { name: /copy link/i }))

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://breaktime.chefallan.xyz/')
      expect(await screen.findByText(/copied/i)).toBeInTheDocument()
    })
  })

  it('asks the user to reopen from the home screen once the install lands', async () => {
    const { target } = setup('chromium', { withPrompt: true })

    act(() => void target.dispatchEvent(new Event('appinstalled')))

    expect(await screen.findByText(/home screen/i)).toBeInTheDocument()
    expect(screen.queryByText(DECK)).not.toBeInTheDocument()
  })

  /**
   * Chromium never fires beforeinstallprompt for an app it has already installed,
   * so without this a returning visitor is told to install what they already have.
   */
  describe('when the browser reports the app is already installed', () => {
    it('tells the visitor to open it rather than install it again', async () => {
      setup('chromium', { withPrompt: true, installedAlready: true })

      expect(await screen.findByText(/this tab will not run it/i)).toBeInTheDocument()
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/already/i)
      expect(screen.queryByRole('button', { name: /install breaktime/i })).not.toBeInTheDocument()
    })

    // Knowing it is installed is not the same as being launched from the home
    // screen, and must not be mistaken for permission to render the app.
    it('still refuses to render the app', async () => {
      setup('chromium', { withPrompt: true, installedAlready: true })

      await screen.findByText(/this tab will not run it/i)
      expect(screen.queryByText(DECK)).not.toBeInTheDocument()
    })

    it('keeps that wording distinct from an install completed just now', () => {
      const { target } = setup('chromium', { withPrompt: true })

      act(() => void target.dispatchEvent(new Event('appinstalled')))

      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Installed.')
    })

    it('leaves the install screen alone when it reports nothing', async () => {
      setup('chromium', { withPrompt: true, installedAlready: false })

      await waitFor(() =>
        expect(screen.getByRole('button', { name: /install breaktime/i })).toBeInTheDocument(),
      )
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/home screen/i)
    })
  })
})
