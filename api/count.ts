/**
 * Global visit counter — one integer, incremented atomically.
 *
 * Runs on Vercel's edge runtime and talks to Upstash over its REST API, so there
 * is no database driver, no connection pool, and no dependency to keep current.
 * INCR is atomic, so concurrent visits cannot lose a count.
 *
 * Deliberately stores nothing but the number. No IP, no user agent, no id — the
 * request body is empty and stays that way. See README for why that matters.
 */

export const config = { runtime: 'edge' }

const KEY = 'breaktime:visits'

/** Vercel's Upstash integration sets KV_*; a direct Upstash setup sets UPSTASH_*. */
function credentials(env: Record<string, string | undefined>) {
  const url = env.KV_REST_API_URL ?? env.UPSTASH_REDIS_REST_URL
  const token = env.KV_REST_API_TOKEN ?? env.UPSTASH_REDIS_REST_TOKEN
  return url && token ? { url: url.replace(/\/$/, ''), token } : null
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      // Without this the edge can cache the response and the count freezes.
      'cache-control': 'no-store, max-age=0',
    },
  })
}

export default async function handler(request: Request): Promise<Response> {
  // A counter that increments on GET would be driven up by every crawler and
  // link preview that touches the URL.
  if (request.method !== 'POST') {
    return json({ error: 'Use POST.' }, 405)
  }

  const creds = credentials(process.env as Record<string, string | undefined>)
  if (!creds) {
    // Misconfigured rather than broken. The client renders nothing either way.
    return json({ error: 'Counter storage is not configured.' }, 503)
  }

  try {
    const res = await fetch(`${creds.url}/incr/${KEY}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${creds.token}` },
    })
    if (!res.ok) return json({ error: 'Counter storage rejected the write.' }, 502)

    const body = (await res.json()) as { result?: unknown }
    if (typeof body.result !== 'number') {
      return json({ error: 'Counter storage returned an unexpected shape.' }, 502)
    }

    return json({ count: body.result }, 200)
  } catch {
    return json({ error: 'Counter storage is unreachable.' }, 502)
  }
}
