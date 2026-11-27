/**
 * vite.config.js — single config for all deployment targets.
 *
 * Base path (BASE_PATH env var at build time):
 *   GitHub Pages (default):  '/re-former/'
 *   Netlify:                 BASE_PATH=/ npm run build
 *
 * Offline: the service worker precaches everything in dist/, including the
 * form PDFs in public/forms, the fonts, and the geoid grid. The app therefore
 * works fully offline after one online visit.
 */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

const base = process.env.BASE_PATH ?? '/re-former/'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),

    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',

      registerType: 'prompt',
      injectRegister: false,

      manifest: false,

      injectManifest: {
        // Everything the app needs offline. Form PDFs are .pdf or .PDF.
        globPatterns: ['**/*.{js,mjs,css,html,ico,png,svg,woff2,ttf,json,pdf,PDF}'],
        // The largest form PDFs and the geoid grid exceed the 2 MB default.
        maximumFileSizeToCacheInBytes: 20 * 1024 * 1024,
      },

      devOptions: { enabled: false },
    }),
  ],

  base,

  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
  },

  // Vite's default 'iife' worker format cannot code-split. The PDF worker
  // lazy-loads each generator, so it needs ES module output.
  worker: {
    format: 'es',
  },

  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1500,

    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'vendor-react',   test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            { name: 'vendor-pdf-lib', test: /node_modules[\\/]pdf-lib[\\/]/ },
            { name: 'vendor-pdfjs',   test: /node_modules[\\/]pdfjs-dist[\\/]/ },
            { name: 'vendor-idb',     test: /node_modules[\\/]idb-keyval[\\/]/ },
            { name: 'vendor-lucide',  test: /node_modules[\\/]lucide-react[\\/]/ },
          ],
        },
      },
    },
  },
})
