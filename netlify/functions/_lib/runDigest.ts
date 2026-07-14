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
  // roadTrendNote is derived from travelPhases[0] vs. the last phase's avgRoadDanger.
  roadTrendNote: 'bolder' | 'more_cautious' | 'steady' | 'insufficient_data'

  // Splits the run into early/mid/late thirds (by turn-snapshot index) and reports each phase's
  // most-repeated route + what it earned — "where did they go, and what did that accomplish" is
  // a materially different (and better) question than one run-wide aggregate. A route with a real
  // economic edge (notableModifier) surfaces route-farming tactics an aggregate would flatten out
  // (e.g. shuttling between two settlements early to cash in on one's price modifier, then
  // shifting elsewhere once that stopped being the right call). Empty if history is too short to
  // split meaningfully.
  travelPhases: Array<{
    phase: 'early' | 'mid' | 'late'
    topRoute: {
      roadName: string
      settlementA: string
      settlementB: string
      timesTraveled: number
      notableModifier: { settlementName: string; priceModifier?: number; stockMultiplier?: number; availabilityBonus?: number } | null
    } | null
    tradeProfitDuring: number   // cumulative trade profit earned within this phase specifically, not run-to-date
    avgRoadDanger: number | null
  }>

  // "Key moments" — narrative color for turning points, distinct from aggregate totals above.
  // Both derived from data already fetched for this run, no extra cost.
  biggestProfitSwing: { turn: number; amount: number } | null
  worstCombatRound: { turn: number; hitRatePercent: number; shotsFired: number; damageTaken: number; damageDealt: number } | null

  // The single biggest "sold this chem here, then saw a better price for it later in the run"
  // instance — derived from history[].localPrices + history[].chemsSoldToDate (added alongside
  // this feature; older saves simply have empty {} for both on every snapshot, so this comes back
  // null for them, same graceful-degradation as travelPhases on a too-short run). Deliberately
  // scoped to prices the player actually saw by passing through a settlement later in the run —
  // not an omniscient full-map price check — so the "you could have gotten more" claim reflects a
  // choice the player could plausibly have made (carry it one more stop) rather than hindsight
  // they had no way to act on.
  missedSale: {
    turn: number
    chemId: string
    qty: number
    pricePerUnit: number
    betterTurn: number
    betterSettlementName: string
    betterPricePerUnit: number
    missedProfit: number
  } | null
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

type TopRoute = NonNullable<RunPlaystyleDigest['travelPhases'][number]['topRoute']>
type Snapshot = GameState['history'][number]

// Most-repeated road segment within a slice of history, plus that slice's average road danger —
// shared by every phase in computeTravelPhases so the pair-walk logic lives in one place.
function findTopRoute(historySlice: Snapshot[], mc: GameModeConfig): { route: TopRoute | null; avgDanger: number | null } {
  const counts = new Map<string, number>()
  const dangers: number[] = []
  for (let i = 0; i < historySlice.length - 1; i++) {
    const a = historySlice[i].location
    const b = historySlice[i + 1].location
    if (a === b) continue
    const road = mc.roads.find(r => (r.from === a && r.to === b) || (r.from === b && r.to === a))
    if (road) {
      counts.set(road.id, (counts.get(road.id) ?? 0) + 1)
      dangers.push(road.dangerLevel)
    }
  }
  const avgDanger = dangers.length > 0 ? round2(dangers.reduce((s, x) => s + x, 0) / dangers.length) : null
  if (counts.size === 0) return { route: null, avgDanger }

  const [topRoadId, timesTraveled] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]
  if (timesTraveled < 2) return { route: null, avgDanger } // a single one-off trip isn't a "route"

  const road = mc.roads.find(r => r.id === topRoadId)!
  const settlementA = mc.settlements[road.from]
  const settlementB = mc.settlements[road.to]

  // Flag whichever endpoint has a real economic edge (cheaper prices, more stock, better
  // availability) — the likely reason a route got farmed this hard, if one exists.
  const hasEdge = (s: typeof settlementA) => s && (
    (s.priceModifier !== undefined && s.priceModifier !== 1) ||
    (s.stockMultiplier !== undefined && s.stockMultiplier !== 1) ||
    (s.availabilityBonus !== undefined && s.availabilityBonus !== 0)
  )
  const edgeSettlement = hasEdge(settlementA) ? settlementA : hasEdge(settlementB) ? settlementB : null

  return {
    route: {
      roadName: road.name,
      settlementA: settlementA?.name ?? road.from,
      settlementB: settlementB?.name ?? road.to,
      timesTraveled,
      notableModifier: edgeSettlement
        ? {
            settlementName: edgeSettlement.name,
            priceModifier: edgeSettlement.priceModifier,
            stockMultiplier: edgeSettlement.stockMultiplier,
            availabilityBonus: edgeSettlement.availabilityBonus,
          }
        : null,
    },
    avgDanger,
  }
}

// Splits history into early/mid/late thirds by snapshot index (adjacent phases deliberately
// share their boundary snapshot — every traversal still lands in exactly one phase, since a
// phase's pair-walk only ever covers pairs strictly within its own slice, and per-phase profit
// deltas still sum to the run total either way). Each phase reports its own top route (via
// findTopRoute) and how much trade profit it specifically earned, not the running total.
function computeTravelPhases(
  state: GameState,
  mc: GameModeConfig,
): { travelPhases: RunPlaystyleDigest['travelPhases']; roadTrendNote: RunPlaystyleDigest['roadTrendNote'] } {
  const history = state.history
  if (!history || history.length < 6) return { travelPhases: [], roadTrendNote: 'insufficient_data' }

  const n = history.length
  const b1 = Math.floor(n / 3)
  const b2 = Math.floor((2 * n) / 3)
  const bounds: Array<[number, number, 'early' | 'mid' | 'late']> = [[0, b1, 'early'], [b1, b2, 'mid'], [b2, n - 1, 'late']]

  const travelPhases = bounds.map(([startIdx, endIdx, phase]) => {
    const slice = history.slice(startIdx, endIdx + 1)
    const { route, avgDanger } = findTopRoute(slice, mc)
    const tradeProfitDuring = slice.length > 0 ? slice[slice.length - 1].tradeProfitToDate - slice[0].tradeProfitToDate : 0
    return { phase, topRoute: route, tradeProfitDuring, avgRoadDanger: avgDanger }
  })

  const firstDanger = travelPhases[0].avgRoadDanger
  const lastDanger = travelPhases[travelPhases.length - 1].avgRoadDanger
  const EPS = 0.05 // avoids noise-driven flips on short runs
  const roadTrendNote =
    firstDanger === null || lastDanger === null ? 'insufficient_data' :
    lastDanger - firstDanger > EPS ? 'bolder' :
    firstDanger - lastDanger > EPS ? 'more_cautious' :
    'steady'

  return { travelPhases, roadTrendNote }
}

// Biggest single-turn jump in cumulative trade profit — a cheap, reliable proxy for "made a
// killing off a market event" without needing to identify which event caused it.
function computeBiggestProfitSwing(state: GameState): RunPlaystyleDigest['biggestProfitSwing'] {
  const history = state.history
  if (!history || history.length < 2) return null

  let best: { turn: number; amount: number } | null = null
  for (let i = 1; i < history.length; i++) {
    const amount = history[i].tradeProfitToDate - history[i - 1].tradeProfitToDate
    if (amount > 0 && (!best || amount > best.amount)) best = { turn: history[i].turn, amount }
  }
  return best
}

// The single combat with the worst hit rate among the player's own side (player/guard/pa_guard
// shots) — a "bad rolls" luck signal distinct from closestCall (which tracks lowest HP reached,
// regardless of cause). 'blast' steps are excluded — splash weapons always connect on the
// primary target, so there's no hit/miss signal to read there. Requires at least 3 shots in a
// replay to avoid a single lucky/unlucky shot reading as a "round."
function computeWorstCombatRound(state: GameState): RunPlaystyleDigest['worstCombatRound'] {
  let worst: { turn: number; hitRatePercent: number; shotsFired: number; damageTaken: number; damageDealt: number } | null = null

  for (const replay of state.combatReplays ?? []) {
    let fired = 0
    let hit = 0
    for (const step of replay.steps) {
      if (step.kind === 'shot' && (step.by === 'player' || step.by === 'guard' || step.by === 'pa_guard')) {
        fired++
        if (step.hit) hit++
      } else if (step.kind === 'burst' || step.kind === 'pa_burst') {
        for (const s of step.shots) {
          fired++
          if (s.hit) hit++
        }
      }
    }
    if (fired < 3) continue
    const hitRatePercent = Math.round((hit / fired) * 100)
    if (!worst || hitRatePercent < worst.hitRatePercent) {
      worst = { turn: replay.turn, hitRatePercent, shotsFired: fired, damageTaken: replay.totalDamageTaken, damageDealt: replay.totalDamageDealt }
    }
  }
  return worst
}

// Finds the single biggest missed-sale regret: a chem sold on turn T, where a later turn's
// snapshot (i.e. somewhere the player actually visited afterward) shows a higher local price for
// the same chem. Per-turn sale qty/price is recovered by diffing consecutive chemsSoldToDate
// snapshots rather than needing a separate per-transaction log — a turn's local price is what any
// sale that turn actually paid, since prices only change on travel (see completeTravel).
function computeMissedSale(state: GameState, mc: GameModeConfig): RunPlaystyleDigest['missedSale'] {
  const history = state.history
  if (!history || history.length < 2) return null

  type PricePoint = { turn: number; location: string; price: number }
  const pricesByChem = new Map<string, PricePoint[]>()
  for (const snap of history) {
    for (const [chemId, price] of Object.entries(snap.localPrices ?? {})) {
      const arr = pricesByChem.get(chemId) ?? []
      arr.push({ turn: snap.turn, location: snap.location, price })
      pricesByChem.set(chemId, arr)
    }
  }

  let best: RunPlaystyleDigest['missedSale'] = null
  for (let i = 1; i < history.length; i++) {
    const prevSold = history[i - 1].chemsSoldToDate ?? {}
    const curSold = history[i].chemsSoldToDate ?? {}
    for (const [chemId, cur] of Object.entries(curSold)) {
      const prev = prevSold[chemId]
      const qtyDelta = cur.qty - (prev?.qty ?? 0)
      const capsDelta = cur.capsEarned - (prev?.capsEarned ?? 0)
      if (qtyDelta <= 0) continue
      const pricePerUnit = capsDelta / qtyDelta
      const saleTurn = history[i].turn

      const laterPrices = (pricesByChem.get(chemId) ?? []).filter(p => p.turn > saleTurn)
      if (laterPrices.length === 0) continue
      const better = laterPrices.reduce((a, b) => (b.price > a.price ? b : a))
      if (better.price <= pricePerUnit) continue

      const missedProfit = (better.price - pricePerUnit) * qtyDelta
      if (!best || missedProfit > best.missedProfit) {
        best = {
          turn: saleTurn,
          chemId,
          qty: qtyDelta,
          pricePerUnit: round2(pricePerUnit),
          betterTurn: better.turn,
          betterSettlementName: mc.settlements[better.location]?.name ?? better.location,
          betterPricePerUnit: better.price,
          missedProfit: Math.round(missedProfit),
        }
      }
    }
  }
  return best
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
    ...computeTravelPhases(state, mc),

    biggestProfitSwing: computeBiggestProfitSwing(state),
    worstCombatRound: computeWorstCombatRound(state),
    missedSale: computeMissedSale(state, mc),
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
