import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { GameModeId, ArmorState, GunState, InventoryEntry } from '../types/game'
import type { RunStats } from '../types/stats'
import type { EarnedAchievement } from '../types/achievement'
import { GAME_MODES } from '../data/modes'
import { inventoryBaseValue } from '../engine/economy'
import AchievementsGrid from '../components/game/AchievementsGrid'

type LbTab = GameModeId | 'global'
type GameTypeFilter = 'standard' | 'free_play'

interface PlayerSnapshot {
  caps?: number
  xp?: number
  debt?: number
  armor?: ArmorState | null
  ownedGuns?: Record<string, GunState>
  inventory?: Record<string, InventoryEntry>
}

interface LeaderboardRow {
  id: string
  character_name: string
  final_score: number
  status: string
  mode: GameModeId | null
  turns_reached: number | null
  created_at: string
  state?: {
    endReason?: string | null
    player?: PlayerSnapshot
    stats?: RunStats
    mode?: GameModeId
    earnedAchievements?: EarnedAchievement[]
  }
}

// Minimum game_version (major*10000+minor*100+patch) required per mode.
// Rows with NULL game_version (pre-versioning) are always excluded by the gte filter.
const MIN_GAME_VERSION: Partial<Record<LbTab, number>> & { default: number } = {
  default:           900,  // v0.9.0
  commonwealth:      900,
  capital_wasteland: 900,
  mojave_wasteland:  900,
  global:            900,
}

const TABS: { id: LbTab; label: string }[] = [
  { id: 'commonwealth',      label: 'Commonwealth'  },
  { id: 'capital_wasteland', label: 'Capital'       },
  { id: 'mojave_wasteland',  label: 'Mojave'        },
  { id: 'global',            label: 'GLOBAL'        },
]

const MODE_SHORT: Partial<Record<GameModeId, string>> = {
  commonwealth:      'CW',
  capital_wasteland: 'Cap',
  mojave_wasteland:  'Moj',
}

type DetailTab = 'score' | 'stats' | 'achievements'

function RunDetailModal({ row, isFreePlay, onClose }: { row: LeaderboardRow; isFreePlay: boolean; onClose: () => void }) {
  const [detailTab, setDetailTab] = useState<DetailTab>('score')

  const modeId = row.mode ?? row.state?.mode ?? 'commonwealth'
  const mc = GAME_MODES[modeId]
  const player = row.state?.player
  const stats = row.state?.stats
  const earnedAchievements = row.state?.earnedAchievements ?? []

  const inventoryValue = player?.inventory ? inventoryBaseValue(player.inventory as Record<string, InventoryEntry>) : 0
  const gunsValue = player?.ownedGuns
    ? Object.values(player.ownedGuns).reduce((sum, gun) => sum + (mc.guns[gun.id]?.price ?? 0), 0)
    : 0
  const armorValue = player?.armor
    ? Math.round((player.armor.armorPoints / player.armor.maxArmorPoints) * (mc.armors[player.armor.id]?.price ?? 0))
    : 0
  const netWorth = player
    ? (player.caps ?? 0) + inventoryValue + gunsValue + armorValue - (player.debt ?? 0)
    : null

  const hasStats = !!stats && (stats.totalKills > 0 || stats.combatsFought > 0 || Object.keys(stats.chemsSold ?? {}).length > 0)
  const date = new Date(row.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  const outcome = row.state?.endReason ?? (row.status === 'won' ? 'Turn limit reached' : 'Killed on the road')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-pip-bg opacity-80" />
      <div
        className="relative pip-panel max-w-sm w-full flex flex-col"
        style={{ maxHeight: '90vh' }}
        data-mode={modeId}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-start flex-shrink-0 mb-2">
          <div>
            <div className="font-display text-pip-green text-xl">{row.character_name}</div>
            <div className="text-pip-green-dim text-xs font-mono">{mc.name} · {date}</div>
          </div>
          <button className="pip-btn text-xs" onClick={onClose}>CLOSE</button>
        </div>

        <div className="text-pip-green-dim text-xs italic flex-shrink-0 mb-2">{outcome}</div>

        {/* Tab bar */}
        <div className="flex gap-1 flex-shrink-0 border-b border-pip-border pb-2 mb-3">
          {(['score', 'stats', 'achievements'] as DetailTab[]).map(t => (
            <button
              key={t}
              className={`pip-btn text-xs px-2 py-1 ${detailTab === t ? 'bg-pip-green text-pip-bg-light' : ''}`}
              onClick={() => setDetailTab(t)}
            >
              {t.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="overflow-y-auto flex-1">

          {/* SCORE tab */}
          {detailTab === 'score' && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="pip-label">Turns survived</span>
                <span className="text-pip-green">{row.turns_reached ?? '—'}</span>
              </div>

              {!isFreePlay && player && netWorth !== null && (
                <>
                  <div className="border-t border-pip-border-dim pt-1.5 space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="pip-label">Caps</span>
                      <span className="text-pip-green font-mono">{(player.caps ?? 0).toLocaleString()} ¤</span>
                    </div>
                    {inventoryValue > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="pip-label">+ Inventory</span>
                        <span className="text-pip-green font-mono">{inventoryValue.toLocaleString()} ¤</span>
                      </div>
                    )}
                    {gunsValue > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="pip-label">+ Weapons</span>
                        <span className="text-pip-green font-mono">{gunsValue.toLocaleString()} ¤</span>
                      </div>
                    )}
                    {armorValue > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="pip-label">+ Armor</span>
                        <span className="text-pip-green font-mono">{armorValue.toLocaleString()} ¤</span>
                      </div>
                    )}
                    {(player.debt ?? 0) > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="pip-label">− Debt</span>
                        <span className="text-pip-red font-mono">-{(player.debt ?? 0).toLocaleString()} ¤</span>
                      </div>
                    )}
                  </div>
                  <div className="border-t border-pip-border pt-1.5 flex justify-between items-baseline">
                    <span className="pip-label tracking-widest">FINAL SCORE</span>
                    <span className={`font-display text-xl ${row.final_score >= 0 ? 'text-pip-amber' : 'text-pip-red'}`}>
                      {row.final_score.toLocaleString()} ¤
                    </span>
                  </div>
                  {player.xp != null && player.xp > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="pip-label">XP earned</span>
                      <span className="text-pip-blue font-mono">{player.xp.toLocaleString()} XP</span>
                    </div>
                  )}
                </>
              )}

              {!isFreePlay && (!player || netWorth === null) && (
                <div className="flex justify-between items-baseline border-t border-pip-border-dim pt-1.5">
                  <span className="pip-label">Final score</span>
                  <span className={`font-display text-xl ${row.final_score >= 0 ? 'text-pip-amber' : 'text-pip-red'}`}>
                    {row.final_score.toLocaleString()}
                  </span>
                </div>
              )}

              {isFreePlay && (
                <>
                  <div className="border-t border-pip-border-dim pt-1.5 flex justify-between items-baseline">
                    <span className="pip-label tracking-widest">XP (SCORE)</span>
                    <span className="font-display text-xl text-pip-blue">{row.final_score.toLocaleString()} XP</span>
                  </div>
                  {player && netWorth !== null && (
                    <div className="flex justify-between text-sm">
                      <span className="pip-label">Net worth</span>
                      <span className={`font-mono ${netWorth >= 0 ? 'text-pip-green' : 'text-pip-red'}`}>
                        {netWorth < 0 ? '-' : ''}{Math.abs(netWorth).toLocaleString()} ¤
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* STATS tab */}
          {detailTab === 'stats' && (
            hasStats && stats ? (
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="pip-label">Enemies killed</span>
                  <span className="text-pip-green">{stats.totalKills}</span>
                </div>
                <div className="flex justify-between">
                  <span className="pip-label">Combats won</span>
                  <span className="text-pip-green">{stats.combatsWon} / {stats.combatsFought}</span>
                </div>
                {(stats.combatsFled ?? 0) > 0 && (
                  <div className="flex justify-between">
                    <span className="pip-label">Times fled</span>
                    <span className="text-pip-green">{stats.combatsFled}</span>
                  </div>
                )}
                {stats.totalDamageDealt > 0 && (
                  <div className="flex justify-between">
                    <span className="pip-label">Damage dealt / taken</span>
                    <span className="text-pip-green">{stats.totalDamageDealt} / {stats.totalDamageTaken}</span>
                  </div>
                )}
                {Object.keys(stats.killsByEnemy ?? {}).length > 0 && (
                  <div className="mt-2 space-y-0.5">
                    <div className="pip-label text-xs">KILLS BY ENEMY</div>
                    {Object.entries(stats.killsByEnemy).sort((a, b) => b[1] - a[1]).map(([typeId, count]) => (
                      <div key={typeId} className="flex justify-between text-xs">
                        <span className="text-pip-green-dim">{mc.enemies.find(e => e.id === typeId)?.name ?? typeId}</span>
                        <span className="text-pip-green">{count}</span>
                      </div>
                    ))}
                  </div>
                )}
                {Object.keys(stats.chemsSold ?? {}).length > 0 && (
                  <div className="mt-2 space-y-0.5">
                    <div className="pip-label text-xs">TOP CHEMS BY PROFIT</div>
                    {Object.entries(stats.chemsSold)
                      .filter(([, s]) => s.profitEarned > 0)
                      .sort((a, b) => b[1].profitEarned - a[1].profitEarned)
                      .slice(0, 5)
                      .map(([chemId, s]) => (
                        <div key={chemId} className="flex justify-between text-xs">
                          <span className="text-pip-green-dim">{chemId} <span className="opacity-60">×{s.qty}</span></span>
                          <span className="text-pip-amber">+{s.profitEarned.toLocaleString()} ¤</span>
                        </div>
                      ))}
                  </div>
                )}
                {stats.xpBySource && Object.values(stats.xpBySource).some(v => v > 0) && (() => {
                  const src = stats.xpBySource
                  const total = Object.values(src).reduce((s, v) => s + v, 0)
                  const segments = [
                    { label: 'Combat',           key: 'combat' as const,       color: '#8c1c1c' },
                    { label: 'Achievements',     key: 'achievements' as const, color: '#2a5a8a' },
                    { label: 'Trade profit',     key: 'trade' as const,        color: '#c4501a' },
                    { label: 'Travel/discovery', key: 'travel' as const,       color: '#2c4a10' },
                  ].filter(r => (src[r.key] ?? 0) > 0)
                  return (
                    <div className="mt-2 space-y-2">
                      <div className="flex items-baseline justify-between">
                        <div className="pip-label text-xs">XP BY SOURCE</div>
                        <span className="text-pip-blue font-mono text-xs">{total.toLocaleString()} XP</span>
                      </div>
                      {/* Stacked segmented bar */}
                      <div className="flex w-full overflow-hidden rounded" style={{ height: 10, background: '#6a4a18', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.45)' }}>
                        {segments.map((s, i) => (
                          <div key={s.key} style={{ width: `${(src[s.key] / total) * 100}%`, background: s.color, borderRight: i < segments.length - 1 ? '1.5px solid rgba(0,0,0,0.3)' : 'none' }} />
                        ))}
                      </div>
                      {/* Legend */}
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                        {segments.map(s => (
                          <div key={s.key} className="flex items-center gap-1.5 min-w-0">
                            <div className="flex-shrink-0 rounded-sm" style={{ width: 8, height: 8, background: s.color, opacity: 0.9 }} />
                            <span className="text-pip-green-dim font-mono truncate" style={{ fontSize: '0.6rem' }}>{s.label}</span>
                            <span className="font-mono ml-auto flex-shrink-0" style={{ fontSize: '0.6rem', color: s.color }}>{src[s.key].toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })()}
              </div>
            ) : (
              <div className="text-pip-green-dim text-sm italic">No combat or trading stats recorded for this run.</div>
            )
          )}

          {/* ACHIEVEMENTS tab */}
          {detailTab === 'achievements' && (
            <AchievementsGrid
              earnedAchievements={earnedAchievements}
              mode={modeId}
            />
          )}

        </div>
      </div>
    </div>
  )
}

export default function Leaderboard() {
  const navigate  = useNavigate()
  const [gameTypeFilter, setGameTypeFilter] = useState<GameTypeFilter>('standard')
  const [tab,     setTab]     = useState<LbTab>('global')
  const [rows,    setRows]    = useState<LeaderboardRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const [selected, setSelected] = useState<LeaderboardRow | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)

      const minVersion = MIN_GAME_VERSION[tab] ?? MIN_GAME_VERSION.default

      let query = supabase
        .from('games')
        .select('id, character_name, final_score, status, mode, turns_reached, created_at, state')
        .eq('game_type', gameTypeFilter)
        .not('final_score', 'is', null)
        .gte('game_version', minVersion)
        .order('final_score', { ascending: false })
        .limit(20)

      if (gameTypeFilter === 'standard') {
        query = query.in('status', ['won', 'dead'])
      } else {
        // Free play games end in 'dead', 'bankrupt', or 'won' (retired)
        query = query.in('status', ['dead', 'bankrupt', 'won'])
      }

      if (tab !== 'global') {
        query = query.eq('mode', tab)
      }

      const { data, error: qErr } = await query

      if (qErr) {
        setError(qErr.message)
      } else {
        setRows((data as LeaderboardRow[]) ?? [])
      }
      setLoading(false)
    }
    load()
  }, [tab, gameTypeFilter])

  const displayed = rows.slice(0, 10)
  const activeMode = tab === 'global' ? 'commonwealth' : tab
  const isFreePlay = gameTypeFilter === 'free_play'

  return (
    <div className="relative min-h-screen flex flex-col items-center p-4 overflow-hidden" data-mode={activeMode}>
      {/* Background art */}
      <div className="absolute inset-0">
        <picture>
          <source media="(max-width: 639px)" srcSet="/assets/leaderboard_background_art.png" />
          <img src="/assets/leaderboard_background_art_horizontal.png" alt="" className="w-full h-full object-cover object-center" />
        </picture>
      </div>
      <div className="absolute inset-0 bg-pip-bg opacity-30" />

      {selected && (
        <RunDetailModal row={selected} isFreePlay={isFreePlay} onClose={() => setSelected(null)} />
      )}

      <div className="relative max-w-2xl w-full">
        <div className="flex justify-between items-center mb-4">
          <h1 className="font-display text-4xl text-pip-green tracking-widest">LEADERBOARD</h1>
          <button className="pip-btn" onClick={() => navigate('/')}>BACK</button>
        </div>

        {/* Standard | Free Play toggle */}
        <div className="flex gap-1 mb-4">
          <button
            className={gameTypeFilter === 'standard'
              ? 'pip-btn bg-pip-green text-pip-bg-light px-4 py-1'
              : 'pip-btn px-4 py-1'}
            onClick={() => { setGameTypeFilter('standard'); setTab('global') }}
          >
            STANDARD
          </button>
          <button
            className={gameTypeFilter === 'free_play'
              ? 'pip-btn bg-pip-amber text-pip-bg-light px-4 py-1'
              : 'pip-btn px-4 py-1'}
            onClick={() => { setGameTypeFilter('free_play'); setTab('global') }}
          >
            FREE PLAY
          </button>
        </div>

        {isFreePlay && (
          <div className="text-pip-amber text-xs font-mono mb-3 opacity-70">
            Score = XP earned · net worth shown in run detail · no turn limit
          </div>
        )}
        {!isFreePlay && (
          <div className="text-pip-green-dim text-xs font-mono mb-3 opacity-70">
            Score = net worth (caps + inventory + weapons + armor − debt) · click any run for details
          </div>
        )}

        {/* Tab bar */}
        <div className="flex gap-1 mb-4 flex-wrap">
          {TABS.map(t => (
            <button
              key={t.id}
              className={tab === t.id
                ? `pip-btn ${isFreePlay ? 'bg-pip-amber' : 'bg-pip-green'} text-pip-bg-light text-sm px-3 py-1`
                : 'pip-btn text-sm px-3 py-1'}
              onClick={() => setTab(t.id)}
            >
              {t.id !== 'global'
                ? GAME_MODES[t.id as GameModeId].name.split(' ')[0].toUpperCase()
                : t.label}
            </button>
          ))}
        </div>

        {/* Mode subtitle */}
        {tab !== 'global' && (
          <div className="text-pip-green-dim text-xs mb-3 font-mono">
            {GAME_MODES[tab as GameModeId].subtitle} · Top 10 runs
          </div>
        )}

        {loading && <div className="text-pip-green-dim font-mono">LOADING DATA...</div>}
        {error   && <div className="text-pip-red font-mono">Error: {error}</div>}
        {!loading && !error && rows.length === 0 && (
          <div className="text-pip-green-dim font-mono">No finished runs yet. Be the first!</div>
        )}

        {!loading && displayed.length > 0 && (
          <div className="pip-panel" style={{ backgroundColor: 'color-mix(in srgb, var(--pip-bg-light) 82%, transparent)' }}>
            {/* Header */}
            <div
              className="grid gap-2 text-pip-green-dim text-xs uppercase tracking-widest border-b border-pip-border pb-2 mb-2"
              style={{ gridTemplateColumns: tab === 'global' ? '1.5rem 1fr 1fr 1fr 2rem 2.5rem' : '1.5rem 1fr 1fr 1fr 2.5rem' }}
            >
              <div>#</div>
              <div className="col-span-2">Name</div>
              <div>{isFreePlay ? 'XP / Caps' : 'Score / XP'}</div>
              {tab === 'global' && <div>Region</div>}
              <div>Turns</div>
            </div>

            {displayed.map((row, idx) => {
              const rank     = idx + 1
              const score    = row.final_score ?? 0
              const modeName = row.mode ? (MODE_SHORT[row.mode] ?? '—') : '—'
              const outcome  = row.state?.endReason ?? (
                row.status === 'won' ? 'Turn limit reached' : 'Killed on the road'
              )

              return (
                <div
                  key={row.id}
                  className="grid gap-2 text-sm py-1.5 border-b border-pip-border-dim cursor-pointer hover:bg-pip-bg transition-colors rounded"
                  style={{ gridTemplateColumns: tab === 'global' ? '1.5rem 1fr 1fr 1fr 2rem 2.5rem' : '1.5rem 1fr 1fr 1fr 2.5rem' }}
                  onClick={() => setSelected(row)}
                >
                  <div className={`font-display text-lg ${
                    rank === 1 ? 'text-pip-amber' : rank <= 3 ? 'text-pip-green-mid' : 'text-pip-green-dim'
                  }`}>
                    {rank}
                  </div>
                  <div className="col-span-2 min-w-0">
                    <div className="text-pip-green font-mono truncate">{row.character_name}</div>
                    <div className="text-pip-green-dim text-xs italic truncate">{outcome}</div>
                  </div>
                  <div>
                    <div className={`font-display text-lg ${
                      isFreePlay ? 'text-pip-blue' : (score >= 0 ? 'text-pip-amber' : 'text-pip-red')
                    }`}>
                      {score.toLocaleString()}{isFreePlay ? ' XP' : ''}
                    </div>
                    {isFreePlay && row.state?.player?.caps != null && (
                      <div className="text-xs text-pip-amber font-mono">
                        {row.state.player.caps.toLocaleString()} ¤
                      </div>
                    )}
                    {!isFreePlay && row.state?.player?.xp != null && (
                      <div className="text-xs text-pip-blue font-mono">
                        {row.state.player.xp.toLocaleString()} XP
                      </div>
                    )}
                  </div>
                  {tab === 'global' && (
                    <div className="text-xs text-pip-green-dim self-center">{modeName}</div>
                  )}
                  <div className="text-xs text-pip-green-dim self-center">
                    {row.turns_reached != null ? `T${row.turns_reached}` : '—'}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
