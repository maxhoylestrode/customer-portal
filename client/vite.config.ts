import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Custom service worker (src/sw.ts) instead of the auto-generated one —
      // needed for the push/notificationclick handlers. It still precaches
      // the app shell via workbox-precaching; see src/sw.ts for the "never
      // cache /api" reasoning (there's no fetch handler for it at all, so
      // those requests just pass straight through to the network).
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
      },
      registerType: 'autoUpdate',
      includeAssets: ['icons/favicon-32.png', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Apex Portal',
        short_name: 'Apex Portal',
        description: 'Apex Studio Codes — client ticket portal and staff CRM',
        theme_color: '#0D3040',
        background_color: '#0D3040',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      devOptions: {
        // Skip the service worker in `vite dev` — it complicates hot reload
        // and this is dev-only; the SW only matters for the built app.
        enabled: false,
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 4173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
