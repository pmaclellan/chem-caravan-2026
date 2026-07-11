import { defineConfig, configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    // admin/ is a separate local-only app (own env vars, service-role Supabase key) — never let
    // it get swept into the public site's test run, which is part of the Netlify build gate.
    exclude: [...configDefaults.exclude, 'admin/**'],
  },
})
