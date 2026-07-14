import type { GameModeId, GameState, GameType } from '@main/types/game'
import type { RunStats } from '@main/types/stats'
import { GAME_MODES, type GameModeConfig } from '@main/data/modes'
import { cumulativeTradeProfit } from '@main/engine/statsReducer'
import { calculateNetWorth } from '@main/engine/economy'

// Compact, scalar/aggregate-only digest of a single run — deliberately tighter than even the
// admin tool's local-LLM prompt trimming (see admin/src/lib/runSummary.ts), since this runs on
// every recap click rather than an opt-in deep-dive session. No raw per-turn arrays, no full log
// text, no Record<string,...> maps.
export interface RunPlaystyleDigest {
  characterName: string
  mode: GameModeId
  gameType: GameType
  outcome: 'won' | 'dead' | 'bankrupt'
  endReasonText: string | null
  turnsSurvived: number
  finalScore: number
  netWorth: number

  combatsFought: number
  combatsWon: number
  combatsFled: number
  totalKills: number
  secondWavesDefeated: number
  checkpointCombatsWon: number
  guardsOnlyWins: number
  turnsWithoutFight: number
  totalDamageDealt: number
  totalDamageTaken: number

  turnsInDebt: number
  totalPayrollPaid: number
  tradeProfitTotal: number
  topChemByProfit: { id: string; profit: number } | null
  lifetimeCapsEarned: number

  // Derived from combatReplays[].steps (enemy_attack events targeting the player) — not a
  // tracked stat field today. Normalized against the run's FINAL player.maxHealth for every
  // combat, which is an approximation if maxHealth ever changed mid-run.
  closestCall: { turn: number; hpPercent: number; combatOutcome: 'won' | 'fled' | 'lost' } | null

  // Derived from gameState.history (TurnSnapshot[], already carries `location` per turn) +
  // GAME_MODES[mode].roads. A run finishing today always has `history`, so no log-text
  // reconstruction fallback is needed here (unlike the admin heatmap's legacy-run handling).
  avgRoadDangerFirstHalf: number | null
  avgRoadDangerSecondHalf: number | null
  roadTrendNote: 'bolder' | 'more_cautious' | 'steady' | 'insufficient_data'
}

function computeClosestCall(state: GameState): RunPlaystyleDigest['closestCall'] {
  let best: { turn: number; hp: number; outcome: 'won' | 'fled' | 'lost' } | null = null

  for (const replay of state.combatReplays ?? []) {
    let runningHp = replay.initialRoster.playerHealth
    let minHp = runningHp
    for (const step of replay.steps) {
      if (step.kind === 'enemy_attack' && step.targetKind === 'player') {
        runningHp = step.targetHealthAfter
        if (runningHp < minHp) minHp = runningHp
      }
    }
    if (!best || minHp < best.hp) best = { turn: replay.turn, hp: minHp, outcome: replay.outcome }
  }

  if (!best) return null
  const maxHealth = Math.max(1, state.player.maxHealth)
  return {
    turn: best.turn,
    hpPercent: Math.max(0, Math.round((best.hp / maxHealth) * 100)),
    combatOutcome: best.outcome,
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function computeRoadDangerTrend(
  state: GameState,
  mc: GameModeConfig,
): Pick<RunPlaystyleDigest, 'avgRoadDangerFirstHalf' | 'avgRoadDangerSecondHalf' | 'roadTrendNote'> {
  const history = state.history
  const insufficient = { avgRoadDangerFirstHalf: null, avgRoadDangerSecondHalf: null, roadTrendNote: 'insufficient_data' as const }
  if (!history || history.length < 4) return insufficient

  // Build the full sequence of road-danger values actually traveled, in turn order, THEN split
  // it in half — splitting the raw TurnSnapshot array first could straddle a single traversal
  // across the boundary awkwardly.
  const dangers: number[] = []
  for (let i = 0; i < history.length - 1; i++) {
    const a = history[i].location
    const b = history[i + 1].location
    if (a === b) continue
    const road = mc.roads.find(r => (r.from === a && r.to === b) || (r.from === b && r.to === a))
    if (road) dangers.push(road.dangerLevel)
  }
  if (dangers.length < 2) return insufficient

  const mid = Math.floor(dangers.length / 2)
  const firstHalf = dangers.slice(0, mid)
  const secondHalf = dangers.slice(mid)
  const avg = (arr: number[]) => arr.reduce((s, x) => s + x, 0) / arr.length
  const avgFirst = avg(firstHalf)
  const avgSecond = avg(secondHalf)

  const EPS = 0.05 // avoids noise-driven flips on short runs
  const roadTrendNote =
    avgSecond - avgFirst > EPS ? 'bolder' :
    avgFirst - avgSecond > EPS ? 'more_cautious' :
    'steady'

  return { avgRoadDangerFirstHalf: round2(avgFirst), avgRoadDangerSecondHalf: round2(avgSecond), roadTrendNote }
}

export function buildRunPlaystyleDigest(state: GameState, outcome: 'won' | 'dead' | 'bankrupt'): RunPlaystyleDigest {
  const mc = GAME_MODES[state.mode]
  const stats: RunStats = state.stats
  const isFreePlay = state.gameType === 'free_play'
  const netWorth = calculateNetWorth(state.player, mc)
  const finalScore = isFreePlay ? (state.player.xp ?? 0) : netWorth

  const chemEntries = Object.entries(stats.chemsSold)
  const topChemByProfit = chemEntries.length > 0
    ? chemEntries.reduce<{ id: string; profit: number } | null>(
        (best, [id, s]) => (!best || s.profitEarned > best.profit) ? { id, profit: s.profitEarned } : best,
        null,
      )
    : null

  return {
    characterName: state.player.name,
    mode: state.mode,
    gameType: state.gameType,
    outcome,
    endReasonText: state.endReason,
    turnsSurvived: state.world.turn,
    finalScore,
    netWorth,

    combatsFought: stats.combatsFought,
    combatsWon: stats.combatsWon,
    combatsFled: stats.combatsFled,
    totalKills: stats.totalKills,
    secondWavesDefeated: stats.secondWavesDefeated,
    checkpointCombatsWon: stats.checkpointCombatsWon,
    guardsOnlyWins: stats.guardsOnlyWins,
    turnsWithoutFight: stats.turnsWithoutFight,
    totalDamageDealt: stats.totalDamageDealt,
    totalDamageTaken: stats.totalDamageTaken,

    turnsInDebt: stats.turnsInDebt,
    totalPayrollPaid: stats.totalPayrollPaid,
    tradeProfitTotal: cumulativeTradeProfit(stats),
    topChemByProfit,
    lifetimeCapsEarned: stats.lifetimeCapsEarned,

    closestCall: computeClosestCall(state),
    ...computeRoadDangerTrend(state, mc),
  }
}

// ── Baseline profile (player's history) ─────────────────────────────────────────────────────

export interface BaselineRow {
  status: 'active' | 'won' | 'dead' | 'bankrupt'
  final_score: number | null
  turns_reached: number | null
  mode: GameModeId | null
  game_type: GameType
  created_at: string
  stats: RunStats | null
}

export interface PlayerBaselineProfile {
  runCount: number
  gameTypeFiltered: GameType
  winRate: number | null
  avgTurnsSurvived: number | null
  avgScore: number | null
  bestScore: number | null
  mostPlayedMode: GameModeId | null
  outcomeCounts: { won: number; dead: number; bankrupt: number }
  avgCombatWinRate: number | null
  avgDamageTakenRatio: number | null
  avgFledRate: number | null
  earlyDeathRate: number | null
}

// Free play has no maxTurns to scale against, so a flat constant is simplest for v1.
const EARLY_DEATH_TURN_THRESHOLD = 10

function average(values: number[]): number | null {
  return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null
}

export function buildPlayerBaselineProfile(rows: BaselineRow[], gameType: GameType): PlayerBaselineProfile {
  const runCount = rows.length
  const outcomeCounts = { won: 0, dead: 0, bankrupt: 0 }
  if (runCount === 0) {
    return {
      runCount: 0, gameTypeFiltered: gameType, winRate: null, avgTurnsSurvived: null, avgScore: null,
      bestScore: null, mostPlayedMode: null, outcomeCounts, avgCombatWinRate: null,
      avgDamageTakenRatio: null, avgFledRate: null, earlyDeathRate: null,
    }
  }

  const modeCounts: Partial<Record<GameModeId, number>> = {}
  let turnsSum = 0
  let scoreSum = 0
  let bestScore = -Infinity
  let earlyDeaths = 0
  let nonWonCount = 0
  const combatWinRates: number[] = []
  const damageTakenRatios: number[] = []
  const fledRates: number[] = []

  for (const row of rows) {
    if (row.status === 'won' || row.status === 'dead' || row.status === 'bankrupt') outcomeCounts[row.status]++
    if (row.mode) modeCounts[row.mode] = (modeCounts[row.mode] ?? 0) + 1

    const turns = row.turns_reached ?? 0
    turnsSum += turns
    const score = row.final_score ?? 0
    scoreSum += score
    if (score > bestScore) bestScore = score

    if (row.status !== 'won') {
      nonWonCount++
      if (turns <= EARLY_DEATH_TURN_THRESHOLD) earlyDeaths++
    }

    const s = row.stats
    if (s && s.combatsFought > 0) {
      combatWinRates.push(s.combatsWon / s.combatsFought)
      fledRates.push(s.combatsFled / s.combatsFought)
      const totalDamage = s.totalDamageDealt + s.totalDamageTaken
      if (totalDamage > 0) damageTakenRatios.push(s.totalDamageTaken / totalDamage)
    }
  }

  const mostPlayedMode = (Object.entries(modeCounts) as [GameModeId, number][])
    .sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  return {
    runCount,
    gameTypeFiltered: gameType,
    winRate: outcomeCounts.won / runCount,
    avgTurnsSurvived: turnsSum / runCount,
    avgScore: scoreSum / runCount,
    bestScore: bestScore === -Infinity ? null : bestScore,
    mostPlayedMode,
    outcomeCounts,
    avgCombatWinRate: average(combatWinRates),
    avgDamageTakenRatio: average(damageTakenRatios),
    avgFledRate: average(fledRates),
    earlyDeathRate: nonWonCount > 0 ? earlyDeaths / nonWonCount : null,
  }
}
