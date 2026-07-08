import { CHEMS } from '../data/chems'
import type { GameModeConfig } from '../data/modes'
import type { MarketEvent, SettlementMarket, WorldState } from '../types/game'
import { rng, rngBetween, rngInt, rngPick } from './rng'

// Turns of full-price absence needed to fully recover a chem bought down to 0 (see refreshMarket).
export const RECOVERY_TURNS_TO_FULL = 5

export function initializeMarket(
  turn: number,
  availableChemIds: string[],
  priceModifier = 1.0,
  stockMultiplier = 1.0,
  availabilityBonus = 0,
): SettlementMarket {
  const prices: Record<string, number> = {}
  const stock: Record<string, number> = {}

  for (const chemId of availableChemIds) {
    const chem = CHEMS[chemId]
    if (rng() < Math.min(1, chem.availability + availabilityBonus)) {
      const variance = (rng() - 0.5) * 2 * chem.priceVariance
      prices[chemId] = Math.round((chem.basePrice * (1 + variance) * priceModifier) / 5) * 5
      stock[chemId] = rngInt(1, Math.max(1, Math.round(chem.maxStock * stockMultiplier)))
    }
  }

  return { prices, stock, lastRefreshed: turn, depletion: {} }
}

// Rolls a fresh market same as initializeMarket, then suppresses stock by any still-remaining
// purchase debt (see updateSettlementDepletion in gameStore.ts) — debt decays continuously with
// turns elapsed since the settlement was last visited, never resetting to full on a mere visit.
export function refreshMarket(
  existing: SettlementMarket,
  turn: number,
  availableChemIds: string[],
  priceModifier = 1.0,
  stockMultiplier = 1.0,
  availabilityBonus = 0,
): SettlementMarket {
  const fresh = initializeMarket(turn, availableChemIds, priceModifier, stockMultiplier, availabilityBonus)
  const turnsElapsed = Math.max(0, turn - existing.lastRefreshed)
  const stock = { ...fresh.stock }
  const depletion: Record<string, number> = {}

  for (const [chemId, debt] of Object.entries(existing.depletion ?? {})) {
    const chem = CHEMS[chemId]
    if (!chem || debt <= 0) continue
    const recoveryRate = chem.maxStock / RECOVERY_TURNS_TO_FULL
    const remainingDebt = Math.max(0, debt - recoveryRate * turnsElapsed)
    if (remainingDebt <= 0) continue
    depletion[chemId] = remainingDebt
    if (stock[chemId] !== undefined) {
      stock[chemId] = Math.max(0, Math.floor(stock[chemId] - remainingDebt))
    }
  }

  return { ...fresh, stock, depletion }
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

export function generateMarketEvent(turn: number, modeConfig: GameModeConfig): MarketEvent | null {
  if (rng() > modeConfig.marketEventProbPerTurn) return null

  const chemId = rngPick(modeConfig.availableChemIds)
  const chem = CHEMS[chemId]
  const isShortage = rng() < 0.5
  const duration = rngInt(modeConfig.marketEventDurationMin, modeConfig.marketEventDurationMax)

  const overrides = chem.msgOverrides?.[modeConfig.id]
  if (isShortage) {
    const multiplier = rngBetween(modeConfig.shortageMultiplierMin, modeConfig.shortageMultiplierMax)
    return {
      id: `evt_${turn}_${chemId}_shortage`,
      type: 'shortage',
      chemId,
      settlementId: null,
      multiplier,
      turnsRemaining: duration,
      message: overrides?.high ?? chem.highPriceMsg,
    }
  } else {
    const multiplier = rngBetween(modeConfig.surplusMultiplierMin, modeConfig.surplusMultiplierMax)
    return {
      id: `evt_${turn}_${chemId}_surplus`,
      type: 'surplus',
      chemId,
      settlementId: null,
      multiplier,
      turnsRemaining: duration,
      message: overrides?.low ?? chem.lowPriceMsg,
    }
  }
}

export function tickMarketEvents(events: MarketEvent[]): MarketEvent[] {
  return events
    .map(e => ({ ...e, turnsRemaining: e.turnsRemaining - 1 }))
    .filter(e => e.turnsRemaining > 0)
}

export function updateWorldMarkets(world: WorldState, modeConfig: GameModeConfig): WorldState {
  let events = tickMarketEvents(world.activeMarketEvents)
  const newEvent = generateMarketEvent(world.turn, modeConfig)
  if (newEvent) events = [...events, newEvent]

  return { ...world, activeMarketEvents: events }
}
