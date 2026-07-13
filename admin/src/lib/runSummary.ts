import type { GameRow, GameState } from '@main/types/game'
import { GAME_MODES } from '@main/data/modes'

const DEFAULT_MAX_LOG_LINES = 4000
const DEFAULT_MAX_SNAPSHOT_LINES = 4000

// Evenly samples down to at most `max` items, always keeping the first and last, instead of just
// truncating the tail — a long run's late-game state (better gear, different road choices) is
// exactly what analysis cares most about, so cutting it off entirely would be worse than thinning
// it out across the whole run.
function sample<T>(items: T[], max: number): { sampled: T[]; omitted: number } {
  if (items.length <= max) return { sampled: items, omitted: 0 }
  if (max <= 1) return { sampled: items.slice(0, 1), omitted: items.length - 1 }
  const step = (items.length - 1) / (max - 1)
  const sampled: T[] = []
  for (let i = 0; i < max; i++) sampled.push(items[Math.round(i * step)])
  return { sampled, omitted: items.length - sampled.length }
}

// Builds a compact text summary of a run for an LLM to analyze — aggregate stats, per-turn
// wealth/gun/ammo snapshots, reconstructed road traversals (with each road's danger level, so
// the model can reason about risk-taking changing over the course of a run), and notable log
// lines. Routine purchase/sale lines are omitted to keep this well within context limits even for
// very long free-play runs. maxLogLines/maxSnapshotLines default generously (tuned for a
// large-context hosted model like Claude) but callers targeting a small local model should pass
// much lower caps — a weak model given a huge unstructured dump tends to lose the thread and
// drift into generic pretrained content instead of reasoning over what's actually there.
export function buildRunSummaryForAnalysis(
  row: GameRow,
  state: GameState,
  maxLogLines = DEFAULT_MAX_LOG_LINES,
  maxSnapshotLines = DEFAULT_MAX_SNAPSHOT_LINES,
): string {
  const mc = state.mode ? GAME_MODES[state.mode] : null
  const lines: string[] = []

  lines.push(`# Run: ${row.character_name}`)
  lines.push(
    `Mode: ${state.mode} | Type: ${state.gameType} | Status: ${row.status} | ` +
    `Final score: ${row.final_score ?? 'n/a'} | Turns reached: ${row.turns_reached ?? state.world.turn}`,
  )
  lines.push('')

  lines.push('## Aggregate stats (RunStats)')
  lines.push(JSON.stringify(state.stats, null, 2))
  lines.push('')

  const fullHistory = state.history
  if (fullHistory && fullHistory.length > 1) {
    const { sampled: history, omitted: snapshotsOmitted } = sample(fullHistory, maxSnapshotLines)
    lines.push('## Per-turn snapshots (caps / debt / xp / guns owned / cumulative trade profit)')
    if (snapshotsOmitted > 0) lines.push(`(sampled ${history.length} of ${fullHistory.length} turns, evenly spaced, to stay concise)`)
    for (const h of history) {
      lines.push(`T${h.turn}: caps=${h.caps} debt=${h.debt} xp=${h.xp} guns=${Object.keys(h.ownedGunAmmo).length} tradeProfitToDate=${h.tradeProfitToDate}`)
    }
    lines.push('')

    if (mc) {
      // Road traversals are reconstructed from the FULL history (consecutive real turns), not
      // the sampled subset above, so thinning the snapshot list never drops a road segment.
      lines.push('## Road traversals (with each road\'s fixed danger level, 0-1)')
      const roadLines: string[] = []
      for (let i = 0; i < fullHistory.length - 1; i++) {
        const a = fullHistory[i].location
        const b = fullHistory[i + 1].location
        if (a === b) continue
        const road = mc.roads.find(r => (r.from === a && r.to === b) || (r.from === b && r.to === a))
        roadLines.push(road
          ? `T${fullHistory[i].turn}->T${fullHistory[i + 1].turn}: ${a} -> ${b} via "${road.name}" (danger=${road.dangerLevel})`
          : `T${fullHistory[i].turn}->T${fullHistory[i + 1].turn}: ${a} -> ${b} (road not found in mode config)`)
      }
      const { sampled: sampledRoads, omitted: roadsOmitted } = sample(roadLines, maxSnapshotLines)
      if (roadsOmitted > 0) lines.push(`(sampled ${sampledRoads.length} of ${roadLines.length} traversals, evenly spaced, to stay concise)`)
      lines.push(...sampledRoads)
      lines.push('')
    }
  } else {
    lines.push('## Per-turn snapshots: not tracked for this run (it predates history tracking)')
    lines.push('')
  }

  lines.push('## Notable log lines (danger + profit events; routine buy/sell "info" lines omitted)')
  const notable = state.log.filter(l => l.type !== 'info').map(l => `T${l.turn} [${l.type}] ${l.message}`)
  const truncated = notable.length > maxLogLines
  for (const line of notable.slice(0, maxLogLines)) lines.push(line)
  if (truncated) lines.push(`... (${notable.length - maxLogLines} more lines omitted for length)`)

  return lines.join('\n')
}

export const ANALYSIS_SYSTEM_PROMPT = `You are a game design analyst reviewing a play session of "Chem Caravan", a Fallout-themed wasteland trading-and-combat game. You'll be given a run's aggregate stats, per-turn wealth/gun/ammo snapshots, reconstructed road traversals (each with a fixed 0-1 danger level), and notable log events (combat/danger lines and profit highlights — routine purchases are omitted).

Base your analysis ONLY on the data provided below. Do not reference Fallout Tactics, any other Fallout game, or any external lore, mechanics, or content — everything you need is in the data. If the data is insufficient to say something, say so rather than inventing detail.

Write exactly three short paragraphs, in this order, each 2-4 sentences:
1. Trading strategy and efficiency — what did they buy/sell, was it profitable, how did wealth trend over the run.
2. Combat performance and risk tolerance — how they fared in fights, and whether their road choices shifted over the run (e.g. avoiding high-danger routes early on and favoring them later once better armed/equipped — check the data for this specifically and say clearly whether or not it happened).
3. The single most notable turning point in the run, with a turn number.

No headers, no bullet points, no restating raw numbers that are already visible elsewhere in the UI — just the three paragraphs of analysis.

The user may ask follow-up questions after your initial analysis — answer those using the same run data and the same grounding rule above.`
