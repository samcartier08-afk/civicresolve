import { VitePWA } from 'vite-plugin-pwa';

/** Add `pwa` to the plugins array in vite.config.ts. Makes the website installable and works offline for the app shell. */
export const pwa = VitePWA({
  registerType: 'autoUpdate',
  manifest: {
    name: 'CivicResolve',
    short_name: 'CivicResolve',
    description: 'Report civic problems and track them until they are fixed.',
    theme_color: '#0f1b2d',
    background_color: '#f7f7f4',
    display: 'standalone',
    start_url: '/',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  },
  // Never serve the API from the cache; citizens must always see live status.
  workbox: { navigateFallbackDenylist: [/^\/api\//] },
});
