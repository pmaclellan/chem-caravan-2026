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
  const { activeGameSummaries, freePlaySummaries, loadActiveGames, startNewGame, loadGameById, clearGame } = store

  const [showAuth,       setShowAuth]       = useState(false)
  const [showTutorial,   setShowTutorial]   = useState(false)
  const [selectedMode,   setSelectedMode]   = useState<GameModeId>('commonwealth')
  const [gameType,       setGameType]       = useState<'standard' | 'free_play'>('standard')
  const [charName,       setCharName]       = useState('')
  const [showNewGame,    setShowNewGame]    = useState(false)
  const [confirmAbandon, setConfirmAbandon] = useState(false)
  const [starting,       setStarting]       = useState(false)
  const [unlockedFreePlayModes, setUnlockedFreePlayModes] = useState<Set<GameModeId>>(new Set())

  useEffect(() => {
    if (user) loadActiveGames(user.id)
  }, [user, loadActiveGames])

  useEffect(() => {
    if (!user) return
    async function checkUnlock() {
      const { data } = await supabase
        .from('games')
        .select('mode')
        .eq('user_id', user!.id)
        .eq('status', 'won')
        .eq('game_type', 'standard')
      if (!data) return
      const wonModes = new Set(
        data.map((r: { mode: string | null }) => r.mode).filter(Boolean)
      )
      setUnlockedFreePlayModes(wonModes as Set<GameModeId>)
    }
    checkUnlock()
  }, [user])

  // When switching to free play, snap to first mode that has a run (if any)
  useEffect(() => {
    if (gameType === 'free_play' && freePlaySummaries) {
      const activeMode = (['commonwealth', 'capital_wasteland', 'mojave_wasteland'] as const)
        .find(m => freePlaySummaries[m])
      if (activeMode) setSelectedMode(activeMode)
    }
  }, [gameType, freePlaySummaries])

  // Reset action state when switching game type
  useEffect(() => {
    setShowNewGame(false)
    setConfirmAbandon(false)
    setCharName('')
  }, [gameType])

  async function handleContinue(gameId: string) {
    await loadGameById(gameId)
    navigate('/game')
  }

  async function handleStart() {
    if (!user || !charName.trim()) return
    setStarting(true)
    clearGame()
    await startNewGame(charName.trim(), user.id, selectedMode, gameType)
    navigate('/game')
  }

  const existingRun = gameType === 'standard'
    ? activeGameSummaries?.[selectedMode]
    : freePlaySummaries?.[selectedMode]

  function requestNewGame() {
    if (existingRun) {
      setConfirmAbandon(true)
    } else {
      setShowNewGame(true)
    }
    setCharName('')
  }

  function handleModeSelect(modeId: GameModeId) {
    setSelectedMode(modeId)
    if (gameType === 'free_play') {
      if (!unlockedFreePlayModes.has(modeId)) {
        setGameType('standard')
      }
      setConfirmAbandon(false)
      setShowNewGame(false)
    }
  }

  const isFreePlay = gameType === 'free_play'
  const freePlayUnlockedForMode = unlockedFreePlayModes.has(selectedMode)

  return (
    <div
      className="relative min-h-screen flex flex-col items-center justify-end pb-10 sm:justify-center sm:pb-4 px-4 pt-4 transition-colors duration-300 overflow-hidden"
      data-mode={selectedMode}
    >
      {/* Background */}
      <div className="absolute inset-0">
        <picture>
          <source media="(max-width: 639px)" srcSet="/assets/main_menu_background_mobile.png" />
          <img src="/assets/main_menu_background.png" alt="" className="w-full h-full object-cover object-center" />
        </picture>
      </div>
      <div className="absolute inset-0 bg-pip-bg opacity-30" />

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      {showTutorial && <HowToPlay onClose={() => setShowTutorial(false)} />}

      <h1
        className="absolute left-0 right-0 text-center font-display tracking-widest pointer-events-none"
        style={{
          top: 'clamp(12px, 3vh, 32px)',
          fontSize: 'clamp(2.5rem, 9vw, 5.5rem)',
          color: '#1a2d0e',
          WebkitTextStroke: '0.75px #1a2d0e',
        }}
      >
        CHEM CARAVAN
      </h1>

      <div
        className="relative max-w-2xl w-full pip-panel"
        style={{ backgroundColor: 'color-mix(in srgb, var(--pip-bg-light) 75%, transparent)' }}
      >
        {!user ? (
          <div className="space-y-3">
            <button className="pip-btn w-full text-xl" onClick={() => setShowAuth(true)}>
              ENTER THE WASTELAND
            </button>
            <div className="flex gap-2">
              <button className="pip-btn flex-1" onClick={() => navigate('/leaderboard')}>LEADERBOARD</button>
              <button className="pip-btn flex-1" onClick={() => navigate('/how-to-play')}>HOW TO PLAY</button>
            </div>
          </div>
        ) : (
          <div className="space-y-5">

            {/* Mode cards */}
            <div>
              <div className="pip-label mb-3">SELECT REGION</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {MODE_IDS.map(modeId => {
                  const mc         = GAME_MODES[modeId]
                  const stdRun     = activeGameSummaries?.[modeId]
                  const fpRun      = freePlaySummaries?.[modeId] ?? null
                  const displayRun = isFreePlay ? fpRun : stdRun
                  const isSelected = selectedMode === modeId

                  return (
                    <div
                      key={modeId}
                      onClick={() => handleModeSelect(modeId)}
                      className={`border rounded p-3 cursor-pointer transition-colors duration-100 ${
                        isSelected
                          ? 'border-pip-amber bg-pip-bg'
                          : 'border-pip-border hover:border-pip-green'
                      }`}
                    >
                      <div className="font-display text-pip-green text-lg leading-tight">{mc.name}</div>
                      <div className="text-pip-green-dim text-xs mb-2">{mc.subtitle}</div>
                      <div className={`font-display text-xs tracking-widest ${DIFFICULTY_COLOR[modeId]}`}>
                        {DIFFICULTY_LABEL[modeId]}
                      </div>

                      {isFreePlay && !unlockedFreePlayModes.has(modeId) ? (
                        <div className="mt-2 pt-2 border-t border-pip-border-dim text-xs text-pip-green-dim">
                          🔒 Beat Standard to unlock
                        </div>
                      ) : displayRun ? (
                        <div className="mt-2 pt-2 border-t border-pip-border-dim text-xs">
                          <div className="text-pip-green font-display">{displayRun.characterName}</div>
                          <div className="text-pip-green-dim">
                            Turn {displayRun.turn}{!isFreePlay ? '/30' : ''}
                          </div>
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

            {/* Game type toggle + action area */}
            <div className="space-y-3">

              {/* Pill toggle */}
              <div className="flex rounded border border-pip-border overflow-hidden">
                <button
                  className={`flex-1 py-1.5 text-sm font-display tracking-wider transition-colors duration-100 ${
                    !isFreePlay ? 'bg-pip-green text-pip-bg' : 'text-pip-green-dim hover:text-pip-green'
                  }`}
                  onClick={() => setGameType('standard')}
                >
                  STANDARD
                </button>
                <button
                  className={`flex-1 py-1.5 text-sm font-display tracking-wider transition-colors duration-100 ${
                    !freePlayUnlockedForMode
                      ? 'opacity-40 cursor-not-allowed'
                      : isFreePlay
                        ? 'bg-pip-amber text-pip-bg'
                        : 'text-pip-green-dim hover:text-pip-amber'
                  }`}
                  onClick={() => freePlayUnlockedForMode && setGameType('free_play')}
                  disabled={!freePlayUnlockedForMode}
                  title={!freePlayUnlockedForMode ? `Beat ${GAME_MODES[selectedMode].name} in Standard to unlock` : undefined}
                >
                  FREE PLAY{!freePlayUnlockedForMode ? ' 🔒' : ''}
                </button>
              </div>

              {/* Contextual subtitle */}
              {isFreePlay && (
                <div className="text-xs text-pip-amber text-center opacity-75">
                  No turn limit · danger scales with time · score = XP earned
                </div>
              )}
              {!isFreePlay && !freePlayUnlockedForMode && (
                <div className="text-xs text-pip-green-dim text-center opacity-60">
                  Beat {GAME_MODES[selectedMode].name} in Standard to unlock Free Play
                </div>
              )}

              {/* Continue */}
              {existingRun && !showNewGame && !confirmAbandon && (
                <button
                  className={`w-full text-xl ${isFreePlay ? 'pip-btn-amber' : 'pip-btn'}`}
                  onClick={() => handleContinue(existingRun.id)}
                >
                  CONTINUE{isFreePlay ? ' FREE PLAY' : ''} —{' '}
                  {isFreePlay
                    ? `${GAME_MODES[existingRun.modeId].name.split(' ')[0]} (T${existingRun.turn})`
                    : `${GAME_MODES[selectedMode].name} (T${existingRun.turn})`}
                </button>
              )}

              {/* Abandon confirm */}
              {confirmAbandon && (
                <div className="border border-pip-red rounded p-3 space-y-2">
                  <div className="text-pip-red text-sm font-display">
                    ABANDON active run as {existingRun?.characterName}?
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="pip-btn-danger flex-1"
                      onClick={() => { setConfirmAbandon(false); setShowNewGame(true) }}
                    >
                      ABANDON & START NEW
                    </button>
                    <button className="pip-btn flex-1" onClick={() => setConfirmAbandon(false)}>CANCEL</button>
                  </div>
                </div>
              )}

              {/* New game form */}
              {showNewGame ? (
                <div className="space-y-2">
                  <label className="pip-label block mb-1">
                    {GAME_MODES[selectedMode].name}{isFreePlay ? ' — Free Play' : ''}
                  </label>
                  <input
                    type="text"
                    maxLength={30}
                    value={charName}
                    onChange={e => setCharName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleStart()}
                    className="pip-input w-full"
                    placeholder="Enter your name, Wanderer"
                    autoFocus
                  />
                  <button
                    className={`w-full text-xl ${isFreePlay ? 'pip-btn-amber' : 'pip-btn'}`}
                    disabled={!charName.trim() || starting}
                    onClick={handleStart}
                  >
                    {starting ? 'LOADING...' : isFreePlay ? 'START FREE PLAY' : 'START CARAVAN'}
                  </button>
                  <button className="pip-btn w-full text-sm" onClick={() => setShowNewGame(false)}>CANCEL</button>
                </div>
              ) : !confirmAbandon && (
                <button
                  className={`w-full ${isFreePlay ? 'pip-btn-amber' : 'pip-btn'}`}
                  onClick={requestNewGame}
                >
                  {existingRun
                    ? `ABANDON & NEW ${isFreePlay ? 'FREE PLAY' : 'GAME'}`
                    : isFreePlay ? 'NEW FREE PLAY' : 'NEW GAME'}
                </button>
              )}
            </div>

            {/* Footer */}
            <div className="flex gap-2 flex-wrap pt-1">
              <button className="pip-btn flex-1" onClick={() => navigate('/leaderboard')}>LEADERBOARD</button>
              <button className="pip-btn flex-1" onClick={() => setShowTutorial(true)}>HOW TO PLAY</button>
              <button className="pip-btn text-sm text-pip-green-dim px-3" onClick={() => signOut()}>SIGN OUT</button>
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
