import { useEffect, useMemo, useRef, useState } from 'react'
import type { GameModeId, GameState } from '@main/types/game'
import { GAME_MODES } from '@main/data/modes'
import type { GameModeConfig } from '@main/data/modes'
import { dangerColor } from '@main/components/game/SettlementMap'
import { intensityColor } from '@main/utils/intensityColor'
import { supabaseAdmin } from '../lib/supabaseAdmin'
import { reconstructLocationSequenceFromLog, type ReconstructedTurn } from '../lib/reconstructFromLog'

const MODE_IDS: GameModeId[] = ['commonwealth', 'capital_wasteland', 'mojave_wasteland']
const ALL_PLAYERS = 'all'
const AGGREGATE = 'aggregate'

interface Row {
  id: string
  user_id: string
  character_name: string
  created_at: string
  turns_reached: number | null
  status: string
  state: GameState
}

interface SettlementStat {
  exactTurns: number          // real per-turn visit frequency, from runs with history tracking
  reconstructedTurns: number  // real per-turn visit frequency, reconstructed from a legacy run's log text
  approxRuns: number          // count of legacy runs (no history, no parseable log) that ever reached this settlement — not a frequency
}

// Shared by the "exact" (real TurnSnapshot[] history) and "reconstructed" (parsed from log text)
// tiers — both produce the same {turn, location} sequence shape, so both can be turned into
// settlement-visit counts and road-usage counts the same way. Each consecutive pair in the
// sequence is exactly one road traversal (a turn only advances on travel completion), so road
// usage can be derived from the location sequence alone.
function applyLocationSequence(
  sequence: Array<{ turn: number; location: string }>,
  mc: GameModeConfig,
  bumpSettlement: (id: string, field: keyof SettlementStat, by: number) => void,
  field: 'exactTurns' | 'reconstructedTurns',
  roadUsage: Record<string, number>,
) {
  for (const snap of sequence) bumpSettlement(snap.location, field, 1)
  for (let i = 0; i < sequence.length - 1; i++) {
    const a = sequence[i].location
    const b = sequence[i + 1].location
    if (a === b) continue
    const road = mc.roads.find(r => (r.from === a && r.to === b) || (r.from === b && r.to === a))
    if (road) roadUsage[road.id] = (roadUsage[road.id] ?? 0) + 1
  }
}

interface Props {
  // When set (embedding this component scoped to a single already-open run, e.g. from the
  // per-run tab bar), the mode/player/run pickers open pre-focused on that run instead of the
  // usual all-players aggregate — the user can still switch back via the pickers themselves.
  focusUserId?: string
  focusRunId?: string
  focusMode?: GameModeId
}

export default function MapHeatmap({ focusUserId, focusRunId, focusMode }: Props) {
  const [modeId, setModeId] = useState<GameModeId>(focusMode ?? 'commonwealth')
  const [rows, setRows] = useState<Row[] | null>(null)
  const [selectedUserId, setSelectedUserId] = useState<string>(focusUserId ?? ALL_PLAYERS)
  const [selectedRunId, setSelectedRunId] = useState<string>(focusRunId ?? AGGREGATE)
  const [turnRange, setTurnRange] = useState<[number, number] | null>(null)
  const [error, setError] = useState<string | null>(null)
  // The focus props should only seed the initial view — a later, real mode switch (the user
  // manually picking a different mode from the dropdown) should reset to the aggregate view like
  // the standalone (unfocused) heatmap page always has. Compare against the mode captured at
  // mount rather than a "have we run once yet" flag: React 18 StrictMode double-invokes effects
  // on mount in dev (mount -> cleanup -> mount again, component instance and state untouched), so
  // a "first run" ref flips to false before the real second pass and wrongly resets the focus.
  const initialModeId = useRef(modeId)

  useEffect(() => {
    let cancelled = false
    setRows(null)
    setError(null)
    if (modeId !== initialModeId.current) {
      setSelectedUserId(ALL_PLAYERS)
      setSelectedRunId(AGGREGATE)
    }
    supabaseAdmin
      .from('games')
      .select('id, user_id, character_name, created_at, turns_reached, status, state')
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

  const selectedRun = selectedRunId === AGGREGATE ? null : filteredRows.find(r => r.id === selectedRunId) ?? null

  // Full turn extent of the selected run (unfiltered) — used to size the range slider and to
  // restore full-range whenever a different run is picked.
  const selectedRunTurnBounds = useMemo<[number, number] | null>(() => {
    const history = selectedRun?.state?.history
    if (!history || history.length < 2) return null
    const turns = history.map(h => h.turn)
    return [Math.min(...turns), Math.max(...turns)]
  }, [selectedRun])

  useEffect(() => {
    setTurnRange(selectedRunTurnBounds)
  }, [selectedRunTurnBounds])

  const targetRows = selectedRunId === AGGREGATE ? filteredRows : (selectedRun ? [selectedRun] : [])

  const { settlementStats, roadUsage, exactRunTotal, reconstructedRunTotal, approxRunTotal, maxRoadUsage } = useMemo(() => {
    const settlementStats: Record<string, SettlementStat> = {}
    const bumpSettlement = (id: string, field: keyof SettlementStat, by: number) => {
      const s = settlementStats[id] ?? { exactTurns: 0, reconstructedTurns: 0, approxRuns: 0 }
      s[field] += by
      settlementStats[id] = s
    }
    const roadUsage: Record<string, number> = {}
    const mc = GAME_MODES[modeId]
    let exact = 0
    let reconstructed = 0
    let approx = 0

    for (const row of targetRows) {
      const state = row.state
      if (state?.history?.length > 1) {
        // Tier 1: real per-turn TurnSnapshot[] history — exact.
        exact++
        let history: ReconstructedTurn[] = state.history
        if (selectedRunId !== AGGREGATE && turnRange) {
          history = history.filter(h => h.turn >= turnRange[0] && h.turn <= turnRange[1])
        }
        applyLocationSequence(history, mc, bumpSettlement, 'exactTurns', roadUsage)
        continue
      }

      // Tier 2: no history, but the run's log text has "Arrived at X." lines we can parse into
      // the same {turn, location} shape — turn-accurate, just not from a dedicated tracking
      // field. (No turnRange filtering here: the range slider is only ever populated from real
      // `history` bounds, so it never applies to a reconstructed-only run.)
      const fromLog = reconstructLocationSequenceFromLog(state, modeId)
      if (fromLog && fromLog.length > 1) {
        reconstructed++
        applyLocationSequence(fromLog, mc, bumpSettlement, 'reconstructedTurns', roadUsage)
        continue
      }

      // Tier 3: neither — fall back to the binary "visited at least once, ever" list. Presence
      // only, no frequency, no road data.
      if (state?.player?.visitedSettlements?.length) {
        approx++
        for (const id of state.player.visitedSettlements) bumpSettlement(id, 'approxRuns', 1)
      }
    }
    return {
      settlementStats, roadUsage, exactRunTotal: exact, reconstructedRunTotal: reconstructed, approxRunTotal: approx,
      maxRoadUsage: Math.max(1, ...Object.values(roadUsage)),
    }
  }, [targetRows, modeId, selectedRunId, turnRange])

  const mc = GAME_MODES[modeId]
  const weight = (s: SettlementStat | undefined) => (s?.exactTurns ?? 0) + (s?.reconstructedTurns ?? 0) + (s?.approxRuns ?? 0)
  const maxWeight = Math.max(1, ...Object.values(settlementStats).map(weight))
  const isSingleRun = selectedRunId !== AGGREGATE
  const hasTurnData = exactRunTotal > 0 || reconstructedRunTotal > 0

  return (
    <div className="pip-panel flex flex-col h-full min-h-0" data-mode={modeId}>
      <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
        <div className="pip-section-title text-lg">{mc.mapTitle} — VISIT HEATMAP</div>
        <div className="flex gap-2 flex-wrap">
          <select className="pip-input text-xs" value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)} disabled={!rows}>
            <option value={ALL_PLAYERS}>All Players ({players.length})</option>
            {players.map(p => <option key={p.userId} value={p.userId}>{p.label}</option>)}
          </select>
          {selectedUserId !== ALL_PLAYERS && (
            <select className="pip-input text-xs" value={selectedRunId} onChange={e => setSelectedRunId(e.target.value)}>
              <option value={AGGREGATE}>Aggregate ({filteredRows.length} runs)</option>
              {filteredRows.map(r => (
                <option key={r.id} value={r.id}>
                  {new Date(r.created_at).toLocaleDateString()} — {r.turns_reached ?? '?'} turns ({r.status})
                </option>
              ))}
            </select>
          )}
          <select className="pip-input text-xs" value={modeId} onChange={e => setModeId(e.target.value as GameModeId)}>
            {MODE_IDS.map(id => <option key={id} value={id}>{GAME_MODES[id].name}</option>)}
          </select>
        </div>
      </div>

      {isSingleRun && selectedRunTurnBounds && turnRange && (
        <div className="flex items-center gap-2 text-[10px] font-mono text-pip-green-dim mb-2">
          <span>Turns:</span>
          <input
            type="number" className="pip-input text-xs w-16 py-0.5"
            min={selectedRunTurnBounds[0]} max={turnRange[1]} value={turnRange[0]}
            onChange={e => setTurnRange([Math.min(Number(e.target.value), turnRange[1]), turnRange[1]])}
          />
          <span>to</span>
          <input
            type="number" className="pip-input text-xs w-16 py-0.5"
            min={turnRange[0]} max={selectedRunTurnBounds[1]} value={turnRange[1]}
            onChange={e => setTurnRange([turnRange[0], Math.max(Number(e.target.value), turnRange[0])])}
          />
          <span>of {selectedRunTurnBounds[0]}–{selectedRunTurnBounds[1]}</span>
          {(turnRange[0] !== selectedRunTurnBounds[0] || turnRange[1] !== selectedRunTurnBounds[1]) && (
            <button className="pip-btn text-[10px] py-0.5 px-1.5" onClick={() => setTurnRange(selectedRunTurnBounds)}>RESET</button>
          )}
        </div>
      )}

      {error && <div className="text-pip-red text-sm">Failed to load runs: {error}</div>}
      {!error && !rows && <div className="text-sm text-pip-green-dim">Loading…</div>}

      {rows && (
        <>
          {targetRows.length === 0 && (
            <div className="text-xs font-mono text-pip-amber border border-pip-amber rounded px-2 py-1 mb-2">
              No runs for this selection.
            </div>
          )}

          {targetRows.length > 0 && !hasTurnData && (
            <div className="text-xs font-mono text-pip-amber border border-pip-amber rounded px-2 py-1 mb-2">
              {isSingleRun
                ? "This run predates per-turn tracking and its log had no readable travel lines — only a binary \"visited or not\" is available, and roads can't be reconstructed at all."
                : `All ${approxRunTotal} run${approxRunTotal === 1 ? '' : 's'} shown predate per-turn tracking, and none had a log that could be reconstructed. Numbers below are "visited in N of ${approxRunTotal} runs" (at least once, ever) — NOT how many times. Real visit-frequency will appear here once new runs are played.`}
            </div>
          )}

          {isSingleRun && exactRunTotal === 0 && reconstructedRunTotal > 0 && (
            <div className="text-xs font-mono text-pip-amber border border-pip-amber rounded px-2 py-1 mb-2">
              This run predates per-turn tracking — locations and roads below were reconstructed from its travel log instead (turn-accurate, same as exact tracking).
            </div>
          )}

          {hasTurnData && !isSingleRun && (
            <div className="text-[10px] font-mono text-pip-green-dim mb-2">
              {exactRunTotal > 0 && `${exactRunTotal} run${exactRunTotal === 1 ? '' : 's'} with per-turn tracking (exact turn counts)`}
              {exactRunTotal > 0 && reconstructedRunTotal > 0 && ' · '}
              {reconstructedRunTotal > 0 && `${reconstructedRunTotal} older run${reconstructedRunTotal === 1 ? '' : 's'} reconstructed from log text (turn-accurate, labeled "(log)" below)`}
              {approxRunTotal > 0 && ` · ${approxRunTotal} older run${approxRunTotal === 1 ? '' : 's'} counted separately as "visited" only (no readable log, approximate — see labels)`}
            </div>
          )}

          <div className="flex-1 min-h-0 overflow-auto flex items-start justify-center">
            <svg viewBox="0 0 620 620" className="w-full max-w-[620px]">
              {mc.roads.map(road => {
                const from = mc.mapPositions[road.from]
                const to = mc.mapPositions[road.to]
                if (!from || !to) return null
                const usage = roadUsage[road.id] ?? 0
                const usageT = usage / maxRoadUsage
                return (
                  <g key={road.id}>
                    <line
                      x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                      stroke={dangerColor(road.dangerLevel, mc.id)}
                      strokeWidth={1.5 + usageT * 6}
                      opacity={usage === 0 ? 0.3 : 0.55 + usageT * 0.45}
                    />
                    {usage > 0 && (
                      <text
                        x={(from.x + to.x) / 2} y={(from.y + to.y) / 2}
                        textAnchor="middle" fontSize={9} fill="var(--pip-bg-light)"
                        style={{ fontFamily: 'monospace', paintOrder: 'stroke', stroke: 'var(--pip-border)', strokeWidth: 3 }}
                      >
                        ×{usage}
                      </text>
                    )}
                  </g>
                )
              })}

              {Object.entries(mc.mapPositions).map(([id, pos]) => {
                const s = settlementStats[id]
                const w = weight(s)
                const t = w / maxWeight
                const radius = 6 + t * 14
                const fillColor = w === 0 ? 'var(--pip-border-dim)' : intensityColor(t).color
                const opacity = w === 0 ? 0.3 : 1
                const settlement = mc.settlements[id]

                const parts: string[] = []
                if (s?.exactTurns) parts.push(`${s.exactTurns} turn${s.exactTurns === 1 ? '' : 's'}`)
                if (s?.reconstructedTurns) parts.push(`${s.reconstructedTurns} turn${s.reconstructedTurns === 1 ? '' : 's'} (log)`)
                if (s?.approxRuns) parts.push(`${s.approxRuns}/${approxRunTotal} runs`)
                const label = parts.length > 0 ? parts.join(' + ') : 'never'

                return (
                  <g key={id}>
                    <circle cx={pos.x} cy={pos.y} r={radius} fill={fillColor} opacity={opacity} />
                    <circle cx={pos.x} cy={pos.y} r={2} fill="var(--pip-bg-light)" />
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
            Settlement color/size = visit intensity (blue → red, same scale as chem prices). Road color = danger
            level (matches the in-game map); road thickness/×count = how often that road was actually traveled
            {isSingleRun ? ' during the turn range above' : ', summed across the runs shown above'}.
            {reconstructedRunTotal > 0 && ' "(log)" turns are reconstructed from a run\'s travel log text (no dedicated history for that run, but still turn-accurate).'}
          </div>
        </>
      )}
    </div>
  )
}
