/**
 * Which install path, if any, this browser has.
 *
 * There is no API that installs a PWA on the user's behalf, and no API that
 * reports whether one is possible. `beforeinstallprompt` is Chromium-only, and
 * on every other engine the only honest answer is a set of instructions. So this
 * sniffs the user agent — normally the wrong tool, but here the browser's own
 * identity is precisely the fact we need, and there is nothing to feature-detect.
 *
 * Every signal is passed in rather than read from globals, so the branches are
 * testable without a browser and without stubbing `navigator`.
 */

export type Platform =
  /** Launched from the home screen or dock. The app renders. */
  | 'standalone'
  /** Chromium: `beforeinstallprompt` gives us a real one-tap install. */
  | 'chromium'
  /** iOS or iPadOS: Share ▸ Add to Home Screen, by hand. */
  | 'ios'
  /** Safari 17+ on macOS: File ▸ Add to Dock, by hand. */
  | 'macos-safari'
  /** A webview inside another app. Cannot install; has to be escaped first. */
  | 'in-app'
  /** Firefox and friends. No install path at all. */
  | 'unsupported'

export interface PlatformSignals {
  userAgent: string
  /** iPadOS 13+ reports a Macintosh user agent; this is what separates them. */
  maxTouchPoints?: number
  /** iOS Safari's legacy standalone flag, predating the display-mode query. */
  navigatorStandalone?: boolean
  matchMedia?: (query: string) => { matches: boolean }
  /** An Android TWA launch arrives with an `android-app://` referrer. */
  referrer?: string
}

/** Ordered by how much they claim: the first match wins, so specific goes first. */
const IN_APP =
  /FBAN|FBAV|FB_IAB|FB4A|Instagram|MicroMessenger|Line\/|TikTok|Snapchat|WhatsApp|LinkedInApp|Pinterest|; wv\)/i
const IOS_DEVICE = /iPhone|iPad|iPod/i
const IOS_NO_INSTALL = /FxiOS/i
const CHROMIUM = /Chrome\/|Chromium\/|CriOS\/|Edg[A-Z]?\/|SamsungBrowser\//
const SAFARI = /Safari\//

const DISPLAY_MODES = ['standalone', 'fullscreen', 'minimal-ui'] as const

/**
 * A browser that does not understand a display-mode query throws on it rather
 * than returning false. Treating that as "not installed" is the safe read: the
 * worst case is showing the gate to someone who already installed, which they
 * can act on, rather than opening the app to someone who has not.
 */
function inDisplayMode(matchMedia: PlatformSignals['matchMedia']): boolean {
  if (!matchMedia) return false
  return DISPLAY_MODES.some((mode) => {
    try {
      return matchMedia(`(display-mode: ${mode})`).matches
    } catch {
      return false
    }
  })
}

export function detectPlatform(signals: PlatformSignals): Platform {
  const { userAgent, maxTouchPoints = 0, navigatorStandalone, matchMedia, referrer } = signals

  if (
    inDisplayMode(matchMedia) ||
    navigatorStandalone === true ||
    referrer?.startsWith('android-app://')
  ) {
    return 'standalone'
  }

  // Before the Chromium check: an in-app webview carries the host browser's
  // engine in its user agent, so Facebook on Android looks like Chrome.
  if (IN_APP.test(userAgent)) return 'in-app'

  const isIOS = IOS_DEVICE.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1)
  if (isIOS) return IOS_NO_INSTALL.test(userAgent) ? 'unsupported' : 'ios'

  if (CHROMIUM.test(userAgent)) return 'chromium'
  if (/Macintosh/.test(userAgent) && SAFARI.test(userAgent)) return 'macos-safari'

  return 'unsupported'
}

/** Reads the real browser. Separated from {@link detectPlatform} so that stays pure. */
export function detectCurrentPlatform(): Platform {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return 'unsupported'
  return detectPlatform({
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints,
    navigatorStandalone: (navigator as Navigator & { standalone?: boolean }).standalone,
    matchMedia: typeof window.matchMedia === 'function' ? (q) => window.matchMedia(q) : undefined,
    referrer: typeof document !== 'undefined' ? document.referrer : undefined,
  })
}
