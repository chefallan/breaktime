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
