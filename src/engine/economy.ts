import type { GunDefinition } from '../data/guns'
import type { DebtEnforcementEntry } from '../data/modes'
import type { ArmorDefinition, InventoryEntry, PlayerState, SettlementMarket } from '../types/game'
import { calculateCapacity, totalInventoryItems } from './travel'

export function applyTurnInterest(player: PlayerState, interestRate: number): PlayerState {
  if (player.debt <= 0) return player
  return {
    ...player,
    debt: Math.ceil(player.debt * (1 + interestRate)),
    ageOfDebt: player.ageOfDebt + 1,
    debtPaidThisCycle: 0,   // reset — caller saves the pre-tick value for enforcement check
  }
}

export type DebtEnforcementResult =
  | { action: 'none' }
  | { action: 'beat'; damage: number; message: string }
  | { action: 'kill'; message: string }

export function checkDebtEnforcement(
  player: PlayerState,
  debtEnforcement: DebtEnforcementEntry[],
): DebtEnforcementResult {
  if (player.debt <= 0) return { action: 'none' }
  const enforcement = debtEnforcement.find(e => e.age === player.ageOfDebt)
  if (!enforcement) return { action: 'none' }
  if (enforcement.damage >= 999) return { action: 'kill', message: enforcement.message }
  return { action: 'beat', damage: enforcement.damage, message: enforcement.message }
}

export function buyChems(
  player: PlayerState,
  market: SettlementMarket,
  chemId: string,
  quantity: number,
): { player: PlayerState; error?: string } {
  const price = market.prices[chemId]
  const available = market.stock[chemId] ?? 0
  if (!price || available < quantity) return { player, error: "Not enough in stock." }

  const totalCost = price * quantity
  if (player.caps < totalCost) return { player, error: "Not enough caps." }

  const capacity = calculateCapacity(player.brahmin)
  const current = totalInventoryItems(player.inventory)
  if (current + quantity > capacity) return { player, error: "Not enough inventory space." }

  const existing = player.inventory[chemId]
  const newQty = (existing?.quantity ?? 0) + quantity
  const newPricePaid = existing
    ? Math.round((existing.pricePaid * existing.quantity + price * quantity) / newQty)
    : price

  const inventory: Record<string, InventoryEntry> = {
    ...player.inventory,
    [chemId]: { quantity: newQty, pricePaid: newPricePaid },
  }

  return {
    player: { ...player, caps: player.caps - totalCost, inventory },
  }
}

export function sellChems(
  player: PlayerState,
  market: SettlementMarket,
  chemId: string,
  quantity: number,
): { player: PlayerState; profit: number; error?: string } {
  const existing = player.inventory[chemId]
  if (!existing || existing.quantity < quantity) return { player, profit: 0, error: "You don't have that many." }

  const price = market.prices[chemId]
  if (!price) return { player, profit: 0, error: "No buyers for that here." }

  const revenue = price * quantity
  const cost = existing.pricePaid * quantity
  const profit = revenue - cost

  const newQty = existing.quantity - quantity
  const inventory = { ...player.inventory }
  if (newQty === 0) {
    delete inventory[chemId]
  } else {
    inventory[chemId] = { ...existing, quantity: newQty }
  }

  return {
    player: { ...player, caps: player.caps + revenue, inventory },
    profit,
  }
}

export function healPlayer(player: PlayerState, cost: number): { player: PlayerState; error?: string } {
  if (player.health >= player.maxHealth) return { player, error: "You're already at full health." }
  if (player.caps < cost) return { player, error: "Not enough caps." }
  return { player: { ...player, health: player.maxHealth, caps: player.caps - cost } }
}

export function takeLoan(player: PlayerState, amount: number): PlayerState {
  return { ...player, caps: player.caps + amount, debt: player.debt + amount }
}

export function repayDebt(player: PlayerState, amount: number): { player: PlayerState; error?: string } {
  if (amount <= 0) return { player, error: "Amount must be positive." }
  if (player.caps < amount) return { player, error: "Not enough caps." }
  const payment = Math.min(amount, player.debt)
  const newDebt = player.debt - payment
  return {
    player: {
      ...player,
      caps: player.caps - payment,
      debt: newDebt,
      ageOfDebt: newDebt === 0 ? 0 : player.ageOfDebt,
      debtPaidThisCycle: (player.debtPaidThisCycle ?? 0) + payment,
      debtWarnings: newDebt === 0 ? 0 : (player.debtWarnings ?? 0),  // clear warnings on full payoff
    },
  }
}

export function hireGuards(
  player: PlayerState,
  count: number,
  guardCost: number,
  maxGuards: number,
): { player: PlayerState; error?: string } {
  const available = Math.max(0, maxGuards - player.guards)
  const actual = Math.min(count, available)
  if (actual === 0) return { player, error: `Guard limit is ${maxGuards}.` }
  const cost = actual * guardCost
  if (player.caps < cost) return { player, error: "Not enough caps." }
  return { player: { ...player, caps: player.caps - cost, guards: player.guards + actual } }
}

export function buyPowerArmorGuard(
  player: PlayerState,
  count: number,
  paGuardCost: number,
  maxPAGuards: number,
): { player: PlayerState; error?: string } {
  const available = Math.max(0, maxPAGuards - (player.powerArmorGuards ?? 0))
  const actual = Math.min(count, available)
  if (actual === 0) return { player, error: `Power armor guard limit is ${maxPAGuards}.` }
  const cost = actual * paGuardCost
  if (player.caps < cost) return { player, error: "Not enough caps." }
  return { player: { ...player, caps: player.caps - cost, powerArmorGuards: (player.powerArmorGuards ?? 0) + actual } }
}

export function buyBrahmin(
  player: PlayerState,
  count: number,
  brahminCost: number,
  maxBrahmin: number,
): { player: PlayerState; error?: string } {
  const available = Math.max(0, maxBrahmin - player.brahmin)
  const actual = Math.min(count, available)
  if (actual === 0) return { player, error: `Brahmin limit is ${maxBrahmin}.` }
  const cost = actual * brahminCost
  if (player.caps < cost) return { player, error: "Not enough caps." }
  return { player: { ...player, caps: player.caps - cost, brahmin: player.brahmin + actual } }
}

export function buyGun(
  player: PlayerState,
  gunDef: GunDefinition,
  ammoWithPurchase = 20,
): { player: PlayerState; error?: string } {
  const totalCost = gunDef.price
  if (player.caps < totalCost) return { player, error: "Not enough caps." }
  return {
    player: {
      ...player,
      caps: player.caps - totalCost,
      gun: {
        id: gunDef.id,
        name: gunDef.name,
        accuracy: gunDef.accuracy,
        damage: gunDef.damage,
        ammo: ammoWithPurchase,
        ammoPerShot: gunDef.ammoPerShot,
      },
    },
  }
}

export function buyArmor(
  player: PlayerState,
  armorDef: ArmorDefinition,
): { player: PlayerState; error?: string } {
  if (player.caps < armorDef.price) return { player, error: "Not enough caps." }
  return {
    player: {
      ...player,
      caps: player.caps - armorDef.price,
      armor: {
        id: armorDef.id,
        name: armorDef.name,
        armorPoints: armorDef.armorPoints,
        maxArmorPoints: armorDef.armorPoints,
        repairCostPerAP: armorDef.repairCostPerAP,
      },
    },
  }
}

export function repairArmor(player: PlayerState): { player: PlayerState; error?: string } {
  if (!player.armor) return { player, error: "You don't have any armor." }
  if (player.armor.armorPoints >= player.armor.maxArmorPoints) return { player, error: "Armor is already at full condition." }
  const missingAP = player.armor.maxArmorPoints - player.armor.armorPoints
  const cost = missingAP * player.armor.repairCostPerAP
  if (player.caps < cost) return { player, error: `Not enough caps. Repair costs ${cost} caps.` }
  return {
    player: {
      ...player,
      caps: player.caps - cost,
      armor: { ...player.armor, armorPoints: player.armor.maxArmorPoints },
    },
  }
}

export function buyAmmo(
  player: PlayerState,
  rounds: number,
  ammoPrice = 5,
): { player: PlayerState; error?: string } {
  if (!player.gun) return { player, error: "You don't have a gun." }
  const cost = rounds * ammoPrice
  if (player.caps < cost) return { player, error: "Not enough caps." }
  return {
    player: { ...player, caps: player.caps - cost, gun: { ...player.gun, ammo: player.gun.ammo + rounds } },
  }
}

export function calculateFinalScore(player: PlayerState): number {
  return player.caps - player.debt
}

export function resolveGameStatus(
  _player: PlayerState,
  reason: 'turns' | 'debt' | 'combat' | 'bankrupt' | 'retired',
): 'won' | 'dead' | 'bankrupt' {
  if (reason === 'turns' || reason === 'retired') return 'won'
  if (reason === 'bankrupt') return 'bankrupt'
  return 'dead'
}

// Pay the brotherhood checkpoint toll
export function payBrotherhoodToll(player: PlayerState, toll: number): { player: PlayerState; paid: boolean } {
  if (player.caps < toll) return { player, paid: false }
  return { player: { ...player, caps: player.caps - toll }, paid: true }
}

export function addChemStash(
  player: PlayerState,
  chemId: string,
  quantity: number,
): PlayerState {
  const capacity = calculateCapacity(player.brahmin)
  const current = totalInventoryItems(player.inventory)
  const canAdd = Math.min(quantity, Math.max(0, capacity - current))
  if (canAdd === 0) return player
  const existing = player.inventory[chemId]
  const newQty = (existing?.quantity ?? 0) + canAdd
  return {
    ...player,
    inventory: {
      ...player.inventory,
      [chemId]: { quantity: newQty, pricePaid: existing?.pricePaid ?? 0 },
    },
  }
}

export type { GunDefinition }
