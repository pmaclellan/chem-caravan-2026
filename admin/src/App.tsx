import { useEffect, useState } from 'react'
import type { GameRow } from '@main/types/game'
import { normalizeState } from '@main/engine/normalizeState'
import { supabaseAdmin } from './lib/supabaseAdmin'
import RunPicker from './components/RunPicker'
import RunDetailTabs from './components/RunDetailTabs'
import MapHeatmap from './components/MapHeatmap'

type TopView = 'runs' | 'heatmap'

export default function App() {
  const [topView, setTopView] = useState<TopView>('runs')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [row, setRow] = useState<GameRow | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedId) { setRow(null); return }
    let cancelled = false
    setRow(null)
    setLoadError(null)
    supabaseAdmin
      .from('games')
      .select('*')
      .eq('id', selectedId)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error || !data) { setLoadError(error?.message ?? 'Run not found'); return }
        setRow(data as GameRow)
      })
    return () => { cancelled = true }
  }, [selectedId])

  const normalized = row ? normalizeState(row.state) : null

  return (
    <div data-mode={normalized?.mode ?? 'commonwealth'} className="min-h-screen flex flex-col bg-pip-bg text-pip-green">
      <header className="flex items-center justify-between px-4 py-2 border-b border-pip-border">
        <div className="font-display text-xl text-pip-amber">CHEM CARAVAN — RUN HISTORY (LOCAL)</div>
        <nav className="flex gap-2">
          <button
            className={`pip-btn text-xs py-1 px-3 ${topView === 'runs' ? 'brightness-125' : ''}`}
            onClick={() => setTopView('runs')}
          >
            RUNS
          </button>
          <button
            className={`pip-btn text-xs py-1 px-3 ${topView === 'heatmap' ? 'brightness-125' : ''}`}
            onClick={() => setTopView('heatmap')}
          >
            MAP HEATMAP
          </button>
        </nav>
      </header>

      {topView === 'heatmap' && (
        <div className="flex-1 p-4 min-h-0">
          <MapHeatmap />
        </div>
      )}

      {topView === 'runs' && (
        <div className="flex-1 grid grid-cols-[320px_1fr] gap-4 p-4 min-h-0">
          <div className="min-h-0">
            <RunPicker selectedId={selectedId} onSelect={setSelectedId} />
          </div>
          <div className="min-h-0">
            {!selectedId && <div className="pip-panel text-sm text-pip-green-dim">Select a run on the left.</div>}
            {selectedId && loadError && <div className="pip-panel text-sm text-pip-red">Failed to load run: {loadError}</div>}
            {selectedId && !row && !loadError && <div className="pip-panel text-sm text-pip-green-dim">Loading run…</div>}
            {row && normalized && <RunDetailTabs row={row} gameState={normalized} />}
          </div>
        </div>
      )}
    </div>
  )
}
