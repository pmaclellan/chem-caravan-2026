import { useEffect, useMemo, useState } from 'react'
import type { GameModeId, GameState } from '@main/types/game'
import { GAME_MODES } from '@main/data/modes'
import { supabaseAdmin } from '../lib/supabaseAdmin'

const MODE_IDS: GameModeId[] = ['commonwealth', 'capital_wasteland', 'mojave_wasteland']
const ALL_PLAYERS = 'all'

interface Row {
  user_id: string
  character_name: string
  state: GameState
}

interface SettlementStat {
  exactTurns: number   // real per-turn visit frequency, from runs with history tracking
  approxRuns: number   // count of legacy runs that ever reached this settlement (not a frequency)
}

export default function MapHeatmap() {
  const [modeId, setModeId] = useState<GameModeId>('commonwealth')
  const [rows, setRows] = useState<Row[] | null>(null)
  const [selectedUserId, setSelectedUserId] = useState<string>(ALL_PLAYERS)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setRows(null)
    setError(null)
    setSelectedUserId(ALL_PLAYERS)
    supabaseAdmin
      .from('games')
      .select('user_id, character_name, state')
      .eq('mode', modeId)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) { setError(error.message); return }
        setRows((data ?? []) as Row[])
      })
    return () => { cancelled = true }
  }, [modeId])

  // One entry per distinct user_id — label uses that player's most recent character name,
  // since rows are fetched newest-first and this is the first occurrence we see per user.
  const players = useMemo(() => {
    if (!rows) return []
    const seen = new Map<string, string>()
    for (const r of rows) {
      if (!seen.has(r.user_id)) seen.set(r.user_id, r.character_name)
    }
    return Array.from(seen.entries()).map(([userId, label]) => ({ userId, label }))
  }, [rows])

  const filteredRows = useMemo(() => {
    if (!rows) return []
    return selectedUserId === ALL_PLAYERS ? rows : rows.filter(r => r.user_id === selectedUserId)
  }, [rows, selectedUserId])

  const { stats, exactRunTotal, approxRunTotal } = useMemo(() => {
    const stats: Record<string, SettlementStat> = {}
    const bump = (id: string, field: keyof SettlementStat, by: number) => {
      const s = stats[id] ?? { exactTurns: 0, approxRuns: 0 }
      s[field] += by
      stats[id] = s
    }
    let exact = 0
    let approx = 0
    for (const row of filteredRows) {
      const state = row.state
      if (state?.history?.length > 1) {
        exact++
        for (const snap of state.history) bump(snap.location, 'exactTurns', 1)
      } else if (state?.player?.visitedSettlements?.length) {
        approx++
        // Presence only — a settlement appears at most once per run here, regardless of how
        // many turns were actually spent there (visitedSettlements has no repeat/frequency data).
        for (const id of state.player.visitedSettlements) bump(id, 'approxRuns', 1)
      }
    }
    return { stats, exactRunTotal: exact, approxRunTotal: approx }
  }, [filteredRows])

  const mc = GAME_MODES[modeId]
  const weight = (s: SettlementStat | undefined) => (s?.exactTurns ?? 0) + (s?.approxRuns ?? 0)
  const maxWeight = Math.max(1, ...Object.values(stats).map(weight))

  return (
    <div className="pip-panel flex flex-col h-full min-h-0" data-mode={modeId}>
      <div className="flex items-center justify-between mb-2 gap-2">
        <div className="pip-section-title text-lg">{mc.mapTitle} — VISIT HEATMAP</div>
        <div className="flex gap-2">
          <select className="pip-input text-xs" value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)} disabled={!rows}>
            <option value={ALL_PLAYERS}>All Players ({players.length})</option>
            {players.map(p => <option key={p.userId} value={p.userId}>{p.label}</option>)}
          </select>
          <select className="pip-input text-xs" value={modeId} onChange={e => setModeId(e.target.value as GameModeId)}>
            {MODE_IDS.map(id => <option key={id} value={id}>{GAME_MODES[id].name}</option>)}
          </select>
        </div>
      </div>

      {error && <div className="text-pip-red text-sm">Failed to load runs: {error}</div>}
      {!error && !rows && <div className="text-sm text-pip-green-dim">Loading…</div>}

      {rows && (
        <>
          {filteredRows.length === 0 && (
            <div className="text-xs font-mono text-pip-amber border border-pip-amber rounded px-2 py-1 mb-2">
              No runs for this selection.
            </div>
          )}

          {filteredRows.length > 0 && exactRunTotal === 0 && (
            <div className="text-xs font-mono text-pip-amber border border-pip-amber rounded px-2 py-1 mb-2">
              All {approxRunTotal} run{approxRunTotal === 1 ? '' : 's'} shown predate per-turn tracking. Numbers below are "visited in N of {approxRunTotal} runs" (at least once, ever) — NOT how many times. Real visit-frequency will appear here once new runs are played.
            </div>
          )}

          {exactRunTotal > 0 && (
            <div className="text-[10px] font-mono text-pip-green-dim mb-2">
              {exactRunTotal} run{exactRunTotal === 1 ? '' : 's'} with per-turn tracking (exact turn counts)
              {approxRunTotal > 0 && ` · ${approxRunTotal} older run${approxRunTotal === 1 ? '' : 's'} counted separately as "visited" only (approximate, see labels)`}
            </div>
          )}

          <div className="flex-1 min-h-0 overflow-auto flex items-center justify-center">
            <svg viewBox="0 0 620 620" className="w-full max-w-[620px]">
              {mc.roads.map(road => {
                const from = mc.mapPositions[road.from]
                const to = mc.mapPositions[road.to]
                if (!from || !to) return null
                return (
                  <line
                    key={road.id}
                    x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                    stroke="var(--pip-border)"
                    strokeWidth={1.5}
                  />
                )
              })}

              {Object.entries(mc.mapPositions).map(([id, pos]) => {
                const s = stats[id]
                const w = weight(s)
                const intensity = w / maxWeight
                const radius = 6 + intensity * 14
                const opacity = w === 0 ? 0.12 : 0.25 + intensity * 0.75
                const settlement = mc.settlements[id]

                const parts: string[] = []
                if (s?.exactTurns) parts.push(`${s.exactTurns} turn${s.exactTurns === 1 ? '' : 's'}`)
                if (s?.approxRuns) parts.push(`${s.approxRuns}/${approxRunTotal} runs`)
                const label = parts.length > 0 ? parts.join(' + ') : 'never'

                return (
                  <g key={id}>
                    <circle
                      cx={pos.x} cy={pos.y} r={radius}
                      fill="var(--pip-green)"
                      opacity={opacity}
                    />
                    <circle cx={pos.x} cy={pos.y} r={2} fill="var(--pip-amber)" />
                    <text
                      x={pos.x + pos.labelDx} y={pos.y + pos.labelDy}
                      textAnchor={pos.labelAnchor}
                      fontSize={11}
                      fill="var(--pip-green-dim)"
                      style={{ fontFamily: 'monospace' }}
                    >
                      {settlement?.name ?? id} ({label})
                    </text>
                  </g>
                )
              })}
            </svg>
          </div>

          <div className="text-[10px] font-mono text-pip-green-dim mt-2">
            Circle size/opacity = exact turns (new runs) plus run-presence count (legacy runs), summed across {selectedUserId === ALL_PLAYERS ? 'all runs shown above' : "this player's runs shown above"}. "N turns" is real frequency; "N/M runs" just means reached at least once in N of M legacy runs.
          </div>
        </>
      )}
    </div>
  )
}
