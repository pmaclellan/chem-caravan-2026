// Legacy runs predate GameState.history (the per-turn TurnSnapshot[] time series) but they DO
// have state.log — that field has existed since the project's first commit. Every turn the
// player travels, gameLoop.ts's completeTravel() pushes exactly one log line in this format:
//
//   log.push(makeLog(turn, `Arrived at ${destName}.`, 'info'))
//
// (destName is normally the settlement's display name, e.g. "Diamond City" — see
// src/engine/gameLoop.ts. It only ever falls back to the raw settlement id if the destination is
// missing from that mode's settlement config, which shouldn't happen in practice; if it does,
// the line just won't match any known settlement name and gets skipped below rather than
// mis-parsed.) That's enough to reconstruct a near-exact per-turn location sequence for old runs
// too: parse every "Arrived at X." line in turn order and map X back to a settlement id via that
// run's own mode's settlement list.
//
// This is a pure, read-only, on-the-fly reconstruction — nothing is written back to Supabase.
// It's computed client-side exactly like the existing binary `visitedSettlements` fallback is.

import type { GameModeId, GameState } from '@main/types/game'
import { GAME_MODES } from '@main/data/modes'

const ARRIVED_AT_RE = /^Arrived at (.+)\.$/

export interface ReconstructedTurn {
  turn: number
  location: string
}

// Settlement display-name -> id, one map per mode. Modes are static config (never change at
// runtime), so this is safe to build once and reuse across every row scanned in a heatmap pass
// instead of rebuilding it per row.
const nameToIdByMode = new Map<GameModeId, Map<string, string>>()

function nameToIdForMode(modeId: GameModeId): Map<string, string> {
  let map = nameToIdByMode.get(modeId)
  if (!map) {
    map = new Map()
    const mc = GAME_MODES[modeId]
    for (const settlement of Object.values(mc.settlements)) {
      map.set(settlement.name, settlement.id)
    }
    nameToIdByMode.set(modeId, map)
  }
  return map
}

// Returns a turn-ordered location sequence reconstructed from state.log, or null if the log has
// no parseable "Arrived at" lines (nothing to reconstruct — caller should fall back further).
// Turn 1's starting settlement is never logged (the player starts there rather than traveling
// there), so it's prepended here whenever we found at least one real match, to avoid silently
// undercounting every run's starting settlement.
export function reconstructLocationSequenceFromLog(
  state: GameState,
  modeId: GameModeId,
): ReconstructedTurn[] | null {
  const log = state?.log
  if (!log || log.length === 0) return null

  const nameToId = nameToIdForMode(modeId)
  const sequence: ReconstructedTurn[] = []

  for (const entry of log) {
    if (entry.type !== 'info') continue
    const match = ARRIVED_AT_RE.exec(entry.message)
    if (!match) continue
    const settlementId = nameToId.get(match[1])
    if (!settlementId) continue // unrecognized name for this mode — skip rather than guess
    sequence.push({ turn: entry.turn, location: settlementId })
  }

  if (sequence.length === 0) return null

  const mc = GAME_MODES[modeId]
  const startLocation = mc.startingLocation
  if (sequence[0].location !== startLocation || sequence[0].turn !== 1) {
    sequence.unshift({ turn: 1, location: startLocation })
  }

  return sequence
}
