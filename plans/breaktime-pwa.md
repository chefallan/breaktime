# Breaktime — MVP plan

## Goal

A Filipino remote worker taps the app at 3pm — merienda time, tells it how long the break is, and gets a
single card: something to cook and something to sip that genuinely fits the time
they have. Swipe left to pass, swipe right to commit and get the steps. It works
on a phone with no signal, and it never suggests something they can't eat.

The problem being solved is decision fatigue, not recipe discovery. Success is a
user reaching a decision in under 30 seconds, not browsing an impressive catalog.

## Out of scope

Deliberately excluded from the MVP. Each of these is a plausible assumption a
reader might make:

- **Accounts, login, cloud sync.** All state is device-local. This is what keeps
  the project out of the auth and personal-data critical domains.
- **Pantry inventory tracking.** Rejected during scoping: upkeep is a second job
  and users abandon it.
- **External recipe APIs.** No network dependency, no API keys, no backend proxy,
  no trust boundary.
- **Grocery lists, meal planning, calendars, nutrition or calorie tracking.**
- **Social features** — sharing, ratings, user-submitted recipes.
- **Native app store builds.** PWA install only.
- **Internationalization.** English, one locale.
- **Step-by-step cooking timers.** The break length filters the deck; it does not
  drive a live timer. (Deferred, not rejected — see Open questions.)

## Constraints

- **Offline is a hard requirement, not a nice-to-have.** Every feature must work
  with the network off. This is the constraint that forced the bundled-content
  decision and it must not quietly erode.
- **No backend.** No server, no API keys, no runtime secrets anywhere.
- **Allergy and diet exclusions are hard filters, not ranking weights.** An
  excluded ingredient must never reach the deck at any position. This is the one
  place in the app where being wrong causes real harm, so it carries an explicit
  negative test.
- **"Break length" means total wall-clock time**, including prep and cleanup —
  not "cook time" as recipe sites usually report it. The data schema must reflect
  this or the core promise is a lie.
- **Swipe cannot be the only input.** A gesture-only interface is unusable with a
  keyboard or a screen reader. Every swipe needs an equivalent button.
- **Mobile-first portrait**, one-handed, likely propped on a counter.
- Greenfield repo — no legacy patterns to preserve.

### Stack (recommended, open to challenge before step 1)

- Vite + React + TypeScript
- Tailwind CSS for styling
- `vite-plugin-pwa` (Workbox) for manifest and service worker
- `@use-gesture/react` + `react-spring` for the card deck — physics-based drag
  suits a swipe deck better than a general animation library
- Vitest + React Testing Library; Playwright for the offline smoke test
- `localStorage` behind a small typed wrapper for preferences and swipe history

## Steps

**1. Scaffold the toolchain.** — DONE (build emits a bundle; vitest runs). Vitest 2 pinned its own Vite 5 and collided with Vite 6 plugin types; upgraded to Vitest 3.
Files: `package.json`, `vite.config.ts`, `tsconfig.json`, `tailwind.config.ts`,
`src/main.tsx`, `src/App.tsx`.
Done when: `npm run build` produces a bundle and `npm test` runs (zero tests
passing is acceptable here).

**2. Define the recipe schema and seed eight recipes.** — DONE (21 tests pass, incl. the undeclared-allergen leak guard).
Files: `src/data/schema.ts`, `src/data/recipes.ts`, `src/data/schema.test.ts`.
Schema carries: id, title, kind (dish/drink), totalMinutes (wall-clock),
ingredients with allergen tags, steps, effort level, and a paired-drink
reference.
Done when: `npm test schema` passes, validating all eight seed entries — including
a case asserting a malformed entry is rejected.

**3. Build the swipe deck against the eight seed recipes.** — DONE (27 tests pass; all 8 cards cycle in-browser and the empty state lands). DIVERGENCE: the plan said verify on a real phone. This environment has no visible browser pane, so gesture input could not be driven and no screenshot was possible; verified via DOM and programmatic clicks at a 375x812 viewport instead. Real-device feel is still unverified and is the one check still owed.
Files: `src/components/SwipeDeck.tsx`, `src/components/RecipeCard.tsx`.
This is the proof step and it goes early on purpose: if the swipe does not feel
right on real hardware, the product does not work and every later step is wasted.
Includes the accessible pass/take buttons from the start, not retrofitted.
Done when: the deck is driven end-to-end on an actual phone, by gesture and by
button, and the drag physics feel right to you.

**4. Write the suggestion engine as a pure module and wire the deck to it.** — DONE (18 engine tests). The seed-variation test caught a real bug: the jitter hash folded the seed in as an initial value, so for short ids it only offset every score by a constant and could never reorder the deck. Replaced with FNV-1a + murmur3 finalizer.
Files: `src/engine/suggest.ts`, `src/engine/suggest.test.ts`.
Signature: `(recipes, prefs, history) => Recipe[]`. No React, no storage, no
side effects — it is pure so it can be tested exhaustively.
Done when: `npm test suggest` passes, and specifically includes the negative
case — given a declared peanut allergy, no recipe tagged with peanuts appears
anywhere in the returned deck — plus a break-length case asserting nothing
exceeding the chosen window is returned, and a not-enough-cards case asserting
the deck degrades gracefully rather than rendering empty.

**5. Add first-run exclusions and the break-length tap.** — DONE (16 storage tests). Verified in-browser: prefs survive reload without re-onboarding, and excluding dairy removes Champorado from the dealt deck end to end.
Files: `src/screens/Onboarding.tsx`, `src/state/prefs.ts`, `src/state/prefs.test.ts`.
One-time allergy and diet capture, then per-session break length (15/30/60).
Done when: preferences survive a full page reload, and clearing storage returns
the user to onboarding rather than to a broken deck.

**6. Build the recipe detail view — the right-swipe destination.** — DONE. Verified: take opens the detail, back returns to the deck with position preserved and the taken card gone.
Files: `src/screens/RecipeDetail.tsx`.
Ingredients, steps, the paired sip. Legible at arm's length on a counter.
Done when: a right swipe lands on the detail view and back returns to the deck
with deck position preserved.

**7. Make it a real PWA.** — DONE. 28 precache entries (494 KiB) incl. all 9 self-hosted font files. Verified offline by STOPPING the server and reloading: the app rendered and both fonts loaded from cache. Icons generated from raw pixels via a zlib PNG encoder (no image tooling available).
Files: `vite.config.ts` (PWA plugin config), `public/manifest.webmanifest`, icons.
Done when: Chrome DevTools offers the install prompt, Lighthouse's PWA checks
pass, and — with DevTools set to offline and the app cold-started — the deck
still deals cards and the detail view still renders.

**8. Expand the content to 60+ recipes.** — DONE. 69 recipes (48 dishes, 21 drinks) across drinks.ts / merienda.ts / meals.ts. Bucket depth: 43 fit 15 min, 66 fit 30, 69 fit 60 — the floor was 15. coverage.test.ts guards depth per bucket, per daypart, and per single-allergen exclusion, so the deck cannot silently run dry.
Files: `src/data/recipes.ts`.
Done when: the schema test passes across the full set, and every break-length
bucket (15/30/60) has at least fifteen entries surviving a typical exclusion
profile — verified by a test, so the deck cannot silently run dry.

## Decisions made during scoping

Recorded here because the steps do not explain them and they are expensive to
reconstruct from a diff.

- **The cuisine is Filipino, and merienda is the anchor.** Not a skin over a
  generic recipe app. Filipino break culture already has a named 3pm meal, so the
  app serves an existing habit rather than inventing one. Content is Filipino
  dishes and drinks throughout — champorado, arroz caldo, turon, ginataang bilo
  bilo; kapeng barako, salabat, sago't gulaman, calamansi juice.
- **Night shift is a first-class case, not an edge case.** A large share of
  Filipino remote workers are on US hours. A 2am break is normal and the
  time-of-day signal must treat it as such, not as an anomaly.
- **A card is a pairing** — one dish plus its sip. Short-break decks may contain
  drink-only cards, because a 15-minute break is often just a good coffee.
- **Time of day is a soft ranking nudge, never a hard filter.** It reorders the
  deck; it never removes a card. Hard filters are reserved for allergies and
  break length, where being wrong is actually harmful.
- **Taken recipes are suppressed for the rest of the day**, resetting at local
  midnight. Being offered the same merienda twice in one afternoon reads as
  broken.
- **Allergen tags follow Filipino kitchens specifically** — shellfish in bagoong
  and patis, peanuts in kare-kare, egg in leche flan, dairy in tsokolate. A
  generic allergen list would miss the ones that matter here.

## Open questions

None blocking. Items deferred by choice, not by uncertainty:

- Live cooking timers (deferred, listed in Out of scope).
- Tagalog/Taglish copy — the MVP ships English UI with Filipino dish names
  unanglicized (no "rice porridge" for lugaw).

## Status

All 8 steps landed. `npm test` → 80 passed, 0 failed. `npm run build` → clean
typecheck, 28 precache entries (539 KiB).

**Verified offline the hard way**: built, served, loaded once, then STOPPED the
server and reloaded. Onboarding, deck, and recipe detail all rendered from cache
with both self-hosted fonts.

**Real-device check: DONE.** Confirmed working on a phone by the owner. This was
the last item this environment could not verify (no visible browser pane, so no
pointer input and no screenshots). The drag path is the one that mattered: the
card-recentring bug was reproducible only through real dragging, never through
the button controls the automated tests drive.

Swipe physics (THRESHOLD, FLING_VELOCITY, EXIT_MS in src/components/SwipeDeck.tsx)
are now validated as usable, though not yet deliberately tuned.
