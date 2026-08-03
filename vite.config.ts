import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import basicSsl from '@vitejs/plugin-basic-ssl'
import path from 'path'
import { VitePWA } from 'vite-plugin-pwa'

const GITHUB_PAGES_BASE = '/tindahan-manager/'

function resolveBasePath(): string {
  const configuredBase = process.env.VITE_DEPLOY_BASE?.trim()
  if (configuredBase) {
    return configuredBase.endsWith('/') ? configuredBase : `${configuredBase}/`
  }

  return process.env.GITHUB_ACTIONS === 'true' ? GITHUB_PAGES_BASE : '/'
}

// https://vite.dev/config/
export default defineConfig({
  base: resolveBasePath(),
  plugins: [
    react(),
    tailwindcss(),
    basicSsl(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: [
        'favicon.svg',
        'apple-touch-icon.png',
        'pwa-192x192.png',
        'pwa-512x512.png',
        'pwa-maskable-512x512.png'
      ],
      workbox: {
        cleanupOutdatedCaches: true,
        navigateFallback: 'index.html'
      },
      devOptions: {
        enabled: true
      },
      manifest: {
        id: '.',
        name: 'Tindahan - POS & Inventory',
        short_name: 'Tindahan',
        description: 'Store management and point-of-sale application',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '.',
        scope: '.',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
