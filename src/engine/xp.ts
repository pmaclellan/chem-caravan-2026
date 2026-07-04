import type { GameType, PlayerState } from '../types/game'
import type { RunStats, XpBySource } from '../types/stats'

export const XpEventType = {
  RoadTravel:          'road_travel',
  CombatVictory:       'combat_victory',
  SettlementDiscovery: 'settlement_discovery',
  TradeProfit:         'trade_profit',
} as const

export type XpEventType = typeof XpEventType[keyof typeof XpEventType]

const XP_CONFIG = {
  ROAD_TRAVEL_FACTOR:    30,
  COMBAT_BASE:           50,
  COMBAT_COUNT_BONUS:    0.10,
  SETTLEMENT_DISCOVERY:  50,
  TRADE_PROFIT_DIVISOR:   3,
} as const

// scaleFactor = 1 in standard games; ramps up in Free Play as turns increase.
export function getScaleFactor(turn: number, gameType: GameType): number {
  if (gameType !== 'free_play') return 1
  return 1 + turn / 60
}

export type XpEventParams =
  | { type: 'road_travel';          dangerLevel: number; scaleFactor: number }
  | { type: 'combat_victory';       xpFromKills: number; killCount: number }
  | { type: 'settlement_discovery'; settlementName: string }
  | { type: 'trade_profit';         profit: number }

export function calculateXp(event: XpEventParams): number {
  switch (event.type) {
    case XpEventType.RoadTravel:
      return Math.floor(event.dangerLevel * event.scaleFactor * XP_CONFIG.ROAD_TRAVEL_FACTOR)
    case XpEventType.CombatVictory: {
      const countBonus = 1 + XP_CONFIG.COMBAT_COUNT_BONUS * Math.max(0, event.killCount - 1)
      return Math.floor((XP_CONFIG.COMBAT_BASE + event.xpFromKills * countBonus))
    }
    case XpEventType.SettlementDiscovery:
      return XP_CONFIG.SETTLEMENT_DISCOVERY
    case XpEventType.TradeProfit:
      return Math.floor(event.profit / XP_CONFIG.TRADE_PROFIT_DIVISOR)
  }
}

function logMessage(event: XpEventParams, amount: number): string {
  switch (event.type) {
    case XpEventType.RoadTravel:
      return `+${amount} XP — road taken.`
    case XpEventType.CombatVictory:
      return `+${amount} XP — combat victory!`
    case XpEventType.SettlementDiscovery:
      return `+${amount} XP — first visit to ${event.settlementName}!`
    case XpEventType.TradeProfit:
      return `+${amount} XP — trade profit.`
  }
}

type XpCategory = keyof XpBySource

function xpCategoryFor(type: XpEventType): XpCategory {
  if (type === 'combat_victory') return 'combat'
  if (type === 'trade_profit')   return 'trade'
  return 'travel' // road_travel, settlement_discovery
}

// Adds XP to a specific source bucket — use for achievement XP not routed through awardXp.
export function addXpToStats(stats: RunStats, amount: number, category: XpCategory): RunStats {
  if (amount <= 0) return stats
  return {
    ...stats,
    xpBySource: { ...stats.xpBySource, [category]: (stats.xpBySource?.[category] ?? 0) + amount },
  }
}

// Returns updated player, stats, and a log message.
export function awardXp(
  player: PlayerState,
  stats: RunStats,
  event: XpEventParams,
): { player: PlayerState; stats: RunStats; logMessage: string | null } {
  const amount = calculateXp(event)
  if (amount <= 0) return { player, stats, logMessage: null }
  return {
    player: { ...player, xp: player.xp + amount },
    stats: addXpToStats(stats, amount, xpCategoryFor(event.type)),
    logMessage: logMessage(event, amount),
  }
}
