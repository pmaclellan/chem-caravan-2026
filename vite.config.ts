import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Netlify sets COMMIT_REF/CONTEXT in the build environment automatically (no
// netlify.toml config needed); npm sets npm_package_version from package.json
// for any `npm run` invocation. Baked in at build time so the running app can
// show which deploy it actually is — see src/version.ts.
export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.0.0'),
    __COMMIT_REF__: JSON.stringify(process.env.COMMIT_REF?.slice(0, 7) ?? 'local'),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __DEPLOY_CONTEXT__: JSON.stringify(process.env.CONTEXT ?? 'dev'),
  },
})
