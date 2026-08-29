# Breaktime

A PWA for Filipino remote workers: swipe left to pass, right to take, and get one
thing to cook and one thing to sip that actually fits the break you have.

The problem it solves is decision fatigue, not recipe discovery — you should reach
a decision in under 30 seconds, not browse a catalogue. Merienda is the anchor,
and the graveyard shift is a first-class case, not an afterthought.

## Running it

```bash
npm install
```

```bash
npm run dev
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server on :5173 |
| `npm run build` | Typecheck and production build to `dist/` |
| `npm run preview` | Serve the built app (needed to exercise the service worker) |
| `npm test` | Full suite — 80 tests |
| `npm run test:watch` | Watch mode |

The service worker is disabled in dev. To test offline behaviour, `npm run build`
then `npm run preview`, load the page once, then stop the server and reload.

## How it fits together

| Path | Role |
| --- | --- |
| `src/data/schema.ts` | Recipe shape and its validator |
| `src/data/{drinks,merienda,meals}.ts` | The 69 recipes |
| `src/engine/suggest.ts` | Pure deck builder — no React, no storage |
| `src/engine/daypart.ts` | Hour → daypart, and the lamp colour per daypart |
| `src/state/prefs.ts` | `localStorage` wrapper for prefs and history |
| `src/components/SwipeDeck.tsx` | The card stack and its gestures |

## Two things worth knowing before you change anything

**Allergens are hard filters, never rankings.** `isEligible` in `suggest.ts` is the
only gate that matters: a recipe carrying a declared allergen must be *absent* from
the deck, not ranked last. The validator enforces a second guard — a recipe's
declared `allergens` must be a superset of the allergens on its ingredients, so
adding bagoong to a recipe without tagging shellfish fails the build rather than
reaching someone who cannot eat it.

**Deck state never depends on an animation finishing.** The exit animation is
decorative and runs after the deck has already advanced. Coupling the two strands
the user on a card forever anywhere animation frames do not run — a backgrounded
tab, a dropped frame. `SwipeDeck.test.tsx` guards this; jsdom runs no animation
frames, so the old design fails there.

`totalMinutes` is wall-clock including prep and cleanup, not the "cook time"
recipe sites report. If that drifts, the app's only promise breaks.

Design decisions and their reasoning are in [`plans/breaktime-pwa.md`](plans/breaktime-pwa.md).

## Visit counter

Off by default. The app makes **no outbound request at all** unless
`VITE_VISIT_COUNTER_URL` is set at build time — verified by inspecting the
default bundle, where the endpoint compiles to `undefined`.

When set, the app sends one `POST` per browser session and shows the total on the
break picker. Your endpoint needs to satisfy exactly this:

| | |
| --- | --- |
| Request | `POST <VITE_VISIT_COUNTER_URL>`, **empty body** |
| Response | `200` with JSON `{ "count": <number> }` |
| CORS | Required if the endpoint is on a different origin than the app |

The empty body is deliberate. The endpoint learns that a visit happened and
nothing else — no id, no device info, no preferences. That keeps this a counter
rather than tracking, which is what keeps it clear of consent obligations. If you
ever add an identifier, that calculus changes.

Every failure path — offline, wrong URL, endpoint down, malformed response —
returns null and renders nothing. The app never shows a zero or a placeholder in
place of a real number. In dev only, a misconfigured endpoint logs one console
warning, because a silent failure is indistinguishable from no counter and makes
a typo very hard to spot.

Note for Windows: setting the variable in Git Bash mangles a value starting with
`/` into a Windows path (`/api/count` becomes `C:/Program Files/Git/api/count`).
Use a full `http://…` URL, or prefix the command with `MSYS_NO_PATHCONV=1`.

### Deploying it on Vercel

The endpoint is `api/count.ts` — an edge function that does one atomic `INCR`
against Upstash over plain HTTP. No database driver, no connection pool, no
dependency. Postgres would work but is the wrong shape for a single integer, and
Supabase's free tier pauses after about a week of inactivity, which is exactly
when a young app's counter would quietly stop.

1. Push the repo and import it on Vercel — it detects Vite and the `api/` folder.
2. **Storage → Upstash Redis** from the Vercel marketplace, attached to the
   project. That sets `KV_REST_API_URL` and `KV_REST_API_TOKEN` for you. (A
   standalone Upstash account works too — the handler accepts `UPSTASH_REDIS_REST_URL`
   and `UPSTASH_REDIS_REST_TOKEN` as well.)
3. Add an environment variable `VITE_VISIT_COUNTER_URL` = `/api/count`.
4. **Redeploy.**

Step 4 is not optional. `VITE_*` variables are inlined at *build* time, not read
at runtime — adding the variable without rebuilding leaves the old bundle with
the counter still compiled out, and the count silently stays hidden. Because the
endpoint is same-origin, no CORS configuration is needed.

To verify after deploying:

```bash
curl -X POST https://your-app.vercel.app/api/count
```

That should return `{"count":N}`. A 503 means the storage variables are missing;
a 502 means storage is unreachable.

### On inflation

Anyone can run that curl in a loop, and the number is shown to users. There is no
way to fully prevent this on a public endpoint — a shared secret would sit in the
client bundle where anyone can read it.

If it becomes a problem, the cheap mitigation is a per-IP throttle in the handler:
`SET ip:<addr> 1 EX 86400 NX` before the `INCR`, and skip the increment when the
key already exists. That also turns the number into something closer to daily
unique visitors, which is arguably the more honest statistic. It does mean the
endpoint processes IP addresses, which is a privacy tradeoff worth making
deliberately rather than by default — which is why it is not built in.
