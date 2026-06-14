import { useState, useEffect } from 'react'
import pkg from '../../package.json'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useGameStore } from '../store/gameStore'
import { GAME_MODES } from '../data/modes'
import type { GameModeId } from '../types/game'
import AuthModal from '../components/auth/AuthModal'
import { HowToPlay } from '../components/ui/HowToPlay'

const MODE_IDS: GameModeId[] = ['commonwealth', 'capital_wasteland', 'mojave_wasteland']
const DIFFICULTY_LABEL: Record<GameModeId, string> = {
  commonwealth:      'EASY',
  capital_wasteland: 'MEDIUM',
  mojave_wasteland:  'HARD',
}
const DIFFICULTY_COLOR: Record<GameModeId, string> = {
  commonwealth:      'text-pip-green',
  capital_wasteland: 'text-pip-amber',
  mojave_wasteland:  'text-pip-red',
}

export default function Home() {
  const navigate  = useNavigate()
  const { user, signOut } = useAuthStore()
  const store     = useGameStore()
  const { activeGameSummaries, loadActiveGames, startNewGame, loadGameById, clearGame } = store

  const [showAuth,     setShowAuth]     = useState(false)
  const [showTutorial, setShowTutorial] = useState(false)
  const [selectedMode, setSelectedMode] = useState<GameModeId>('commonwealth')
  const [charName,     setCharName]     = useState('')
  const [showNewGame,  setShowNewGame]  = useState(false)
  const [confirmAbandon, setConfirmAbandon] = useState(false)
  const [starting,     setStarting]     = useState(false)

  useEffect(() => {
    if (user) loadActiveGames(user.id)
  }, [user, loadActiveGames])

  async function handleContinue(gameId: string) {
    await loadGameById(gameId)
    navigate('/game')
  }

  async function handleStartNew() {
    if (!user || !charName.trim()) return
    setStarting(true)
    clearGame()
    await startNewGame(charName.trim(), user.id, selectedMode)
    navigate('/game')
  }

  function requestNewGame(modeId: GameModeId) {
    setSelectedMode(modeId)
    const existing = activeGameSummaries?.[modeId]
    if (existing) {
      setConfirmAbandon(true)
    } else {
      setShowNewGame(true)
    }
    setCharName('')
  }

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center p-4 transition-colors duration-300 overflow-hidden" data-mode={selectedMode}>
      {/* Background image — portrait version on narrow viewports */}
      <picture className="absolute inset-0 w-full h-full">
        <source media="(max-width: 639px)" srcSet="/assets/main_menu_background_mobile.png" />
        <img src="/assets/main_menu_background.png" alt="" className="w-full h-full object-cover object-center" />
      </picture>
      {/* Tint overlay for readability */}
      <div className="absolute inset-0 bg-pip-bg opacity-60" />

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      {showTutorial && <HowToPlay onClose={() => setShowTutorial(false)} />}

      <div className="relative max-w-2xl w-full pip-panel">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="font-display text-6xl text-pip-green tracking-widest mb-1">
            CHEM CARAVAN
          </h1>
          <div className="text-pip-green-dim text-xs font-mono">
            WASTELAND TRADING SIMULATION v{pkg.version}
          </div>
        </div>

        {!user ? (
          /* ── Logged out ─────────────────────────────────────────────────── */
          <div className="space-y-3">
            <button className="pip-btn w-full text-xl" onClick={() => setShowAuth(true)}>
              ENTER THE WASTELAND
            </button>
            <div className="flex gap-2">
              <button className="pip-btn flex-1" onClick={() => navigate('/leaderboard')}>
                LEADERBOARD
              </button>
              <button className="pip-btn flex-1" onClick={() => navigate('/how-to-play')}>
                HOW TO PLAY
              </button>
            </div>
          </div>
        ) : (
          /* ── Logged in ──────────────────────────────────────────────────── */
          <div className="space-y-5">

            {/* Mode cards */}
            <div>
              <div className="pip-label mb-3">Select Region</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {MODE_IDS.map(modeId => {
                  const mc       = GAME_MODES[modeId]
                  const summary  = activeGameSummaries?.[modeId]
                  const isActive = selectedMode === modeId

                  return (
                    <div
                      key={modeId}
                      onClick={() => setSelectedMode(modeId)}
                      className={`border rounded p-3 cursor-pointer transition-colors duration-100 ${
                        isActive
                          ? 'border-pip-amber bg-pip-bg'
                          : 'border-pip-border hover:border-pip-green'
                      }`}
                    >
                      <div className="font-display text-pip-green text-lg leading-tight">{mc.name}</div>
                      <div className="text-pip-green-dim text-xs mb-2">{mc.subtitle}</div>
                      <div className={`font-display text-xs tracking-widest ${DIFFICULTY_COLOR[modeId]}`}>
                        {DIFFICULTY_LABEL[modeId]}
                      </div>

                      {summary ? (
                        <div className="mt-2 pt-2 border-t border-pip-border-dim text-xs">
                          <div className="text-pip-green font-display">{summary.characterName}</div>
                          <div className="text-pip-green-dim">Turn {summary.turn}/30</div>
                        </div>
                      ) : (
                        <div className="mt-2 pt-2 border-t border-pip-border-dim text-xs text-pip-green-dim">
                          No active run
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Action buttons for selected mode */}
            <div className="space-y-2">
              {activeGameSummaries?.[selectedMode] && !showNewGame && !confirmAbandon && (
                <button
                  className="pip-btn w-full text-xl"
                  onClick={() => handleContinue(activeGameSummaries[selectedMode]!.id)}
                >
                  CONTINUE — {GAME_MODES[selectedMode].name} (T{activeGameSummaries[selectedMode]!.turn})
                </button>
              )}

              {confirmAbandon && (
                <div className="border border-pip-red rounded p-3 space-y-2">
                  <div className="text-pip-red text-sm font-display">
                    ABANDON active run as {activeGameSummaries?.[selectedMode]?.characterName}?
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="pip-btn-danger flex-1"
                      onClick={() => { setConfirmAbandon(false); setShowNewGame(true) }}
                    >
                      ABANDON & START NEW
                    </button>
                    <button className="pip-btn flex-1" onClick={() => setConfirmAbandon(false)}>
                      CANCEL
                    </button>
                  </div>
                </div>
              )}

              {showNewGame ? (
                <div className="space-y-2">
                  <div>
                    <label className="pip-label block mb-1">
                      Character Name — {GAME_MODES[selectedMode].name}
                    </label>
                    <input
                      type="text"
                      maxLength={30}
                      value={charName}
                      onChange={e => setCharName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleStartNew()}
                      className="pip-input w-full"
                      placeholder="Enter your name, Wanderer"
                      autoFocus
                    />
                  </div>
                  <button
                    className="pip-btn w-full text-xl"
                    disabled={!charName.trim() || starting}
                    onClick={handleStartNew}
                  >
                    {starting ? 'LOADING...' : 'START CARAVAN'}
                  </button>
                  <button className="pip-btn w-full text-sm" onClick={() => setShowNewGame(false)}>
                    CANCEL
                  </button>
                </div>
              ) : !confirmAbandon && (
                <button
                  className="pip-btn w-full"
                  onClick={() => requestNewGame(selectedMode)}
                >
                  {activeGameSummaries?.[selectedMode] ? 'ABANDON & NEW GAME' : 'NEW GAME'}
                </button>
              )}
            </div>

            {/* Footer links */}
            <div className="flex gap-2 flex-wrap pt-1">
              <button className="pip-btn flex-1" onClick={() => navigate('/leaderboard')}>LEADERBOARD</button>
              <button className="pip-btn flex-1" onClick={() => setShowTutorial(true)}>HOW TO PLAY</button>
              <button
                className="pip-btn text-sm text-pip-green-dim px-3"
                onClick={() => signOut()}
              >
                SIGN OUT
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
