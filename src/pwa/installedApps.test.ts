import { describe, expect, it, vi } from 'vitest'
import { detectInstalledApp, type RelatedApplication } from './installedApps'

function browser(getInstalledRelatedApps: unknown) {
  return { getInstalledRelatedApps } as Parameters<typeof detectInstalledApp>[0]
}

const OURS: RelatedApplication = {
  platform: 'webapp',
  url: 'https://breaktime.chefallan.xyz/manifest.webmanifest',
}

describe('detectInstalledApp', () => {
  it('reports true when the browser says our own web app is installed', async () => {
    await expect(detectInstalledApp(browser(() => Promise.resolve([OURS])))).resolves.toBe(true)
  })

  it('reports false when the browser knows of no installed app', async () => {
    await expect(detectInstalledApp(browser(() => Promise.resolve([])))).resolves.toBe(false)
  })

  it('ignores related apps on other platforms, which are not this PWA', async () => {
    const other = [{ platform: 'play', id: 'com.example.other' }]
    await expect(detectInstalledApp(browser(() => Promise.resolve(other)))).resolves.toBe(false)
  })

  /* Everything below is the same answer — false — because a browser that cannot
     tell us is indistinguishable from one reporting nothing, and the gate's
     default behaviour is the safe one either way. */

  it('reports false on an engine without the API at all', async () => {
    await expect(detectInstalledApp(browser(undefined))).resolves.toBe(false)
  })

  it('reports false when there is no navigator, as in a server render', async () => {
    await expect(detectInstalledApp(undefined)).resolves.toBe(false)
  })

  it('reports false when the call rejects', async () => {
    const rejects = () => Promise.reject(new Error('not allowed in this context'))
    await expect(detectInstalledApp(browser(rejects))).resolves.toBe(false)
  })

  it('reports false when the call throws instead of rejecting', async () => {
    const throws = () => {
      throw new TypeError('illegal invocation')
    }
    await expect(detectInstalledApp(browser(throws))).resolves.toBe(false)
  })

  it('reports false when the browser returns something that is not a list', async () => {
    await expect(detectInstalledApp(browser(() => Promise.resolve(null)))).resolves.toBe(false)
  })

  it('asks the browser exactly once per call', async () => {
    const ask = vi.fn(() => Promise.resolve([OURS]))
    await detectInstalledApp(browser(ask))
    expect(ask).toHaveBeenCalledOnce()
  })
})
