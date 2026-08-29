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

The count is not yet wired to any host — see `plans/breaktime-pwa.md`. A public
increment endpoint is trivially inflatable by anyone with `curl`, which matters
because the number is displayed to users.
