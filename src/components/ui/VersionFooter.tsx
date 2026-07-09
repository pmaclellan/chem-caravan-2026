import { VERSION_STRING, DEPLOY_CONTEXT } from '../../version'

// Subtle, always-on build stamp so a refresh can confirm "yes, this is the
// deploy I just pushed" without checking the Netlify dashboard. Desktop only —
// mobile shows the same info in the Player tab instead (no room to spare here).
export function VersionFooter() {
  return (
    <div
      className="hidden md:block fixed bottom-1 right-2 z-40 font-mono text-[10px] tracking-wide pointer-events-none select-none"
      style={{ color: 'var(--pip-green-dim)', opacity: 0.45 }}
      title={`Deploy context: ${DEPLOY_CONTEXT}`}
    >
      {VERSION_STRING}
    </div>
  )
}
