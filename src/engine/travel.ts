import { ROADS, SETTLEMENTS, type Road } from '../data/settlements'
import { TRAVEL_EVENT_DEFS, STASH_CHEMS, STASH_QUANTITY_MIN, STASH_QUANTITY_MAX, BROTHERHOOD_TOLL } from '../data/events'
import { CHEMS } from '../data/chems'
import { CONFIG } from '../data/config'
import type { PlayerState, TravelEvent } from '../types/game'
import { rng, rngInt, rngPick, rngWeightedPick } from './rng'

export function getAdjacentRoads(settlementId: string): Road[] {
  return ROADS.filter(r => r.from === settlementId || r.to === settlementId)
}

export function getRoadDestination(road: Road, currentLocation: string): string {
  return road.from === currentLocation ? road.to : road.from
}

export function calculateCapacity(brahmin: number): number {
  return CONFIG.BASE_CAPACITY + brahmin * CONFIG.CAPACITY_PER_BRAHMIN
}

export function totalInventoryItems(inventory: PlayerState['inventory']): number {
  return Object.values(inventory).reduce((sum, entry) => sum + entry.quantity, 0)
}

export function selectTravelEvent(
  road: Road,
  player: PlayerState,
): TravelEvent | null {
  // Force debt collector if debt is old enough
  if (player.ageOfDebt >= CONFIG.DEBT_COLLECTOR_MIN_AGE && rng() < CONFIG.DEBT_COLLECTOR_PROB) {
    const def = TRAVEL_EVENT_DEFS.find(e => e.type === 'debt_collector')!
    return { type: def.type, title: def.title, description: def.description }
  }

  const eventProb = CONFIG.EVENT_BASE_PROB + road.dangerLevel * CONFIG.EVENT_DANGER_SCALE
  if (rng() > eventProb) return null

  const eligible = TRAVEL_EVENT_DEFS.filter(
    e => e.weight > 0 && road.dangerLevel >= e.minDangerToTrigger
  )
  const chosen = rngWeightedPick(eligible)
  if (!chosen) return null

  return buildEventPayload(chosen.type, chosen.title, chosen.description, player)
}

function buildEventPayload(
  type: TravelEvent['type'],
  title: string,
  description: string,
  _player: PlayerState,
): TravelEvent {
  switch (type) {
    case 'chem_stash': {
      const chemId = rngPick(STASH_CHEMS)
      const qty = rngInt(STASH_QUANTITY_MIN, STASH_QUANTITY_MAX)
      return { type, title, description, payload: { chemId, qty } }
    }
    case 'brotherhood_checkpoint':
      return { type, title, description, payload: { toll: BROTHERHOOD_TOLL } }
    case 'wandering_merchant': {
      const chemIds = [...STASH_CHEMS].sort(() => rng() - 0.5).slice(0, 3)
      const isFence = rng() < 0.35

      if (isFence) {
        // SELLER: fence moving stolen goods cheap — player buys
        const prices: Record<string, number> = {}
        const stock:  Record<string, number> = {}
        chemIds.forEach(id => {
          prices[id] = Math.round((CHEMS[id].basePrice * (0.45 + rng() * 0.30)) / 5) * 5
          stock[id]  = rngInt(1, 5)
        })
        return {
          type,
          title:       'SUSPICIOUS PEDDLER',
          description: "A nervous figure waves you down from the shadows. 'Real cheap. Don't ask where it came from.'",
          payload: { prices, stock, isFence: true },
        }
      } else {
        // BUYER: strung-out traveler / addict with caps, paying premium — player sells
        const prices:  Record<string, number> = {}
        const demand:  Record<string, number> = {}
        chemIds.forEach(id => {
          prices[id] = Math.round((CHEMS[id].basePrice * (1.15 + rng() * 0.40)) / 5) * 5
          demand[id] = rngInt(1, 6)
        })
        return {
          type,
          title:       'DESPERATE BUYER',
          description: "A strung-out traveler stumbles toward your caravan, caps in hand. They need a fix — badly — and they're not haggling.",
          payload: { prices, demand, isFence: false },
        }
      }
    }
    default:
      return { type, title, description }
  }
}

export function dropExcessInventory(player: PlayerState): PlayerState {
  const capacity = calculateCapacity(player.brahmin)
  const current = totalInventoryItems(player.inventory)
  if (current <= capacity) return player

  // Drop cheapest items first (by pricePaid per unit)
  const inventory = { ...player.inventory }
  const entries = Object.entries(inventory)
    .filter(([, v]) => v.quantity > 0)
    .sort(([, a], [, b]) => a.pricePaid - b.pricePaid)

  let overflow = current - capacity
  for (const [chemId] of entries) {
    if (overflow <= 0) break
    const available = inventory[chemId].quantity
    const drop = Math.min(available, overflow)
    inventory[chemId] = { ...inventory[chemId], quantity: available - drop }
    if (inventory[chemId].quantity === 0) delete inventory[chemId]
    overflow -= drop
  }

  return { ...player, inventory }
}

export function loseBrahmin(player: PlayerState): PlayerState {
  if (player.brahmin === 0) return player
  const updated = { ...player, brahmin: player.brahmin - 1 }
  return dropExcessInventory(updated)
}

export function getSettlementName(id: string): string {
  return SETTLEMENTS[id]?.name ?? id
}
