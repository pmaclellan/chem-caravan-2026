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
      // 35% chance the merchant is fencing stolen goods at knockdown prices
      const isFence = rng() < 0.35
      const prices: Record<string, number> = {}
      chemIds.forEach(id => {
        prices[id] = isFence
          ? Math.round((CHEMS[id].basePrice * (0.45 + rng() * 0.30)) / 5) * 5  // 45-75% of base
          : Math.round((CHEMS[id].basePrice * (1.10 + rng() * 0.40)) / 5) * 5  // 110-150% of base
      })
      const stock: Record<string, number> = {}
      chemIds.forEach(id => { stock[id] = rngInt(1, 5) })
      const fenceTitle = 'SUSPICIOUS PEDDLER'
      const fenceDesc  = "A nervous figure waves you down from the shadows. 'Real cheap. Don't ask where it came from.'"
      return {
        type,
        title:       isFence ? fenceTitle : title,
        description: isFence ? fenceDesc  : description,
        payload: { prices, stock, isFence },
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
