import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: true
      },
      manifest: {
        name: 'Whisper Slate',
        short_name: 'Whisper',
        theme_color: '#ffffff',
        icons: [
          {
            src: '/vite.svg',
            sizes: '192x192',
            type: 'image/svg+xml'
          },
          {
            src: '/vite.svg',
            sizes: '512x512',
            type: 'image/svg+xml'
          }
        ]
      },
      workbox: {
        // v2 architecture: @huggingface/transformers and its WASM model weights
        // (~100–200 MB) have been removed from the client.  The app now only
        // caches its own JS/CSS/HTML assets, so the default 5 MB limit is fine.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        // No runtime cache for huggingface.co — models run server-side now.
      }
    })
  ],
})
