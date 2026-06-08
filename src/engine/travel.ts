import { CONFIG } from '../data/config'
import type { GameModeConfig } from '../data/modes'
import type { Road } from '../data/modes'
import type { PlayerState, TravelEvent } from '../types/game'
import { CHEMS } from '../data/chems'
import { rng, rngInt, rngPick, rngWeightedPick } from './rng'

export function getAdjacentRoads(mc: GameModeConfig, settlementId: string): Road[] {
  return mc.roads.filter(r => r.from === settlementId || r.to === settlementId)
}

export function getRoadDestination(road: Road, currentLocation: string): string {
  return road.from === currentLocation ? road.to : road.from
}

export function calculateCapacity(brahmin: number, baseCapacity = CONFIG.BASE_CAPACITY, capacityPerBrahmin = CONFIG.CAPACITY_PER_BRAHMIN): number {
  return baseCapacity + brahmin * capacityPerBrahmin
}

export function totalInventoryItems(inventory: PlayerState['inventory']): number {
  return Object.values(inventory).reduce((sum, entry) => sum + entry.quantity, 0)
}

export function selectTravelEvent(
  road: Road,
  player: PlayerState,
  modeConfig: GameModeConfig,
  debtPaidThisCycle = 0,
): TravelEvent | null {
  // Debt collector — grace period + payment check
  if (player.debt > 0 && player.ageOfDebt >= modeConfig.debtGracePeriod) {
    const minPayment = Math.ceil(player.debt * modeConfig.debtMinPaymentRate)
    const hasPaid    = debtPaidThisCycle >= minPayment
    if (!hasPaid && rng() < modeConfig.debtCollectorProb) {
      const def      = modeConfig.travelEvents.find(e => e.type === 'debt_collector')!
      const warnings = player.debtWarnings ?? 0
      const description =
        warnings === 0 ? def.description
        : warnings === 1
          ? "They're back — just like they said they would be. You had your warning."
          : "\"Last visit,\" the lead enforcer says. They mean it."
      return {
        type: def.type,
        title: def.title,
        description,
        payload: { minPayment, warnings },
      }
    }
  }

  const eventProb = modeConfig.eventBaseProb + road.dangerLevel * modeConfig.eventDangerScale
  if (rng() > eventProb) return null

  const eligible = modeConfig.travelEvents.filter(
    e => e.weight > 0 && road.dangerLevel >= e.minDangerToTrigger
  )
  const chosen = rngWeightedPick(eligible)
  if (!chosen) return null

  return buildEventPayload(chosen.type, chosen.title, chosen.description, modeConfig)
}

function buildEventPayload(
  type: TravelEvent['type'],
  title: string,
  description: string,
  modeConfig: GameModeConfig,
): TravelEvent {
  const stashChemsDef = modeConfig.travelEvents.find(e => e.type === 'chem_stash')
  const stashChems = stashChemsDef ? getStashChems(modeConfig) : ['jet', 'psycho']
  const brotherhoodToll = getBrotherhoodToll(modeConfig)

  switch (type) {
    case 'chem_stash': {
      const chemId = rngPick(stashChems)
      const qty = rngInt(1, 4)
      return { type, title, description, payload: { chemId, qty } }
    }
    case 'brotherhood_checkpoint':
      return { type, title, description, payload: { toll: brotherhoodToll } }
    case 'wandering_merchant': {
      const chemIds = [...stashChems].sort(() => rng() - 0.5).slice(0, 3)
      const isFence = rng() < 0.35

      if (isFence) {
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

// Pull stash chems and toll from the events module for the given mode.
// These constants live in the events data files but aren't part of the type system —
// we look them up by reading the module import. For now we fall back to defaults.
function getStashChems(mc: GameModeConfig): string[] {
  // Use available chem ids as stash pool, filtered to base chems (not premium ones)
  const premiumChems = new Set(['ultrajet', 'daytripper', 'nuka_cola_quantum', 'turbo', 'rocket'])
  const pool = mc.availableChemIds.filter(id => !premiumChems.has(id))
  return pool.length > 0 ? pool : mc.availableChemIds
}

function getBrotherhoodToll(_mc: GameModeConfig): number {
  return 100 // base toll; mode-specific events just flavor the name
}

export function dropExcessInventory(player: PlayerState): PlayerState {
  const capacity = calculateCapacity(player.brahmin)
  const current = totalInventoryItems(player.inventory)
  if (current <= capacity) return player

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

export function getSettlementName(mc: GameModeConfig, id: string): string {
  return mc.settlements[id]?.name ?? id
}
