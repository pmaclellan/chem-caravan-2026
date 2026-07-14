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
    // netlify/functions/ similarly expects server-only env vars (ANTHROPIC_API_KEY) that aren't
    // set in this test environment. .claude/worktrees/** holds nested git worktree checkouts
    // (physically inside this directory tree) — without this, vitest's default globbing picks up
    // and runs their test files too, duplicating (and, if they're mid-edit, potentially failing)
    // this project's own test suite.
    exclude: [...configDefaults.exclude, 'admin/**', 'netlify/functions/**', '.claude/worktrees/**'],
  },
})
