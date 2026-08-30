import { useCallback, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import { detectCurrentPlatform, type Platform } from '../pwa/platform'
import { detectInstalledApp } from '../pwa/installedApps'
import {
  installPrompt,
  type InstallOutcome,
  type InstallPromptStore,
} from '../pwa/installPrompt'

/** How we came to know it is installed — this run, or some earlier one. */
type Installed = 'just-now' | 'already' | null

/**
 * Refuses to render the app anywhere but a launched, installed window.
 *
 * No browser exposes a way to install a PWA on the user's behalf, so this is the
 * strongest form the requirement can take: the app is simply not there until it
 * has been added to the home screen. There is deliberately no way past this
 * screen — a "continue in browser" link is what everyone would tap, which is the
 * same as not having a gate.
 *
 * The cost is real and worth stating: a browser with no install path at all
 * (Firefox on the desktop, a webview inside another app) cannot reach the app.
 * Those get instructions and a copyable link instead of a dead end.
 */
export function InstallGate({
  children,
  platform = detectCurrentPlatform(),
  prompt = installPrompt,
  detectInstalled = detectInstalledApp,
  appUrl = typeof window === 'undefined' ? '' : `${window.location.origin}/`,
}: {
  children: ReactNode
  platform?: Platform
  prompt?: InstallPromptStore
  detectInstalled?: () => Promise<boolean>
  appUrl?: string
}) {
  const canPrompt = useSyncExternalStore(prompt.subscribe, prompt.isAvailable, () => false)
  const justInstalled = useSyncExternalStore(prompt.subscribe, prompt.wasInstalled, () => false)
  const [alreadyInstalled, setAlreadyInstalled] = useState(false)
  const [outcome, setOutcome] = useState<InstallOutcome | null>(null)

  useEffect(() => {
    let live = true
    // Only ever flips on. A false answer is also what an engine without the API
    // returns, so it carries no information and must not clear a known install.
    void detectInstalled().then((yes) => {
      if (live && yes) setAlreadyInstalled(true)
    })
    return () => {
      live = false
    }
  }, [detectInstalled])

  if (platform === 'standalone') return <>{children}</>

  return (
    <Gate
      platform={platform}
      appUrl={appUrl}
      canPrompt={canPrompt}
      installed={justInstalled ? 'just-now' : alreadyInstalled ? 'already' : null}
      outcome={outcome}
      onInstall={() => void prompt.prompt().then(setOutcome)}
    />
  )
}

function Gate({
  platform,
  appUrl,
  canPrompt,
  installed,
  outcome,
  onInstall,
}: {
  platform: Exclude<Platform, 'standalone'>
  appUrl: string
  canPrompt: boolean
  installed: Installed
  outcome: InstallOutcome | null
  onInstall: () => void
}) {
  const dock = platform === 'macos-safari'

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      <div className="lamp" />

      <div className="relative z-10 mx-auto flex h-full w-full max-w-md flex-col justify-center px-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <img
          src="/favicon.svg"
          alt=""
          width={72}
          height={72}
          className="mb-7 h-[72px] w-[72px] rounded-[22%]"
        />

        <div className="text-[0.62rem] font-semibold tracking-[0.22em] text-gata/35 uppercase">
          Breaktime
        </div>

        {installed ? (
          <>
            <h1 className="font-display mt-2 text-[2.4rem] leading-[1.02] font-extrabold tracking-tight text-balance text-gata">
              {installed === 'just-now' ? 'Installed.' : 'You already have this.'}
            </h1>
            <p className="mt-4 text-[0.95rem] leading-relaxed text-gata/65">
              {installed === 'just-now'
                ? 'Now open Breaktime from your home screen. This tab is done.'
                : 'Open Breaktime from your home screen. This tab will not run it.'}
            </p>
          </>
        ) : (
          <>
            <h1 className="font-display mt-2 text-[2.4rem] leading-[1.02] font-extrabold tracking-tight text-balance text-gata">
              {dock ? 'Breaktime lives in your Dock.' : 'Breaktime lives on your home screen.'}
            </h1>
            <p className="mt-4 text-[0.95rem] leading-relaxed text-gata/65">
              It is an app, not a website. One tap when the break starts, and it still works when
              the signal does not.
            </p>

            <div className="mt-8">
              <Action
                platform={platform}
                appUrl={appUrl}
                canPrompt={canPrompt}
                outcome={outcome}
                onInstall={onInstall}
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Action({
  platform,
  appUrl,
  canPrompt,
  outcome,
  onInstall,
}: {
  platform: Exclude<Platform, 'standalone'>
  appUrl: string
  canPrompt: boolean
  outcome: InstallOutcome | null
  onInstall: () => void
}) {
  switch (platform) {
    case 'chromium':
      // The event can arrive after first paint, and is spent by one prompt. A
      // button with nothing behind it is worse than the manual instructions.
      return canPrompt ? (
        <>
          <button
            type="button"
            onClick={onInstall}
            className="font-display w-full rounded-2xl bg-ube px-6 py-4 text-lg font-bold tracking-tight text-ground transition hover:bg-ube/90 active:scale-[0.99]"
          >
            Install Breaktime
          </button>
          <p className="mt-3 text-center text-xs text-gata/35">
            Takes a second. Nothing to sign up for.
          </p>
        </>
      ) : (
        <>
          {outcome === 'dismissed' && (
            <p className="mb-5 rounded-2xl border border-ube/25 bg-ube/8 px-4 py-3 text-sm text-gata/75">
              Breaktime opens once it is on your home screen, and not before.
            </p>
          )}
          <Steps
            steps={[
              'Open your browser’s ⋮ menu',
              'Choose Install app, or Add to Home screen',
              'Open Breaktime from there',
            ]}
          />
        </>
      )

    case 'ios':
      return (
        <Steps
          steps={[
            'Tap the Share button at the bottom of Safari',
            'Choose Add to Home Screen',
            'Open Breaktime from there',
          ]}
        />
      )

    case 'macos-safari':
      return (
        <Steps
          steps={['Open the File menu in Safari', 'Choose Add to Dock', 'Open Breaktime from the Dock']}
        />
      )

    case 'in-app':
      return (
        <>
          <p className="mb-5 text-sm text-gata/55">
            You are in another app’s built-in browser, which cannot install anything.
          </p>
          <Steps
            steps={[
              'Tap the ⋯ menu and choose Open in browser',
              'Add Breaktime to your home screen from there',
            ]}
          />
          <CopyLink appUrl={appUrl} />
        </>
      )

    case 'unsupported':
      return (
        <>
          <p className="text-sm leading-relaxed text-gata/55">
            This browser has no way to install an app. Open Breaktime in Chrome, Edge, or Safari,
            then add it to your home screen.
          </p>
          <CopyLink appUrl={appUrl} />
        </>
      )
  }
}

function Steps({ steps }: { steps: string[] }) {
  return (
    <ol className="flex flex-col gap-3">
      {steps.map((step, i) => (
        <li key={step} className="flex items-start gap-3.5">
          <span className="font-display mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ube/15 text-xs font-bold text-ube">
            {i + 1}
          </span>
          <span className="text-[0.95rem] leading-6 text-gata/80">{step}</span>
        </li>
      ))}
    </ol>
  )
}

function CopyLink({ appUrl }: { appUrl: string }) {
  const [copied, setCopied] = useState(false)

  const copy = useCallback(() => {
    void navigator.clipboard?.writeText(appUrl).then(
      () => setCopied(true),
      () => setCopied(false),
    )
  }, [appUrl])

  return (
    <div className="mt-7 flex items-center gap-3 rounded-2xl border border-gata/12 bg-gata/[0.03] p-2 pl-4">
      <span className="flex-1 truncate text-xs text-gata/45">{appUrl}</span>
      <button
        type="button"
        onClick={copy}
        className="shrink-0 rounded-xl bg-gata/10 px-3.5 py-2 text-xs font-semibold text-gata/80 transition hover:bg-gata/20"
      >
        {copied ? 'Copied' : 'Copy link'}
      </button>
    </div>
  )
}
