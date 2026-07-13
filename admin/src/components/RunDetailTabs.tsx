import { useState } from 'react'
import type { CombatReplay, GameRow, GameState } from '@main/types/game'
import TurnStepper from './TurnStepper'
import AnalyticsDashboard from './AnalyticsDashboard'
import CombatReplayViewer from './CombatReplayViewer'
import RunInsights from './RunInsights'
import MapHeatmap from './MapHeatmap'

export type Tab = 'turns' | 'analytics' | 'insights' | 'heatmap'

interface Props {
  row: GameRow
  gameState: GameState
  // Lifted to the parent (rather than local useState) so the active tab survives switching
  // between runs — RunDetailTabs unmounts while the next run's data is loading, which would
  // otherwise reset a local tab selection back to 'turns' every time.
  tab: Tab
  onTabChange: (tab: Tab) => void
}

export default function RunDetailTabs({ row, gameState, tab, onTabChange }: Props) {
  const [viewingCombat, setViewingCombat] = useState<CombatReplay | null>(null)

  if (viewingCombat) {
    return (
      <CombatReplayViewer
        replay={viewingCombat}
        onBack={() => setViewingCombat(null)}
      />
    )
  }

  return (
    <div className="pip-panel flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between border-b border-pip-border pb-2 mb-2">
        <div>
          <div className="font-display text-lg text-pip-amber">{row.character_name}</div>
          <div className="text-[10px] font-mono text-pip-green-dim">
            {gameState.mode} · {gameState.gameType} · {row.status} · turn {gameState.world.turn}
          </div>
        </div>
        <nav className="flex gap-2">
          <button className={`pip-btn text-xs py-1 px-3 ${tab === 'turns' ? 'brightness-125' : ''}`} onClick={() => onTabChange('turns')}>TURNS</button>
          <button className={`pip-btn text-xs py-1 px-3 ${tab === 'analytics' ? 'brightness-125' : ''}`} onClick={() => onTabChange('analytics')}>ANALYTICS</button>
          <button className={`pip-btn text-xs py-1 px-3 ${tab === 'insights' ? 'brightness-125' : ''}`} onClick={() => onTabChange('insights')}>INSIGHTS</button>
          <button className={`pip-btn text-xs py-1 px-3 ${tab === 'heatmap' ? 'brightness-125' : ''}`} onClick={() => onTabChange('heatmap')}>HEATMAP</button>
        </nav>
      </div>

      <div className="flex-1 min-h-0">
        {tab === 'turns' && <TurnStepper gameState={gameState} onViewCombat={setViewingCombat} />}
        {tab === 'analytics' && <AnalyticsDashboard gameState={gameState} />}
        {tab === 'insights' && <RunInsights row={row} gameState={gameState} />}
        {tab === 'heatmap' && <MapHeatmap focusUserId={row.user_id} focusRunId={row.id} focusMode={gameState.mode} />}
      </div>
    </div>
  )
}
