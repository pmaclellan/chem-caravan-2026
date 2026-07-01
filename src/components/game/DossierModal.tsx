import { useState } from 'react'
import type { GameState } from '../../types/game'
import { GAME_MODES } from '../../data/modes'
import AchievementsGrid from './AchievementsGrid'
import RunStatsView from './RunStatsView'

type DossierTab = 'stats' | 'achievements'

interface Props {
  gameState: GameState
  onClose: () => void
}

export default function DossierModal({ gameState, onClose }: Props) {
  const [tab, setTab] = useState<DossierTab>('achievements')
  const mc = GAME_MODES[gameState.mode]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div
        className="pip-panel w-full max-w-2xl flex flex-col"
        style={{ height: '82vh' }}
      >
        {/* Header */}
        <div className="flex justify-between items-center flex-shrink-0 mb-3">
          <h2 className="font-display text-2xl text-pip-green tracking-widest">FIELD DOSSIER</h2>
          <button className="pip-btn text-sm px-3 py-1" onClick={onClose}>CLOSE</button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 flex-shrink-0 mb-3 border-b border-pip-border pb-2">
          {(['achievements', 'stats'] as DossierTab[]).map(t => (
            <button
              key={t}
              className={`pip-btn text-xs px-3 py-1 ${tab === t ? 'bg-pip-green text-pip-bg-light' : ''}`}
              onClick={() => setTab(t)}
            >
              {t.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1">
          {tab === 'achievements' && (
            <AchievementsGrid
              earnedAchievements={gameState.earnedAchievements}
              mode={gameState.mode}
            />
          )}
          {tab === 'stats' && (
            <RunStatsView stats={gameState.stats} mc={mc} />
          )}
        </div>
      </div>
    </div>
  )
}
