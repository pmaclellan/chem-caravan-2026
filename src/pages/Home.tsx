import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useGameStore } from '../store/gameStore'
import AuthModal from '../components/auth/AuthModal'

export default function Home() {
  const navigate = useNavigate()
  const { user, signOut } = useAuthStore()
  const { gameState, loadActiveGame, startNewGame, clearGame } = useGameStore()
  const [showAuth, setShowAuth] = useState(false)
  const [charName, setCharName] = useState('')
  const [showNewGame, setShowNewGame] = useState(false)
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    if (user) loadActiveGame(user.id)
  }, [user, loadActiveGame])

  async function handleNewGame() {
    if (!user || !charName.trim()) return
    setStarting(true)
    await startNewGame(charName.trim(), user.id)
    navigate('/game')
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}

      <div className="max-w-lg w-full pip-panel text-center">
        <h1 className="font-display text-6xl text-pip-green mb-2 tracking-widest">
          CHEM CARAVAN
        </h1>
        <div className="text-pip-green-dim text-sm mb-6 font-mono">
          COMMONWEALTH TRADING SIMULATION v1.0
        </div>

        <div className="border-t border-pip-border pt-4 mb-6 text-xs text-pip-green-dim font-mono leading-relaxed">
          You have 31 turns to trade chems across the Commonwealth, repay your debt,
          and walk away richer than you started. Or die trying.
        </div>

        {!user ? (
          <div className="space-y-3">
            <button className="pip-btn w-full text-xl" onClick={() => setShowAuth(true)}>
              ENTER THE WASTELAND
            </button>
            <button className="pip-btn w-full" onClick={() => navigate('/leaderboard')}>
              LEADERBOARD
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {gameState && gameState.phase !== 'game_over' ? (
              <button className="pip-btn w-full text-xl" onClick={() => navigate('/game')}>
                CONTINUE GAME (Turn {gameState.world.turn}/{gameState.world.maxTurns})
              </button>
            ) : null}

            {!showNewGame ? (
              <button
                className="pip-btn w-full"
                onClick={() => { setShowNewGame(true); clearGame() }}
              >
                {gameState ? 'ABANDON & NEW GAME' : 'NEW GAME'}
              </button>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="pip-label block mb-1">Character Name</label>
                  <input
                    type="text"
                    maxLength={30}
                    value={charName}
                    onChange={e => setCharName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleNewGame()}
                    className="pip-input w-full"
                    placeholder="Enter your name, Wanderer"
                    autoFocus
                  />
                </div>
                <button
                  className="pip-btn w-full text-xl"
                  disabled={!charName.trim() || starting}
                  onClick={handleNewGame}
                >
                  {starting ? 'LOADING...' : 'START CARAVAN'}
                </button>
                <button className="pip-btn w-full text-sm" onClick={() => setShowNewGame(false)}>CANCEL</button>
              </div>
            )}

            <button className="pip-btn w-full" onClick={() => navigate('/leaderboard')}>
              LEADERBOARD
            </button>
            <button className="pip-btn w-full text-sm text-pip-green-dim" onClick={() => signOut()}>
              SIGN OUT ({user.email})
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
