import { afterEach, describe, expect, it, vi } from 'vitest'
import handler from './count'

const post = () => new Request('https://breaktime.app/api/count', { method: 'POST' })

function configure() {
  vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://redis.example.com')
  vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'secret-token')
}

const upstashReturns = (body: unknown, ok = true) =>
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok, json: async () => body }))

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('POST /api/count', () => {
  it('increments and returns the new total', async () => {
    configure()
    upstashReturns({ result: 42 })
    const res = await handler(post())
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ count: 42 })
  })

  it('calls INCR with the bearer token', async () => {
    configure()
    upstashReturns({ result: 1 })
    await handler(post())
    const [url, init] = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(url).toBe('https://redis.example.com/incr/breaktime:visits')
    expect(init.headers.authorization).toBe('Bearer secret-token')
  })

  it('accepts the KV_* names Vercel’s integration sets', async () => {
    vi.stubEnv('KV_REST_API_URL', 'https://kv.example.com')
    vi.stubEnv('KV_REST_API_TOKEN', 'kv-token')
    upstashReturns({ result: 7 })
    const res = await handler(post())
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ count: 7 })
  })

  it('tolerates a trailing slash on the storage URL', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://redis.example.com/')
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 't')
    upstashReturns({ result: 1 })
    await handler(post())
    const [url] = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(url).toBe('https://redis.example.com/incr/breaktime:visits')
  })

  // A counter that increments on GET is driven up by every crawler and link
  // preview that touches the URL.
  it.each(['GET', 'HEAD', 'PUT', 'DELETE'])('refuses %s', async (method) => {
    configure()
    upstashReturns({ result: 1 })
    const res = await handler(new Request('https://breaktime.app/api/count', { method }))
    expect(res.status).toBe(405)
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('never lets the edge cache the response', async () => {
    configure()
    upstashReturns({ result: 5 })
    const res = await handler(post())
    expect(res.headers.get('cache-control')).toContain('no-store')
  })

  it('reports 503 when storage is not configured', async () => {
    upstashReturns({ result: 1 })
    const res = await handler(post())
    expect(res.status).toBe(503)
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('reports 502 when storage rejects the write', async () => {
    configure()
    upstashReturns({ error: 'nope' }, false)
    expect((await handler(post())).status).toBe(502)
  })

  it('reports 502 when storage is unreachable', async () => {
    configure()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network down')))
    expect((await handler(post())).status).toBe(502)
  })

  it('reports 502 on an unexpected response shape', async () => {
    configure()
    upstashReturns({ result: 'forty-two' })
    expect((await handler(post())).status).toBe(502)
  })

  // Every non-200 above makes the client render nothing at all, so a broken
  // counter is invisible to the user rather than showing a wrong number.
  it('never returns a count field on any failure', async () => {
    configure()
    upstashReturns({ result: null }, true)
    const body = (await (await handler(post())).json()) as Record<string, unknown>
    expect(body).not.toHaveProperty('count')
  })
})

/**
 * Client and endpoint are written in separate files against a written contract.
 * These run the real handler and feed its Response straight into the real client,
 * so a drift between the two shapes fails here rather than in production.
 */
describe('contract with the browser client', () => {
  it('hands the client a number it accepts', async () => {
    const { recordVisit } = await import('../src/state/visits')
    configure()
    upstashReturns({ result: 1337 })
    const count = await recordVisit({
      endpoint: '/api/count',
      fetchImpl: (() => handler(post())) as unknown as typeof fetch,
      session: null,
    })
    expect(count).toBe(1337)
  })

  it.each([
    ['storage unconfigured', () => vi.unstubAllEnvs()],
    ['storage rejecting', () => upstashReturns({}, false)],
    ['an unexpected shape', () => upstashReturns({ result: 'nope' })],
  ])('renders nothing when the endpoint reports %s', async (_label, breakIt) => {
    const { recordVisit } = await import('../src/state/visits')
    configure()
    upstashReturns({ result: 1 })
    breakIt()
    const count = await recordVisit({
      endpoint: '/api/count',
      fetchImpl: (() => handler(post())) as unknown as typeof fetch,
      session: null,
    })
    expect(count).toBeNull()
  })
})
