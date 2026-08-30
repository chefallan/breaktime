/**
 * Asks the browser whether Breaktime is already installed on this device.
 *
 * Chromium never fires `beforeinstallprompt` for an app that is already
 * installed, so without this a returning visitor who taps an old link lands on
 * the gate and is told to install something they already have.
 *
 * `getInstalledRelatedApps` only answers for apps the manifest claims as related,
 * which is why the manifest lists its own URL under `related_applications` — see
 * vite.config.ts. Chromium-only, and it reports nothing on an origin whose
 * manifest URL does not match, localhost included.
 *
 * Every uncertain path resolves false. A browser that cannot tell us is
 * indistinguishable from one telling us "not installed", and false is the answer
 * that leaves the gate doing what it would have done anyway.
 */

export interface RelatedApplication {
  platform: string
  url?: string
  id?: string
}

export interface RelatedAppsBrowser {
  getInstalledRelatedApps?: () => Promise<unknown>
}

const OWN_PLATFORM = 'webapp'

export async function detectInstalledApp(
  browser: RelatedAppsBrowser | undefined = typeof navigator === 'undefined'
    ? undefined
    : (navigator as RelatedAppsBrowser),
): Promise<boolean> {
  const ask = browser?.getInstalledRelatedApps
  if (typeof ask !== 'function') return false

  try {
    const related = await ask.call(browser)
    return (
      Array.isArray(related) &&
      related.some((app: RelatedApplication) => app?.platform === OWN_PLATFORM)
    )
  } catch {
    return false
  }
}
