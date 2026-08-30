import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'favicon.svg', 'favicon-96.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'Breaktime — merienda, sized to your break',
        short_name: 'Breaktime',
        description:
          'Filipino merienda for remote workers. Swipe for something to cook and something to sip that actually fits the break you have.',
        // Pinned so a future change to start_url cannot orphan installs.
        id: '/',
        lang: 'en',
        theme_color: '#1c1310',
        background_color: '#1c1310',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        categories: ['food', 'lifestyle'],
        // Listing our own manifest is what lets getInstalledRelatedApps() answer
        // "yes, this device already has it" — see src/pwa/installedApps.ts. The
        // URL has to be absolute and on the app's own origin, so this reports
        // nothing on localhost, and the gate falls back to its normal copy.
        related_applications: [
          { platform: 'webapp', url: 'https://breaktime.chefallan.xyz/manifest.webmanifest' },
        ],
        // Must stay false. True tells the browser to point people at the related
        // app instead of installing this one — which here is itself, and would
        // suppress the install prompt the gate depends on.
        prefer_related_applications: false,
        icons: [
          { src: 'favicon-96.png', sizes: '96x96', type: 'image/png' },
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: 'icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Fonts included deliberately: they are self-hosted precisely so the
        // first offline launch still has the right type.
        globPatterns: ['**/*.{js,css,html,png,svg,woff,woff2}'],
        // The link-preview card is for crawlers; no installed app ever loads it.
        globIgnores: ['**/og-image.png'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },
    }),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
  },
})
