import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const runtimeEnv = (
  globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> }
  }
).process?.env
const repositoryName = runtimeEnv?.GITHUB_REPOSITORY?.split('/')[1]
const base = runtimeEnv?.GITHUB_ACTIONS && repositoryName ? `/${repositoryName}/` : '/'

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'N//XT — Whole health, understood together',
        short_name: 'N//XT',
        description: 'A local-first whole-health workspace for body, mind, and life.',
        theme_color: '#080e18',
        background_color: '#080e18',
        display: 'standalone',
        display_override: ['window-controls-overlay', 'standalone'],
        orientation: 'portrait-primary',
        start_url: base,
        scope: base,
        id: base,
        icons: [
          { src: `${base}pwa-192.svg`, sizes: '192x192', type: 'image/svg+xml' },
          { src: `${base}pwa-512.svg`, sizes: '512x512', type: 'image/svg+xml' },
        ],
      },
    }),
  ],
})
