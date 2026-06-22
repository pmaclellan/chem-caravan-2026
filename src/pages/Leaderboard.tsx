import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { GameModeId } from '../types/game'
import { GAME_MODES } from '../data/modes'

type LbTab = GameModeId | 'global'
type GameTypeFilter = 'standard' | 'free_play'

interface LeaderboardRow {
  id: string
  character_name: string
  final_score: number
  status: string
  mode: GameModeId | null
  turns_reached: number | null
  created_at: string
  state?: { endReason?: string | null; player?: { caps?: number } }
}


// Minimum game_version (major*10000+minor*100+patch) required per mode.
// Rows with NULL game_version (pre-versioning) are always excluded by the gte filter.
const MIN_GAME_VERSION: Partial<Record<LbTab, number>> & { default: number } = {
  default:           600,  // v0.6.0
  commonwealth:      600,
  capital_wasteland: 600,
  mojave_wasteland:  600,
  global:            600,
}

const TABS: { id: LbTab; label: string }[] = [
  { id: 'commonwealth',      label: 'Commonwealth'  },
  { id: 'capital_wasteland', label: 'Capital'       },
  { id: 'mojave_wasteland',  label: 'Mojave'        },
  { id: 'global',            label: 'GLOBAL'        },
]

export default function Leaderboard() {
  const navigate  = useNavigate()
  const [gameTypeFilter, setGameTypeFilter] = useState<GameTypeFilter>('standard')
  const [tab,     setTab]     = useState<LbTab>('global')
  const [rows,    setRows]    = useState<LeaderboardRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

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
            Score = XP earned · caps on hand shown below · no turn limit
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
            <div className={`grid gap-2 text-pip-green-dim text-xs uppercase tracking-widest border-b border-pip-border pb-2 mb-2 ${tab === 'global' ? 'grid-cols-6' : 'grid-cols-5'}`}>
              <div>#</div>
              <div className="col-span-2">Name</div>
              <div>{isFreePlay ? 'XP / Caps' : 'Score'}</div>
              {tab === 'global' && <div>Region</div>}
              <div>Turns</div>
            </div>

            {displayed.map((row, idx) => {
              const rank     = idx + 1
              const score    = row.final_score ?? 0
              const modeName = row.mode ? GAME_MODES[row.mode]?.name.split(' ')[0] : '—'
              const outcome  = row.state?.endReason ?? (
                row.status === 'won' ? 'Turn limit reached' : 'Killed on the road'
              )

              return (
                <div
                  key={row.id}
                  className={`grid gap-2 text-sm py-1.5 border-b border-pip-border-dim ${tab === 'global' ? 'grid-cols-6' : 'grid-cols-5'}`}
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
                      {score.toLocaleString()}{isFreePlay ? ' XP' : ' ¤'}
                    </div>
                    {isFreePlay && row.state?.player?.caps != null && (
                      <div className="text-xs text-pip-amber font-mono">
                        {row.state.player.caps.toLocaleString()} ¤
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
