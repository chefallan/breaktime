import { describe, expect, it } from 'vitest'
import { detectPlatform, type PlatformSignals } from './platform'

/** Real user agents, kept verbatim — a paraphrased UA proves nothing. */
const UA = {
  iosSafari:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  iosFirefox:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/127.0 Mobile/15E148 Safari/605.1.15',
  // iPadOS 13+ claims to be a Mac. Only maxTouchPoints tells them apart.
  ipadOS:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  macSafari:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  chromeDesktop:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  chromeAndroid:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  edge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0',
  firefoxDesktop:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0',
  // Note the embedded "Chrome/" — the in-app check has to run before the Chromium one.
  facebookAndroid:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/460.0.0.31.108;]',
  instagramIOS:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 302.0.0.23.113',
}

function matchNone() {
  return { matches: false }
}

function matching(...queries: string[]) {
  return (query: string) => ({ matches: queries.includes(query) })
}

function signals(overrides: Partial<PlatformSignals> & { userAgent: string }): PlatformSignals {
  return { matchMedia: matchNone, maxTouchPoints: 0, ...overrides }
}

describe('detectPlatform', () => {
  describe('already installed', () => {
    it('reports standalone when the display mode is standalone', () => {
      expect(
        detectPlatform(
          signals({
            userAgent: UA.chromeAndroid,
            matchMedia: matching('(display-mode: standalone)'),
          }),
        ),
      ).toBe('standalone')
    })

    it('reports standalone in fullscreen and minimal-ui display modes too', () => {
      for (const mode of ['fullscreen', 'minimal-ui']) {
        expect(
          detectPlatform(
            signals({
              userAgent: UA.chromeAndroid,
              matchMedia: matching(`(display-mode: ${mode})`),
            }),
          ),
        ).toBe('standalone')
      }
    })

    it("reports standalone from iOS Safari's legacy navigator.standalone flag", () => {
      expect(
        detectPlatform(signals({ userAgent: UA.iosSafari, navigatorStandalone: true })),
      ).toBe('standalone')
    })

    it('reports standalone for an Android TWA launch', () => {
      expect(
        detectPlatform(
          signals({ userAgent: UA.chromeAndroid, referrer: 'android-app://org.chromium.webapk' }),
        ),
      ).toBe('standalone')
    })

    it('does not report standalone for a plain browser tab', () => {
      expect(detectPlatform(signals({ userAgent: UA.chromeAndroid }))).not.toBe('standalone')
    })
  })

  describe('installable platforms', () => {
    it('reports chromium for Chrome on Android', () => {
      expect(detectPlatform(signals({ userAgent: UA.chromeAndroid }))).toBe('chromium')
    })

    it('reports chromium for Chrome on the desktop', () => {
      expect(detectPlatform(signals({ userAgent: UA.chromeDesktop }))).toBe('chromium')
    })

    it('reports chromium for Edge', () => {
      expect(detectPlatform(signals({ userAgent: UA.edge }))).toBe('chromium')
    })

    it('reports ios for Safari on iPhone', () => {
      expect(detectPlatform(signals({ userAgent: UA.iosSafari }))).toBe('ios')
    })

    it('reports ios for an iPad claiming to be a Mac', () => {
      expect(detectPlatform(signals({ userAgent: UA.ipadOS, maxTouchPoints: 5 }))).toBe('ios')
    })

    it('reports macos-safari for Safari on a real Mac', () => {
      expect(detectPlatform(signals({ userAgent: UA.macSafari, maxTouchPoints: 0 }))).toBe(
        'macos-safari',
      )
    })
  })

  describe('platforms with no install path', () => {
    it('reports in-app for the Facebook webview, despite its Chrome user agent', () => {
      expect(detectPlatform(signals({ userAgent: UA.facebookAndroid }))).toBe('in-app')
    })

    it('reports in-app for the Instagram webview on iOS, ahead of the iOS check', () => {
      expect(detectPlatform(signals({ userAgent: UA.instagramIOS }))).toBe('in-app')
    })

    it('reports unsupported for Firefox on the desktop', () => {
      expect(detectPlatform(signals({ userAgent: UA.firefoxDesktop }))).toBe('unsupported')
    })

    it('reports unsupported for Firefox on iOS, which has no Add to Home Screen', () => {
      expect(detectPlatform(signals({ userAgent: UA.iosFirefox }))).toBe('unsupported')
    })

    it('reports unsupported for a user agent it has never seen', () => {
      expect(detectPlatform(signals({ userAgent: 'Breaktime/1.0 (unknown)' }))).toBe('unsupported')
    })
  })

  it('survives a matchMedia that throws, rather than blanking the app', () => {
    expect(
      detectPlatform(
        signals({
          userAgent: UA.chromeDesktop,
          matchMedia: () => {
            throw new Error('unsupported query')
          },
        }),
      ),
    ).toBe('chromium')
  })
})
