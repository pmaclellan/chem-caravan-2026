import { CHEMS, CHEM_IDS } from '../data/chems'
import { CONFIG } from '../data/config'
import type { MarketEvent, SettlementMarket, WorldState } from '../types/game'
import { rng, rngBetween, rngInt, rngPick } from './rng'

export function initializeMarket(turn: number): SettlementMarket {
  const prices: Record<string, number> = {}
  const stock: Record<string, number> = {}

  for (const chemId of CHEM_IDS) {
    const chem = CHEMS[chemId]
    if (rng() < chem.availability) {
      const variance = (rng() - 0.5) * 2 * chem.priceVariance
      prices[chemId] = Math.round((chem.basePrice * (1 + variance)) / 5) * 5
      stock[chemId] = rngInt(1, chem.maxStock)
    }
  }

  return { prices, stock, lastRefreshed: turn }
}

export function refreshMarket(_existing: SettlementMarket, turn: number): SettlementMarket {
  return initializeMarket(turn)
}

export function applyMarketEvents(
  market: SettlementMarket,
  events: MarketEvent[],
  settlementId: string,
): SettlementMarket {
  const prices = { ...market.prices }

  for (const event of events) {
    if (event.settlementId !== null && event.settlementId !== settlementId) continue
    if (!(event.chemId in prices)) continue
    prices[event.chemId] = Math.round((prices[event.chemId] * event.multiplier) / 5) * 5
  }

  return { ...market, prices }
}

export function generateMarketEvent(turn: number): MarketEvent | null {
  if (rng() > CONFIG.MARKET_EVENT_PROB_PER_TURN) return null

  const chemId = rngPick(CHEM_IDS)
  const chem = CHEMS[chemId]
  const isShortage = rng() < 0.5
  const duration = rngInt(CONFIG.MARKET_EVENT_DURATION_MIN, CONFIG.MARKET_EVENT_DURATION_MAX)

  if (isShortage) {
    const multiplier = rngBetween(CONFIG.SHORTAGE_MULTIPLIER_MIN, CONFIG.SHORTAGE_MULTIPLIER_MAX)
    return {
      id: `evt_${turn}_${chemId}_shortage`,
      type: 'shortage',
      chemId,
      settlementId: null,
      multiplier,
      turnsRemaining: duration,
      message: chem.highPriceMsg,
    }
  } else {
    const multiplier = rngBetween(CONFIG.SURPLUS_MULTIPLIER_MIN, CONFIG.SURPLUS_MULTIPLIER_MAX)
    return {
      id: `evt_${turn}_${chemId}_surplus`,
      type: 'surplus',
      chemId,
      settlementId: null,
      multiplier,
      turnsRemaining: duration,
      message: chem.lowPriceMsg,
    }
  }
}

export function tickMarketEvents(events: MarketEvent[]): MarketEvent[] {
  return events
    .map(e => ({ ...e, turnsRemaining: e.turnsRemaining - 1 }))
    .filter(e => e.turnsRemaining > 0)
}

export function updateWorldMarkets(world: WorldState): WorldState {
  // Tick existing events and maybe add a new one
  let events = tickMarketEvents(world.activeMarketEvents)
  const newEvent = generateMarketEvent(world.turn)
  if (newEvent) events = [...events, newEvent]

  return { ...world, activeMarketEvents: events }
}
