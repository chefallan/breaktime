/**
 * Global visit counter.
 *
 * Deliberately inert unless VITE_VISIT_COUNTER_URL is set, so the app makes no
 * outbound request at all by default. Nothing about the app's behaviour depends
 * on this succeeding: it never throws, never blocks a render, and returns null
 * on every failure path including being offline.
 *
 * The request body is empty on purpose. No id, no device info, no preferences —
 * the endpoint learns that a visit happened and nothing else. Keep it that way;
 * the moment this carries anything identifying it stops being a counter and
 * starts being tracking, with the consent obligations that implies.
 */

const SESSION_KEY = 'breaktime.visit-counted'

let warned = false

/**
 * Dev-only, once per session. A configured-but-broken counter is otherwise
 * indistinguishable from no counter at all, which makes a typo in the endpoint
 * genuinely hard to spot. Silent in production, where the user must never see it.
 */
function warnOnce(detail: string): void {
  if (warned || !import.meta.env.DEV) return
  warned = true
  console.warn(
    `[breaktime] Visit counter is configured but ${detail}. Check VITE_VISIT_COUNTER_URL. ` +
      'The app is unaffected; the count simply will not be recorded.',
  )
}

export interface VisitOptions {
  endpoint?: string
  fetchImpl?: typeof fetch
  /** Guards against a reload inflating the count. Pass null to always send. */
  session?: Pick<Storage, 'getItem' | 'setItem'> | null
}

function alreadyCounted(session: VisitOptions['session']): boolean {
  if (!session) return false
  try {
    return session.getItem(SESSION_KEY) === '1'
  } catch {
    return false
  }
}

function markCounted(session: VisitOptions['session']): void {
  if (!session) return
  try {
    session.setItem(SESSION_KEY, '1')
  } catch {
    // Storage unavailable. Worst case the visit is counted twice; not worth caring about.
  }
}

/**
 * Records one visit and returns the new total, or null if the counter is not
 * configured, the request failed, or this session was already counted.
 */
export async function recordVisit(options: VisitOptions = {}): Promise<number | null> {
  const {
    endpoint = import.meta.env.VITE_VISIT_COUNTER_URL,
    fetchImpl = typeof fetch === 'function' ? fetch : undefined,
    session = typeof sessionStorage !== 'undefined' ? sessionStorage : null,
  } = options

  if (!endpoint || !fetchImpl) return null
  if (alreadyCounted(session)) return null

  try {
    const res = await fetchImpl(endpoint, {
      method: 'POST',
      // Survives the tab closing mid-flight without delaying navigation.
      keepalive: true,
    })
    if (!res.ok) {
      warnOnce(`the endpoint returned ${res.status}`)
      return null
    }

    const body: unknown = await res.json()
    const count = (body as { count?: unknown } | null)?.count
    if (typeof count !== 'number' || !Number.isFinite(count)) {
      warnOnce('the response had no numeric "count" field')
      return null
    }

    markCounted(session)
    return count
  } catch (error) {
    // Offline, DNS failure, blocked by an extension, malformed JSON. All the
    // same outcome: the app carries on exactly as if the counter did not exist.
    warnOnce(`the request failed (${error instanceof Error ? error.message : 'unknown error'})`)
    return null
  }
}
