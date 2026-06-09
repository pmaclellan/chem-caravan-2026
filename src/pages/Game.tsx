import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useGameStore } from '../store/gameStore'
import { GAME_MODES } from '../data/modes'
import { applyMarketEvents } from '../engine/market'
import { useIsMobile } from '../hooks/useIsMobile'
import PlayerStats from '../components/game/PlayerStats'
import MarketPanel from '../components/game/MarketPanel'
import MapPanel from '../components/game/MapPanel'
import CombatPanel from '../components/game/CombatPanel'
import CombatSummaryPanel from '../components/game/CombatSummaryPanel'
import EventPanel from '../components/game/EventPanel'
import ServicesPanel from '../components/game/ServicesPanel'
import InventoryPanel from '../components/game/InventoryPanel'
import GameLog from '../components/game/GameLog'
import TravelSplash from '../components/game/TravelSplash'
import MobileGame from '../components/game/MobileGame'

type ActiveTab = 'market' | 'travel' | 'services'

export default function Game() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { gameState, loadActiveGame, toast, _setToast } = useGameStore()
  const [tab, setTab] = useState<ActiveTab>('market')
  const isMobile = useIsMobile()

  useEffect(() => {
    if (user && !gameState) loadActiveGame(user.id)
  }, [user, gameState, loadActiveGame])

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => _setToast(null), 3000)
      return () => clearTimeout(t)
    }
  }, [toast, _setToast])

  // Switch to market view automatically when arriving at a settlement
  const phase = gameState?.phase
  useEffect(() => {
    if (phase === 'settlement') setTab('market')
  }, [phase, gameState?.player.location])

  if (!gameState) {
    return (
      <div className="min-h-screen flex items-center justify-center text-pip-green font-display text-2xl">
        LOADING GAME DATA...
      </div>
    )
  }

  const { player, world, pendingEvent, pendingQuote, pendingDestination, combat, log } = gameState
  const mc = GAME_MODES[gameState.mode]
  const settlement = mc.settlements[player.location]
  const rawMarket = world.settlements[player.location]
  const market = rawMarket ? applyMarketEvents(rawMarket, world.activeMarketEvents, player.location) : { prices: {}, stock: {}, lastRefreshed: 0 }

  if (phase === 'game_over') {
    return <GameOverScreen gameState={gameState} onHome={() => navigate('/')} />
  }

  if (isMobile) return <MobileGame />

  const isActionBlocked = phase === 'event' || phase === 'combat' || phase === 'combat_summary' || phase === 'traveling'
  const mainContent = () => {
    if (phase === 'traveling' && pendingDestination) {
      return <TravelSplash quote={pendingQuote} destination={pendingDestination} />
    }
    if (phase === 'combat' && combat) return <CombatPanel player={player} combat={combat} />
    if (phase === 'combat_summary' && combat) return <CombatSummaryPanel combat={combat} />
    if (phase === 'event' && pendingEvent) return <EventPanel event={pendingEvent} player={player} />
    switch (tab) {
      case 'market':   return <MarketPanel player={player} market={market} />
      case 'travel':   return <MapPanel player={player} />
      case 'services': return <ServicesPanel player={player} />
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-pip-bg p-2 gap-2" data-mode={gameState.mode}>
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
        <div className="flex-1 flex flex-col gap-2 min-w-0 relative">
          {/* Settlement background image — behind all panels */}
          {!isActionBlocked && settlement.imageUrl && (
            <>
              <img
                src={settlement.imageUrl}
                alt=""
                className="absolute inset-0 w-full h-full object-cover pointer-events-none rounded"
                style={{ opacity: 0.52 }}
              />
              {/* Gradient darkens the bottom so parchment panels stay readable */}
              <div
                className="absolute inset-0 pointer-events-none rounded"
                style={{ background: 'linear-gradient(to bottom, transparent 0%, transparent 75%, rgba(192,168,90,0.65) 90%, rgba(192,168,90,0.92) 100%)' }}
              />
            </>
          )}

          {/* Settlement header */}
          {!isActionBlocked && (
            <div className="pip-panel py-2 px-3 relative">
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
            <div className="flex gap-2 relative">
              {(['market', 'travel', 'services'] as ActiveTab[]).map(t => (
                <button
                  key={t}
                  className={tab === t ? 'pip-btn bg-pip-green text-pip-bg-light' : 'pip-btn'}
                  onClick={() => setTab(t)}
                >
                  {t.toUpperCase()}
                </button>
              ))}
            </div>
          )}

          {/* Main panel
               - Travel map + combat + transit splash: fill remaining height so content has room
               - Market + services: size to content so settlement image shows below */}
          {(() => {
            const fillHeight =
              (tab === 'travel' && !isActionBlocked) ||
              phase === 'combat' ||
              phase === 'combat_summary' ||
              phase === 'traveling'
            return (
              <div className={`pip-panel relative ${
                fillHeight
                  ? 'flex-1 min-h-0 overflow-hidden flex flex-col'
                  : 'overflow-y-auto'
              }`}>
                {mainContent()}
              </div>
            )
          })()}
        </div>

        {/* Right: Inventory + Log — explicit height pins the column so log growth
            doesn't push the layout; log gets remaining space with overflow scroll */}
        <div className="w-64 flex-shrink-0 flex flex-col gap-2 overflow-hidden"
          style={{ height: 'calc(100vh - 80px)' }}>
          <div className="overflow-y-auto flex-shrink-0" style={{ maxHeight: '42%' }}>
            <InventoryPanel player={player} market={market} />
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto">
            <GameLog log={log} />
          </div>
        </div>
      </div>
    </div>
  )
}

function GameOverScreen({ gameState, onHome }: { gameState: import('../types/game').GameState; onHome: () => void }) {
  const { player, gameOverReason, endReason, log } = gameState
  const score = player.caps + player.bank - player.debt
  const isWin = gameOverReason === 'turns'
  const [logOpen, setLogOpen] = useState(false)

  const subtitle = endReason ?? (
    gameOverReason === 'turns'   ? 'Time ran out on your caravan run.' :
    gameOverReason === 'combat'  ? 'You were killed on the road.' :
    gameOverReason === 'debt'    ? 'Your debtors finally caught up with you.' :
    'Game ended.'
  )

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-pip-bg" data-mode={gameState.mode}>
      <div className="pip-panel max-w-md w-full text-center space-y-4">
        <div className={`font-display text-5xl ${isWin ? 'text-pip-amber' : 'text-pip-red'}`}>
          {isWin ? 'GAME OVER' : 'YOU DIED'}
        </div>
        <div className="text-pip-green-dim text-sm">{subtitle}</div>

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

        <button
          className="pip-btn w-full text-sm"
          onClick={() => setLogOpen(o => !o)}
        >
          {logOpen ? 'HIDE RUN LOG ▲' : `VIEW RUN LOG (${log.length} entries) ▼`}
        </button>

        {logOpen && (
          <div className="border border-pip-border rounded text-left max-h-72 overflow-y-auto">
            <div className="text-xs font-mono space-y-0.5 p-2">
              {log.map((entry, i) => (
                <div key={i} className={`log-${entry.type}`}>
                  <span className="text-pip-green-dim">[T{String(entry.turn).padStart(2, '0')}]</span>{' '}
                  {entry.message}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
