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
  scaleFactor = 1,
): TravelEvent | null {
  // Debt collector — window-based payment check.
  // Fires once the current payment window has closed without meeting the 15% threshold.
  if (player.debt > 0 && player.ageOfDebt >= modeConfig.debtGracePeriod) {
    const windowStartAge  = player.debtWindowStartAge ?? player.ageOfDebt
    const turnsElapsed    = player.ageOfDebt - windowStartAge
    const windowOverdue   = turnsElapsed >= modeConfig.debtWindowSize
    const windowPaid      = player.debtWindowCapsPaid ?? 0
    const minWindowPayment = Math.ceil(player.debt * modeConfig.debtMinPaymentRate)
    const windowUnsatisfied = windowPaid < minWindowPayment

    if (windowOverdue && windowUnsatisfied && rng() < modeConfig.debtCollectorProb) {
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
        payload: { warnings },
      }
    }
  }

  // Combat roll — dangerLevel scaled by free play difficulty ramp.
  if (rng() < Math.min(1, road.dangerLevel * scaleFactor)) {
    const def = modeConfig.travelEvents.find(e => e.type === 'raider_ambush')
    if (def) return buildEventPayload('raider_ambush', def.title, def.description, modeConfig, road)
  }

  // Non-combat event roll — only reached when no ambush this trip.
  if (rng() < modeConfig.nonCombatEventProb) {
    const eligible = modeConfig.travelEvents.filter(
      e => e.weight > 0 && e.type !== 'raider_ambush' && road.dangerLevel >= e.minDangerToTrigger
    )
    const chosen = rngWeightedPick(eligible)
    if (chosen) return buildEventPayload(chosen.type, chosen.title, chosen.description, modeConfig, road)
  }

  return null
}

// Enemy-specific ambush lines — functions of count so description reads naturally
const AMBUSH_LINES: Record<string, (n: number) => string> = {
  raider:       (n) => n === 1 ? "A lone Raider steps out from cover, weapon raised." : `${n} Raiders emerge from cover. They want your caps.`,
  super_mutant: (n) => n === 1 ? "A Super Mutant charges from the rubble, roaring." : `${n} Super Mutants block the road ahead, weapons raised.`,
  great_khan:   (n) => n === 1 ? "A Great Khan rides out of the dust, armed." : `${n} Great Khans ride out of the dust, looking for trouble.`,
  legionnaire:  (n) => n === 1 ? "A Legionnaire steps from the shadows. Blade drawn." : `${n} Legion Assassins step out of the shadows. Blades drawn.`,
  deathclaw:    (n) => n === 1 ? "A Deathclaw rounds the bend. You might want to run." : `${n} Deathclaws emerge from the ruins. Run.`,
  fiend:        (n) => n === 1 ? "A wild-eyed Fiend rushes from cover, screaming." : `${n} Fiends pour out of a wrecked vehicle, wild-eyed and armed.`,
  feral_ghoul:  (n) => n === 1 ? "A Feral Ghoul lurches out of the dark, moaning." : `${n} Feral Ghouls close in from the shadows. They're fast.`,
  radscorpion:  (n) => n === 1 ? "The ground ruptures — a Radscorpion rears up, claws snapping." : `${n} Radscorpions burst from the sand, tails raised.`,
  yao_guai:     (n) => n === 1 ? "A Yao Guai crashes out of the brush, snarling." : `${n} Yao Guai surge from cover. They're hunting.`,
}

function buildEventPayload(
  type: TravelEvent['type'],
  title: string,
  description: string,
  modeConfig: GameModeConfig,
  road?: Road,
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
    case 'raider_ambush': {
      // Pre-select enemy type and count so the player can make an informed fight/run decision.
      // Only non-event-only enemies appear in random road encounters.
      const weightedPool = modeConfig.enemies
        .filter(e => !e.eventOnly)
        .map(e => ({ ...e, weight: road?.enemyWeights?.[e.id] ?? 1 }))
      const picked = rngWeightedPick(weightedPool) ?? modeConfig.enemies[0]
      const maxCount = Math.max(2, Math.ceil((road?.dangerLevel ?? 0.5) * 4))
      const count = rngInt(1, maxCount)
      const ambushDesc = AMBUSH_LINES[picked.id]?.(count) ?? description
      return { type, title, description: ambushDesc, payload: { enemyTypeId: picked.id, count } }
    }
    case 'brotherhood_checkpoint':
      return { type, title, description, payload: { toll: brotherhoodToll, enemyTypeId: getCheckpointEnemyTypeId(modeConfig) } }
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

function getCheckpointEnemyTypeId(mc: GameModeConfig): string {
  if (mc.id === 'mojave_wasteland') return 'ncr_ranger'
  return 'brotherhood_paladin'
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
