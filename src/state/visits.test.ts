import { beforeEach, describe, expect, it, vi } from 'vitest'
import { recordVisit } from './visits'

const ok = (count: unknown) =>
  vi.fn().mockResolvedValue({ ok: true, json: async () => ({ count }) }) as unknown as typeof fetch

const session = () => {
  const store = new Map<string, string>()
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  }
}

beforeEach(() => {
  sessionStorage.clear()
})

describe('recordVisit', () => {
  // The default posture: an unconfigured counter must make no request at all,
  // not a request to a placeholder.
  it('sends nothing when no endpoint is configured', async () => {
    const fetchImpl = ok(1)
    expect(await recordVisit({ endpoint: undefined, fetchImpl, session: null })).toBeNull()
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('returns the new total on success', async () => {
    const fetchImpl = ok(42)
    expect(await recordVisit({ endpoint: '/count', fetchImpl, session: null })).toBe(42)
  })

  it('posts an empty body — the endpoint learns a visit happened and nothing else', async () => {
    const fetchImpl = ok(1)
    await recordVisit({ endpoint: '/count', fetchImpl, session: null })
    const [, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(init.method).toBe('POST')
    expect(init.body).toBeUndefined()
  })

  it('counts a session once, so a reload does not inflate the number', async () => {
    const fetchImpl = ok(7)
    const s = session()
    expect(await recordVisit({ endpoint: '/count', fetchImpl, session: s })).toBe(7)
    expect(await recordVisit({ endpoint: '/count', fetchImpl, session: s })).toBeNull()
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  // Every failure below must be indistinguishable from the counter not existing.
  it('returns null when offline instead of throwing', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('Failed to fetch')) as unknown as typeof fetch
    await expect(recordVisit({ endpoint: '/count', fetchImpl, session: null })).resolves.toBeNull()
  })

  it('returns null on a non-ok response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }) as unknown as typeof fetch
    expect(await recordVisit({ endpoint: '/count', fetchImpl, session: null })).toBeNull()
  })

  it('returns null on malformed JSON', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => {
        throw new SyntaxError('bad json')
      },
    }) as unknown as typeof fetch
    expect(await recordVisit({ endpoint: '/count', fetchImpl, session: null })).toBeNull()
  })

  it.each([['a string', 'lots'], ['a missing field', undefined], ['NaN', NaN], ['null', null]])(
    'returns null when the count is %s',
    async (_label, value) => {
      expect(await recordVisit({ endpoint: '/count', fetchImpl: ok(value), session: null })).toBeNull()
    },
  )

  it('does not mark the session counted when the request failed', async () => {
    const failing = vi.fn().mockRejectedValue(new Error('down')) as unknown as typeof fetch
    const s = session()
    await recordVisit({ endpoint: '/count', fetchImpl: failing, session: s })
    // A failed visit must remain retryable, or an offline first load is never counted.
    expect(await recordVisit({ endpoint: '/count', fetchImpl: ok(3), session: s })).toBe(3)
  })
})
