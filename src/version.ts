export const APP_VERSION = __APP_VERSION__
export const COMMIT_REF = __COMMIT_REF__
export const BUILD_TIME = __BUILD_TIME__
export const DEPLOY_CONTEXT = __DEPLOY_CONTEXT__

// "v1.1.1 · a3f8c21 · Jul 8, 14:32" — commit ref makes each build unique even
// between same-version patches; the timestamp is what actually answers "is
// this a fresh deploy" at a glance.
export function formatBuildTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export const VERSION_STRING = `v${APP_VERSION} · ${COMMIT_REF} · ${formatBuildTime(BUILD_TIME)}`
