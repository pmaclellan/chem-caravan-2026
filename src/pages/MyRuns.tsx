import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { supabase } from '../lib/supabase'
import { normalizeState } from '../engine/normalizeState'
import { GAME_MODES } from '../data/modes'
import { inventoryBaseValue, calculateNetWorth } from '../engine/economy'
import type { GameModeId, GameState, GameType } from '../types/game'
import { useWastelandRecap } from '../hooks/useWastelandRecap'
import { RecapMarkdown } from '../components/ui/RecapMarkdown'
import AnalyzingIndicator from '../components/ui/AnalyzingIndicator'

interface RunListItem {
  id: string
  character_name: string
  mode: GameModeId | null
  game_type: GameType
  status: 'active' | 'won' | 'dead' | 'bankrupt'
  final_score: number | null
  turns_reached: number | null
  created_at: string
}

const STATUS_COLOR: Record<RunListItem['status'], string> = {
  active: 'text-pip-amber',
  won: 'text-pip-green',
  dead: 'text-pip-red',
  bankrupt: 'text-pip-red',
}

function RunDetail({ item, gameState, onClose }: { item: RunListItem; gameState: GameState; onClose: () => void }) {
  const mc = GAME_MODES[gameState.mode]
  const isFreePlay = gameState.gameType === 'free_play'
  const player = gameState.player
  const stats = gameState.stats
  const { recapState, recapText, fetchRecap } = useWastelandRecap(item.id, gameState.recap?.summary ?? null)

  const inventoryValue = inventoryBaseValue(player.inventory)
  const netWorth = calculateNetWorth(player, mc)
  const date = new Date(item.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  const outcome = gameState.endReason ?? (item.status === 'won' ? 'Turn limit reached' : 'Killed on the road')
  const hasStats = stats.totalKills > 0 || stats.combatsFought > 0 || Object.keys(stats.chemsSold).length > 0
  const favoriteGunId = Object.keys(stats.killsByGun).length > 0
    ? Object.entries(stats.killsByGun).sort((a, b) => b[1] - a[1])[0]?.[0]
    : null
  const favoriteWeapon = favoriteGunId && favoriteGunId !== 'unarmed'
    ? (mc.guns[favoriteGunId]?.name ?? favoriteGunId)
    : favoriteGunId === 'unarmed' ? 'Unarmed / guards' : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-pip-bg opacity-80" />
      <div
        className="relative pip-panel max-w-sm w-full flex flex-col"
        style={{ maxHeight: '90vh' }}
        data-mode={gameState.mode}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-start flex-shrink-0 mb-2">
          <div>
            <div className="font-display text-pip-green text-xl">{item.character_name}</div>
            <div className="text-pip-green-dim text-xs font-mono">{mc.name} · {isFreePlay ? 'Free Play' : 'Standard'} · {date}</div>
          </div>
          <button className="pip-btn text-xs" onClick={onClose}>CLOSE</button>
        </div>

        <div className={`text-xs italic flex-shrink-0 mb-2 ${STATUS_COLOR[item.status]}`}>{outcome}</div>

        <div className="overflow-y-auto flex-1 space-y-3">
          {/* Score */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="pip-label">Turns survived</span>
              <span className="text-pip-green">{item.turns_reached ?? gameState.world.turn}</span>
            </div>
            {!isFreePlay && inventoryValue > 0 && (
              <div className="flex justify-between text-sm">
                <span className="pip-label">Caps + gear</span>
                <span className="text-pip-green font-mono">{(player.caps + inventoryValue).toLocaleString()} ¤</span>
              </div>
            )}
            <div className="border-t border-pip-border pt-1.5 flex justify-between items-baseline">
              <span className="pip-label tracking-widest">{isFreePlay ? 'XP (SCORE)' : 'FINAL SCORE'}</span>
              <span className={`font-display text-xl ${isFreePlay ? 'text-pip-blue' : (item.final_score ?? 0) >= 0 ? 'text-pip-amber' : 'text-pip-red'}`}>
                {(item.final_score ?? 0).toLocaleString()}{isFreePlay ? ' XP' : ' ¤'}
              </span>
            </div>
            {isFreePlay && (
              <div className="flex justify-between text-sm">
                <span className="pip-label">Net worth</span>
                <span className={`font-mono ${netWorth >= 0 ? 'text-pip-green' : 'text-pip-red'}`}>
                  {netWorth < 0 ? '-' : ''}{Math.abs(netWorth).toLocaleString()} ¤
                </span>
              </div>
            )}
          </div>

          {/* Stats */}
          {hasStats && (
            <div className="border-t border-pip-border-dim pt-2 space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="pip-label">Enemies killed</span>
                <span className="text-pip-green">{stats.totalKills}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="pip-label">Combats won</span>
                <span className="text-pip-green">{stats.combatsWon} / {stats.combatsFought}</span>
              </div>
              {favoriteWeapon && (
                <div className="flex justify-between text-sm">
                  <span className="pip-label">Favorite weapon</span>
                  <span className="text-pip-green text-right max-w-[60%] truncate">{favoriteWeapon}</span>
                </div>
              )}
            </div>
          )}

          {/* Recap */}
          <div className="border-t border-pip-border-dim pt-2">
            {recapState === 'idle' && (
              <button className="pip-btn w-full text-sm" onClick={fetchRecap}>GET WASTELAND RECAP</button>
            )}
            {recapState === 'loading' && (
              <button className="pip-btn w-full text-sm" disabled><AnalyzingIndicator /></button>
            )}
            {recapState === 'ready' && recapText && <RecapMarkdown text={recapText} />}
            {recapState === 'unavailable' && (
              <div className="text-xs text-pip-green-dim text-center">Recap unavailable for this run.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function MyRuns() {
  const navigate = useNavigate()
  const user = useAuthStore(s => s.user)
  const [runs, setRuns] = useState<RunListItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedItem, setSelectedItem] = useState<RunListItem | null>(null)
  const [selectedState, setSelectedState] = useState<GameState | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  useEffect(() => {
    if (!user) return
    supabase
      .from('games')
      .select('id, character_name, mode, game_type, status, final_score, turns_reached, created_at')
      .eq('user_id', user.id)
      .neq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data, error: qErr }) => {
        if (qErr) { setError(qErr.message); return }
        setRuns((data ?? []) as RunListItem[])
      })
  }, [user])

  const openRun = async (item: RunListItem) => {
    setSelectedItem(item)
    setSelectedState(null)
    setLoadingDetail(true)
    const { data, error: qErr } = await supabase.from('games').select('state').eq('id', item.id).single()
    setLoadingDetail(false)
    if (qErr || !data) { setError(qErr?.message ?? 'Failed to load run'); return }
    setSelectedState(normalizeState(data.state as GameState))
  }

  const closeDetail = () => { setSelectedItem(null); setSelectedState(null) }

  return (
    <div className="relative min-h-screen flex flex-col items-center p-4" data-mode="commonwealth">
      {selectedItem && selectedState && (
        <RunDetail item={selectedItem} gameState={selectedState} onClose={closeDetail} />
      )}
      {selectedItem && loadingDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="text-pip-green font-display text-xl">LOADING...</div>
        </div>
      )}

      <div className="relative max-w-2xl w-full">
        <div className="flex justify-between items-center mb-4">
          <h1 className="font-display text-4xl text-pip-green tracking-widest">MY RUNS</h1>
          <button className="pip-btn" onClick={() => navigate('/')}>BACK</button>
        </div>

        {error && <div className="pip-panel text-pip-red text-sm mb-3">{error}</div>}
        {!runs && !error && <div className="pip-panel text-pip-green-dim text-sm">Loading your runs...</div>}
        {runs && runs.length === 0 && (
          <div className="pip-panel text-pip-green-dim text-sm">No completed runs yet — finish a game to see it here.</div>
        )}

        {runs && runs.length > 0 && (
          <div className="pip-panel divide-y divide-pip-border-dim">
            {runs.map(r => (
              <button
                key={r.id}
                className="w-full text-left px-2 py-2 hover:bg-pip-border-dim transition-colors"
                onClick={() => openRun(r)}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-pip-green font-display">{r.character_name}</span>
                  <span className={`text-xs font-mono ${STATUS_COLOR[r.status]}`}>{r.status}</span>
                </div>
                <div className="text-pip-green-dim text-xs font-mono flex items-center justify-between">
                  <span>{r.mode ? GAME_MODES[r.mode].name : '—'} · {r.game_type === 'free_play' ? 'Free Play' : 'Standard'} · turn {r.turns_reached ?? '?'}</span>
                  <span>{new Date(r.created_at).toLocaleDateString()}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
