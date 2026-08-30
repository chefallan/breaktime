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
| `npm test` | Full suite — 186 tests |
| `npm run test:watch` | Watch mode |
| `npm run icons` | Redraw the mark and every icon into `public/` |

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
| `src/pwa/platform.ts` | Which install path, if any, this browser has |
| `src/pwa/installPrompt.ts` | Holds Chromium's `beforeinstallprompt` for later replay |
| `src/pwa/installedApps.ts` | Asks the browser whether this device already has it |
| `src/screens/InstallGate.tsx` | The screen that stands between a tab and the app |
| `scripts/generate-icons.mjs` | Draws the mark; writes every icon and the OG card |

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

## The install gate

The app does not render in a browser tab. `InstallGate` sits above `App` in
`main.tsx` and shows an install screen until the page is running in standalone
display mode — that is, launched from a home screen or a dock.

**There is deliberately no way past it.** A "continue in browser" link is what
everybody taps, and a gate everybody taps past is not a gate. The cost is real and
worth being clear about: a browser with no install path at all — Firefox on the
desktop, a webview inside Instagram or Messenger — cannot reach the app. Those get
instructions and a copyable link rather than a dead end. If that trade stops being
worth it, the change is one branch in `InstallGate`, not a rewrite.

No browser exposes an API that installs a PWA on the user's behalf, so this is the
strongest form the requirement can take. Two mechanics carry it:

`src/pwa/platform.ts` decides which of six situations the visitor is in, from the
user agent and a display-mode query. User-agent sniffing is normally the wrong
tool; here the browser's own identity is exactly the fact needed, and there is
nothing to feature-detect. Two cases are easy to get wrong and are tested:
**iPadOS 13+ reports a `Macintosh` user agent** (only `maxTouchPoints` separates
it from a real Mac), and **in-app webviews carry the host engine's user agent**, so
Facebook on Android looks exactly like Chrome unless it is checked first.

`src/pwa/installPrompt.ts` keeps Chromium's `beforeinstallprompt` event. That event
fires once, early — routinely before React has mounted — and `prompt()` only works
inside a user gesture, so it has to be stored and replayed from a click. The
earliest capture is an inline script in `index.html`, which runs before the bundle
is parsed; the module picks the event up from there. **If you move that script
below the module tag, installs on Chromium quietly fall back to the manual
instructions** — nothing errors.

`src/pwa/installedApps.ts` covers the case those two miss. **Chromium never fires
`beforeinstallprompt` for an app it has already installed**, so without it someone
who installed last month, then taps an old link, is told to install what they
already have. `navigator.getInstalledRelatedApps()` answers that — but only for
apps the manifest claims as related, which is why the manifest lists **its own
URL** under `related_applications`. Two things about that entry:

- `prefer_related_applications` **must stay false.** True tells the browser to send
  people to the related app rather than install this one — which here is itself,
  and would suppress the very prompt the gate depends on.
- The URL is absolute and on the production origin, so the check reports nothing
  on localhost. That is fine: every uncertain path resolves `false`, and false is
  what the gate would have assumed anyway. It is Chromium-only, and it is a
  courtesy, never a way through the gate — the app still only renders in
  standalone display mode.

To exercise it locally: `npm run build && npm run preview` shows the gate; opening
the same URL in a Chrome window launched with `--app=…` shows the app. The
already-installed path needs the real domain, since it keys off the manifest URL.

## Icons and link previews

One mark, drawn as geometry in `scripts/generate-icons.mjs` and rasterized by
`sharp`: a kraft-cream disc with one wedge lifted out of it in ube. It reads as a
slice of bibingka and as a wedge of a clock face at once. It is a solid silhouette
with no thin strokes and no text, which is what lets it survive a 16px favicon and
a maskable crop.

`npm run icons` writes all of `public/favicon.svg`, `favicon.ico`, `favicon-96.png`,
`icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png` and
`og-image.png`. The output is committed, so the script only runs when the mark
changes.

Two things in there are deliberate. The wedge is cut with an SVG **mask**, not
painted in the background colour — the link-preview card has a gradient behind the
mark, and a painted gap would show as a dark outline on it. And the wordmark is
converted to **outlines** by `opentype.js` from the TTFs in `assets/fonts/`, rather
than left as SVG `<text>`, so the card does not change depending on which fonts the
machine running the script happens to have installed.

`og-image.png` is excluded from the service worker's precache (`globIgnores` in
`vite.config.ts`). It exists for crawlers; no installed app ever loads it, and it is
80 KB.

Open Graph and Twitter tags live in `index.html` with **absolute** URLs on
`https://breaktime.chefallan.xyz`. Unfurlers do not resolve relative image paths. If
the domain ever changes, those tags and `SITE` in the icon script change with it.

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

   This is the step that gets skipped, and skipping it looks exactly like the
   feature not existing: the count never appears, and nothing anywhere complains.
   The one-line check is step 5 below — a `503` means you are here.
3. Add an environment variable `VITE_VISIT_COUNTER_URL` = `/api/count`.
4. **Redeploy.**

Step 4 is not optional. `VITE_*` variables are inlined at *build* time, not read
at runtime — adding the variable without rebuilding leaves the old bundle with
the counter still compiled out, and the count silently stays hidden. Because the
endpoint is same-origin, no CORS configuration is needed.

5. **Verify.** This is the whole diagnosis, and it separates the two halves
   cleanly:

   ```bash
   curl -X POST https://breaktime.chefallan.xyz/api/count
   ```

   | Response | What it means |
   | --- | --- |
   | `{"count":N}` | The endpoint is fine. If the number still does not show, `VITE_VISIT_COUNTER_URL` was missing at build time — check `grep -o 'api/count' dist/assets/*.js`, or the deployed bundle. |
   | `503` | Step 2 was skipped: no `KV_REST_API_*` on the project. |
   | `502` | The variables are set but Upstash is unreachable or rejected the write. |
   | `405` | You used GET. The counter only increments on POST, so crawlers cannot drive it. |

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
