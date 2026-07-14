import { useState } from 'react'
import { useAuthStore } from '../store/authStore'

export type RecapState = 'idle' | 'loading' | 'ready' | 'unavailable'

// Shared by GameOverScreen (right after a run ends) and the My Runs browser (revisiting any past
// run) — both hit the same netlify/functions/run-summary.mts endpoint the same way. Pass the
// run's already-persisted recap (GameState.recap?.summary) as initialSummary when known, so a
// previously-generated recap renders immediately with no fetch/button at all.
export function useWastelandRecap(gameId: string | null, initialSummary: string | null) {
  const [recapState, setRecapState] = useState<RecapState>(initialSummary ? 'ready' : 'idle')
  const [recapText, setRecapText] = useState<string | null>(initialSummary)
  const accessToken = useAuthStore(s => s.session?.access_token)

  const fetchRecap = async () => {
    if (!accessToken || !gameId) { setRecapState('unavailable'); return }
    setRecapState('loading')
    try {
      const res = await fetch('/.netlify/functions/run-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ gameId }),
      })
      const data = await res.json().catch(() => ({ available: false as const }))
      if (!res.ok || !data.available) { setRecapState('unavailable'); return }
      setRecapText(data.summary)
      setRecapState('ready')
    } catch {
      setRecapState('unavailable')
    }
  }

  return { recapState, recapText, fetchRecap }
}
