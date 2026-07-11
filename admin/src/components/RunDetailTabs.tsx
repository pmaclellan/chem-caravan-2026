import { useState } from 'react'
import type { CombatReplay, GameRow, GameState } from '@main/types/game'
import TurnStepper from './TurnStepper'
import AnalyticsDashboard from './AnalyticsDashboard'
import CombatReplayViewer from './CombatReplayViewer'

type Tab = 'turns' | 'analytics'

interface Props {
  row: GameRow
  gameState: GameState
}

export default function RunDetailTabs({ row, gameState }: Props) {
  const [tab, setTab] = useState<Tab>('turns')
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
          <button className={`pip-btn text-xs py-1 px-3 ${tab === 'turns' ? 'brightness-125' : ''}`} onClick={() => setTab('turns')}>TURNS</button>
          <button className={`pip-btn text-xs py-1 px-3 ${tab === 'analytics' ? 'brightness-125' : ''}`} onClick={() => setTab('analytics')}>ANALYTICS</button>
        </nav>
      </div>

      <div className="flex-1 min-h-0">
        {tab === 'turns' && <TurnStepper gameState={gameState} onViewCombat={setViewingCombat} />}
        {tab === 'analytics' && <AnalyticsDashboard gameState={gameState} />}
      </div>
    </div>
  )
}
