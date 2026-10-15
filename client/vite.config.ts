import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'EventRoute — Campus Event Navigation',
        short_name: 'EventRoute',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#2f6bff',
        icons: [
          { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.mapbox\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'mapbox-api' },
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/events') || url.pathname.startsWith('/api/venues'),
            handler: 'NetworkFirst',
            options: { cacheName: 'eventroute-api', networkTimeoutSeconds: 5 },
          },
        ],
      },
    }),
  ],
  server: { port: 5173 },
})
