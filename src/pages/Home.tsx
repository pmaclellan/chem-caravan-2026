import { useState, useEffect } from 'react'
import pkg from '../../package.json'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useGameStore } from '../store/gameStore'
import { supabase } from '../lib/supabase'
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
  const { activeGameSummaries, freePlaySummary, loadActiveGames, startNewGame, loadGameById, clearGame } = store

  const [showAuth,     setShowAuth]     = useState(false)
  const [showTutorial, setShowTutorial] = useState(false)
  const [selectedMode, setSelectedMode] = useState<GameModeId>('commonwealth')
  const [charName,     setCharName]     = useState('')
  const [showNewGame,  setShowNewGame]  = useState(false)
  const [confirmAbandon, setConfirmAbandon] = useState(false)
  const [starting,     setStarting]     = useState(false)

  // Free Play state
  const [freePlayUnlocked, setFreePlayUnlocked] = useState(false)
  const [showFreePlayNew,  setShowFreePlayNew]  = useState(false)
  const [freePlayMode,     setFreePlayMode]     = useState<GameModeId>('commonwealth')
  const [freePlayName,     setFreePlayName]     = useState('')
  const [freePlayStarting, setFreePlayStarting] = useState(false)

  useEffect(() => {
    if (user) loadActiveGames(user.id)
  }, [user, loadActiveGames])

  // Check if free play is unlocked (won at least one game in each of the 3 modes)
  useEffect(() => {
    if (!user) return
    async function checkUnlock() {
      // status='won' only exists on standard games — free play always ends dead/bankrupt.
      // No game_type filter needed, and avoids a dependency on migration 005 being applied.
      const { data } = await supabase
        .from('games')
        .select('mode')
        .eq('user_id', user!.id)
        .eq('status', 'won')
      if (!data) return
      const wonModes = new Set(data.map((r: { mode: string | null }) => r.mode).filter(Boolean))
      setFreePlayUnlocked(
        wonModes.has('commonwealth') &&
        wonModes.has('capital_wasteland') &&
        wonModes.has('mojave_wasteland')
      )
    }
    checkUnlock()
  }, [user])

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

  async function handleStartFreePlay() {
    if (!user || !freePlayName.trim()) return
    setFreePlayStarting(true)
    clearGame()
    await startNewGame(freePlayName.trim(), user.id, freePlayMode, 'free_play')
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
      <div className="absolute inset-0">
        <picture>
          <source media="(max-width: 639px)" srcSet="/assets/main_menu_background_mobile.png" />
          <img src="/assets/main_menu_background.png" alt="" className="w-full h-full object-cover object-center" />
        </picture>
      </div>
      {/* Mode-tinted color wash — sits on top of image so mode changes are visible */}
      <div className="absolute inset-0 bg-pip-bg opacity-30" />

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      {showTutorial && <HowToPlay onClose={() => setShowTutorial(false)} />}

      <div className="relative max-w-2xl w-full pip-panel" style={{ backgroundColor: 'color-mix(in srgb, var(--pip-bg-light) 75%, transparent)' }}>
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

            {/* Free Play */}
            <div className="border-t border-pip-border pt-4">
              <div className="flex justify-between items-center mb-2">
                <div className="pip-label tracking-widest">FREE PLAY</div>
                {freePlayUnlocked && (
                  <span className="text-pip-green-dim text-xs">No turn limit · danger scales with time</span>
                )}
              </div>

              {!freePlayUnlocked ? (
                <div className="border border-pip-border-dim rounded p-3 text-center opacity-60">
                  <div className="text-pip-green-dim text-sm">Complete all 3 difficulties to unlock</div>
                </div>
              ) : showFreePlayNew ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    {MODE_IDS.map(id => (
                      <button
                        key={id}
                        onClick={() => setFreePlayMode(id)}
                        className={`pip-btn flex-1 text-xs ${freePlayMode === id ? 'bg-pip-green text-pip-bg-light' : ''}`}
                      >
                        {GAME_MODES[id].name.split(' ')[0].toUpperCase()}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    maxLength={30}
                    value={freePlayName}
                    onChange={e => setFreePlayName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleStartFreePlay()}
                    className="pip-input w-full"
                    placeholder="Enter your name, Wanderer"
                    autoFocus
                  />
                  <button
                    className="pip-btn w-full"
                    disabled={!freePlayName.trim() || freePlayStarting}
                    onClick={handleStartFreePlay}
                  >
                    {freePlayStarting ? 'LOADING...' : 'START FREE PLAY'}
                  </button>
                  <button className="pip-btn w-full text-sm" onClick={() => setShowFreePlayNew(false)}>
                    CANCEL
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {freePlaySummary && (
                    <button
                      className="pip-btn w-full"
                      onClick={() => handleContinue(freePlaySummary.id)}
                    >
                      CONTINUE FREE PLAY — {GAME_MODES[freePlaySummary.modeId].name.split(' ')[0]} (T{freePlaySummary.turn})
                    </button>
                  )}
                  <button
                    className="pip-btn w-full"
                    onClick={() => { setShowFreePlayNew(true); setFreePlayName('') }}
                  >
                    {freePlaySummary ? 'ABANDON & NEW FREE PLAY' : 'START FREE PLAY'}
                  </button>
                </div>
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

        <div className="text-center mt-4 text-pip-green-dim text-xs font-mono">
          WASTELAND TRADING SIMULATION v{pkg.version}
        </div>
      </div>
    </div>
  )
}
