import { isRouteErrorResponse, useRouteError } from 'react-router-dom'

// Wired up as the router's errorElement (see App.tsx) — replaces React Router's default
// raw stack-trace dump with something on-theme. Uses a real page navigation for "back to
// menu" rather than useNavigate(), since the router itself may be the thing that broke.
export default function RouteErrorBoundary() {
  const error = useRouteError()

  let message = 'An unexpected error occurred.'
  if (isRouteErrorResponse(error)) {
    message = `${error.status} ${error.statusText}`
  } else if (error instanceof Error) {
    message = error.message
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="pip-panel max-w-md w-full text-center">
        <div className="font-display text-2xl text-pip-red mb-2">SIGNAL LOST</div>
        <p className="text-pip-green-dim text-sm mb-4">
          Something broke while rendering this screen. Your run is saved server-side, so a
          reload should bring you right back — if the trouble was a bad save, reloading also
          gives the game a chance to repair it automatically.
        </p>
        <div className="flex gap-3 justify-center mb-4">
          <button className="pip-btn" onClick={() => window.location.reload()}>RELOAD</button>
          <a className="pip-btn-amber inline-block" href="/">BACK TO MENU</a>
        </div>
        <details className="text-left">
          <summary className="text-pip-green-dim text-xs cursor-pointer">Technical details</summary>
          <pre className="text-pip-green-dim text-xs mt-2 whitespace-pre-wrap break-words">{message}</pre>
        </details>
      </div>
    </div>
  )
}
