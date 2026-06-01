import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useGameStore } from '../store/gameStore'
import { SETTLEMENTS } from '../data/settlements'
import { applyMarketEvents } from '../engine/market'
import PlayerStats from '../components/game/PlayerStats'
import MarketPanel from '../components/game/MarketPanel'
import TravelPanel from '../components/game/TravelPanel'
import CombatPanel from '../components/game/CombatPanel'
import EventPanel from '../components/game/EventPanel'
import ServicesPanel from '../components/game/ServicesPanel'
import InventoryPanel from '../components/game/InventoryPanel'
import GameLog from '../components/game/GameLog'

type ActiveTab = 'market' | 'travel' | 'services'

export default function Game() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { gameState, loadActiveGame, toast, _setToast } = useGameStore()
  const [tab, setTab] = useState<ActiveTab>('market')

  useEffect(() => {
    if (user && !gameState) loadActiveGame(user.id)
  }, [user, gameState, loadActiveGame])

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => _setToast(null), 3000)
      return () => clearTimeout(t)
    }
  }, [toast, _setToast])

  if (!gameState) {
    return (
      <div className="min-h-screen flex items-center justify-center text-pip-green font-display text-2xl">
        LOADING GAME DATA...
      </div>
    )
  }

  const { player, world, phase, pendingEvent, combat, log } = gameState
  const settlement = SETTLEMENTS[player.location]
  const rawMarket = world.settlements[player.location]
  const market = rawMarket ? applyMarketEvents(rawMarket, world.activeMarketEvents, player.location) : { prices: {}, stock: {}, lastRefreshed: 0 }

  if (phase === 'game_over') {
    return <GameOverScreen gameState={gameState} onHome={() => navigate('/')} />
  }

  const isActionBlocked = phase === 'event' || phase === 'combat' || phase === 'traveling'
  const mainContent = () => {
    if (phase === 'combat' && combat) return <CombatPanel player={player} combat={combat} />
    if ((phase === 'event' || phase === 'traveling') && pendingEvent) return <EventPanel event={pendingEvent} player={player} />
    switch (tab) {
      case 'market':   return <MarketPanel player={player} market={market} />
      case 'travel':   return <TravelPanel player={player} />
      case 'services': return <ServicesPanel player={player} />
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-pip-bg p-2 gap-2">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-pip-red text-pip-bg font-display text-lg px-6 py-2 rounded border border-pip-red">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center border-b border-pip-border pb-2 px-2">
        <span className="font-display text-pip-green text-2xl tracking-widest">CHEM CARAVAN</span>
        <div className="flex gap-3 items-center">
          {world.activeMarketEvents.length > 0 && (
            <div className="text-pip-amber text-xs font-mono animate-pulse">
              {world.activeMarketEvents.length} MARKET EVENT{world.activeMarketEvents.length > 1 ? 'S' : ''} ACTIVE
            </div>
          )}
          <button className="pip-btn text-xs" onClick={() => navigate('/')}>MENU</button>
        </div>
      </div>

      {/* Three-panel layout */}
      <div className="flex gap-2 flex-1 min-h-0" style={{ height: 'calc(100vh - 80px)' }}>
        {/* Left: Player Stats */}
        <div className="w-52 flex-shrink-0 overflow-y-auto">
          <PlayerStats player={player} turn={world.turn} maxTurns={world.maxTurns} />
        </div>

        {/* Center: Main action */}
        <div className="flex-1 flex flex-col gap-2 min-w-0">
          {/* Settlement header */}
          {!isActionBlocked && (
            <div className="pip-panel py-2 px-3">
              <div className="flex justify-between items-center">
                <div>
                  <span className="font-display text-pip-green text-xl">{settlement.name}</span>
                  <span className="text-pip-green-dim text-xs ml-2">{settlement.faction}</span>
                </div>
                <div className="text-pip-green-dim text-xs text-right">{settlement.description}</div>
              </div>
            </div>
          )}

          {/* Tab bar (only when at settlement) */}
          {!isActionBlocked && (
            <div className="flex gap-2">
              {(['market', 'travel', 'services'] as ActiveTab[]).map(t => (
                <button
                  key={t}
                  className={tab === t ? 'pip-btn bg-pip-green text-pip-bg' : 'pip-btn'}
                  onClick={() => setTab(t)}
                >
                  {t.toUpperCase()}
                </button>
              ))}
            </div>
          )}

          {/* Main panel */}
          <div className="pip-panel flex-1 overflow-y-auto">
            {mainContent()}
          </div>
        </div>

        {/* Right: Inventory + Log */}
        <div className="w-64 flex-shrink-0 flex flex-col gap-2 min-h-0">
          <div className="flex-1 overflow-y-auto" style={{ maxHeight: '45%' }}>
            <InventoryPanel player={player} market={market} />
          </div>
          <div className="flex-1 overflow-y-auto" style={{ maxHeight: '55%' }}>
            <GameLog log={log} />
          </div>
        </div>
      </div>
    </div>
  )
}

function GameOverScreen({ gameState, onHome }: { gameState: import('../types/game').GameState; onHome: () => void }) {
  const { player, gameOverReason } = gameState
  const score = player.caps + player.bank - player.debt
  const isWin = gameOverReason === 'turns'

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="pip-panel max-w-md w-full text-center space-y-4">
        <div className={`font-display text-5xl ${isWin ? 'text-pip-amber' : 'text-pip-red'}`}>
          {isWin ? 'GAME OVER' : 'YOU DIED'}
        </div>
        <div className="text-pip-green-dim text-sm">
          {gameOverReason === 'turns' && "Time ran out on your caravan run."}
          {gameOverReason === 'combat' && "You were killed by Raiders on the road."}
          {gameOverReason === 'debt' && "Your debtors finally caught up with you."}
          {gameOverReason === 'bankrupt' && "Game ended."}
        </div>

        <div className="border border-pip-border rounded p-4 space-y-2 text-left">
          <div className="flex justify-between">
            <span className="pip-label">Character</span>
            <span className="text-pip-green">{player.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="pip-label">Caps on hand</span>
            <span className="text-pip-green">{player.caps.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="pip-label">In bank</span>
            <span className="text-pip-green">{player.bank.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="pip-label">Debt owed</span>
            <span className="text-pip-red">-{player.debt.toLocaleString()}</span>
          </div>
          <div className="flex justify-between border-t border-pip-border pt-2">
            <span className="pip-label">FINAL SCORE</span>
            <span className={`font-display text-2xl ${score >= 0 ? 'text-pip-amber' : 'text-pip-red'}`}>
              {score.toLocaleString()} ¤
            </span>
          </div>
        </div>

        <div className="flex gap-3">
          <button className="pip-btn flex-1" onClick={onHome}>MAIN MENU</button>
          <button className="pip-btn flex-1" onClick={() => window.location.href = '/leaderboard'}>LEADERBOARD</button>
        </div>
      </div>
    </div>
  )
}
