# Install gate + visual identity

## Goal

Anyone opening <https://breaktime.chefallan.xyz/> in a browser tab sees a full
screen telling them to install Breaktime, and cannot reach the app until they
open it from their home screen or dock. And the app finally looks like something
when it is shared: a real mark instead of the placeholder ring, a favicon, and a
link preview card that shows what Breaktime is.

## Out of scope

- **Making the visit count appear.** Diagnosed, not fixable here.
  `POST /api/count` on production returns `503 {"error":"Counter storage is not
  configured."}`, and the deployed bundle already inlines `endpoint:"/api/count"`,
  so the client and the endpoint are both correct. The Vercel project has no
  `KV_REST_API_URL` / `KV_REST_API_TOKEN` — README step 2 (Storage → Upstash
  Redis) was never done. `api/count.ts` and `src/state/visits.ts` are not touched
  by this plan.
- Any change to onboarding, the deck, ranking, or recipe data.
- An in-app "update available" prompt. `registerType: 'autoUpdate'` still handles
  updates silently.
- Analytics of any kind on the gate. No counting who bounced.

## Constraints

- **No browser API can force an install.** The gate is the strongest thing that
  exists: refuse to render the app outside standalone display mode. A determined
  user can always read the bundle. That is accepted.
- `beforeinstallprompt` fires early and only once, often before React mounts, and
  `prompt()` is only callable from a user gesture. The event has to be captured
  before the module graph loads, and the captured event replayed on click.
- iOS Safari has no install API at all. Instructions are the only option there,
  and iPadOS 13+ reports a `Macintosh` user agent, so UA sniffing alone is wrong.
- The chosen answer is a **hard block everywhere**: no "continue in browser"
  escape. Browsers that cannot install get instructions plus a copyable link.
- Icons are referenced by name from three places — `vite.config.ts` manifest,
  `index.html`, and `public/`. All three must agree or the manifest 404s.
- Existing palette is fixed: ground `#1c1310`, card `#eddcbf`, ube `#9b6fd4`,
  gata `#f6eedf`. The mark uses those and introduces no new colour.
- Pre-PR command is `npm test && npm run build`.

## Steps

1. **Add the pure platform-detection module.**
   `src/pwa/platform.ts`, `src/pwa/platform.test.ts`. A `detectPlatform({ userAgent,
   maxTouchPoints, standalone, matchMedia })` returning one of `standalone |
   chromium | ios | macos-safari | in-app | unsupported`, with no globals read
   directly so it is testable.
   *Done when* `npx vitest run src/pwa/platform.test.ts` passes, covering:
   display-mode standalone, iOS Safari, iPadOS-reporting-Macintosh, Chrome
   desktop, Firefox desktop, and an FBAN in-app browser.

2. **Capture `beforeinstallprompt` before the app loads.**
   Inline script in `index.html` head stashing the event on `window`, plus
   `src/pwa/installPrompt.ts` that seeds from that stash, subscribes to later
   firings, and exposes `subscribe`/`promptInstall`.
   *Done when* `npx vitest run src/pwa/installPrompt.test.ts` passes: a listener
   added after the event still receives it, and `promptInstall` resolves
   `accepted` / `dismissed` / `unavailable`.

3. **Build the gate screen.**
   `src/screens/InstallGate.tsx`, `src/screens/InstallGate.test.tsx`. Renders
   per-platform copy; an Install button only where a deferred prompt exists;
   a copy-link control on `in-app` and `unsupported`.
   *Done when* `npx vitest run src/screens/InstallGate.test.tsx` passes,
   including the negative case: **on every non-standalone platform the gate
   renders and the app's children do not**.

4. **Mount the gate ahead of the app.**
   `src/main.tsx` renders `<InstallGate><App/></InstallGate>` inside the existing
   `ErrorBoundary`, so a crash in the gate is still caught.
   *Done when* `npm test` is green and `npm run dev` in a normal tab shows the
   gate, while a Chrome window launched with `--app=http://localhost:5173` shows
   the app.

5. **Draw the mark and rasterize every size.**
   `assets/logo.svg` (source), `scripts/generate-icons.mjs` using `sharp` as a
   devDependency. Emits `public/favicon.svg`, `favicon-96.png`, `icon-192.png`,
   `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png`, and
   `og-image.png` (1200×630).
   *Done when* `npm run icons` regenerates all of them and each file's dimensions
   check out.

6. **Wire up the metadata.**
   `index.html` gets description, canonical, `og:*`, `twitter:*`, icon links, and
   `apple-mobile-web-app-*`; `vite.config.ts` manifest gains the new icon entries
   and `includeAssets`.
   *Done when* `npm run build` succeeds and `dist/index.html` contains an absolute
   `og:image` URL on the production origin, with `dist/og-image.png` present.

7. **Update the docs.**
   `README.md` gains an install-gate section and a sharper statement of the
   Upstash step; `AGENTS.md` "where things live" gains `src/pwa/`.
   *Done when* `npm test && npm run build` passes.

## Open questions

None blocking. One thing the human owns and code cannot: attaching **Storage →
Upstash Redis** to the Vercel project, then redeploying, is what makes the visit
count appear. Until that is done the number stays hidden by design.

## What actually happened

Shipped in `cff212f`, with one step that was not in the plan above.

**Step 8, added after review.** `src/pwa/installedApps.ts`. Chromium never fires
`beforeinstallprompt` for an app it has already installed, so the gate as planned
told returning visitors to install what they already had. `getInstalledRelatedApps()`
closes that, which is why the manifest now lists its own URL under
`related_applications` with `prefer_related_applications` pinned to `false`. It is
a courtesy and never a way through — there is a test asserting the app still does
not render on the strength of that detection alone.

**Not verified, and it cannot be here.** The already-installed branch keys off the
manifest URL, so it reports nothing on localhost and needs the real domain plus a
genuinely installed PWA. Unit tests cover the logic; the live path has not run.

**Still open, and not ours.** `POST /api/count` returned 503 at the time of
writing. Attaching Storage → Upstash Redis to the Vercel project and redeploying
is what makes the visit count appear.
