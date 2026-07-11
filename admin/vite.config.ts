import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

// Local-only admin tool — a fully separate Vite app from the root config. Never referenced by
// netlify.toml, the root tsconfig project references, or the root vite.config.ts, so its
// service-role Supabase key (see src/lib/supabaseAdmin.ts) can never be inlined into the public
// site's bundle. Run with `npm run admin:dev`; there is no build/deploy target for this app.
const adminRoot = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  root: adminRoot,
  publicDir: fileURLToPath(new URL('../public', import.meta.url)),
  plugins: [react()],
  resolve: {
    alias: {
      '@main': fileURLToPath(new URL('../src', import.meta.url)),
    },
  },
  server: {
    fs: { allow: [fileURLToPath(new URL('..', import.meta.url))] },
  },
})
