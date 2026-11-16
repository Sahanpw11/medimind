import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const api = process.env.VITE_API_TARGET || 'http://localhost:4000';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'MediMind',
        short_name: 'MediMind',
        description: 'Educational healthcare platform prototype. Synthetic data only.',
        theme_color: '#FFFFFF',
        background_color: '#F5F7FA',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        scope: '/',
        categories: ['health', 'medical'],
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/ai\//],
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Synthetic medical data must never be stored by the service worker.
        runtimeCaching: [{ urlPattern: ({ url }) => /^\/(api|ai)\//.test(url.pathname), handler: 'NetworkOnly' }],
      },
    }),
  ],
  server: { port: 5173, proxy: { '/api': { target: api, changeOrigin: false } } },
  preview: { port: 4173, proxy: { '/api': { target: api, changeOrigin: false } } },
  build: { sourcemap: false, chunkSizeWarningLimit: 700 },
});
