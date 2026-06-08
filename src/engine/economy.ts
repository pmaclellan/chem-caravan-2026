import type { GunDefinition } from '../data/guns'
import type { DebtEnforcementEntry } from '../data/modes'
import type { InventoryEntry, PlayerState, SettlementMarket } from '../types/game'
import { calculateCapacity, totalInventoryItems } from './travel'

export function applyTurnInterest(player: PlayerState, interestRate: number): PlayerState {
  if (player.debt <= 0) return player
  return {
    ...player,
    debt: Math.ceil(player.debt * (1 + interestRate)),
    ageOfDebt: player.ageOfDebt + 1,
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

export function depositToBank(player: PlayerState, amount: number): { player: PlayerState; error?: string } {
  if (amount <= 0) return { player, error: "Amount must be positive." }
  if (player.caps < amount) return { player, error: "Not enough caps." }
  return { player: { ...player, caps: player.caps - amount, bank: player.bank + amount } }
}

export function withdrawFromBank(player: PlayerState, amount: number): { player: PlayerState; error?: string } {
  if (amount <= 0) return { player, error: "Amount must be positive." }
  if (player.bank < amount) return { player, error: "Not enough in bank." }
  return { player: { ...player, bank: player.bank - amount, caps: player.caps + amount } }
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
    },
  }
}

export function hireGuards(player: PlayerState, count: number, guardCost: number): { player: PlayerState; error?: string } {
  const cost = count * guardCost
  if (player.caps < cost) return { player, error: "Not enough caps." }
  return { player: { ...player, caps: player.caps - cost, guards: player.guards + count } }
}

export function buyBrahmin(player: PlayerState, count: number, brahminCost: number): { player: PlayerState; error?: string } {
  const cost = count * brahminCost
  if (player.caps < cost) return { player, error: "Not enough caps." }
  return { player: { ...player, caps: player.caps - cost, brahmin: player.brahmin + count } }
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
  return player.caps + player.bank - player.debt
}

export function resolveGameStatus(
  _player: PlayerState,
  reason: 'turns' | 'debt' | 'combat' | 'bankrupt',
): 'won' | 'dead' | 'bankrupt' {
  if (reason === 'turns') return 'won'
  if (reason === 'bankrupt') return 'bankrupt'
  return 'dead'
}

// Pay the brotherhood checkpoint toll
export function payBrotherhoodToll(player: PlayerState, toll: number): { player: PlayerState; paid: boolean } {
  if (player.caps < toll) return { player, paid: false }
  return { player: { ...player, caps: player.caps - toll }, paid: true }
}

// Add chems from a stash find directly to inventory (ignores capacity — it's a gift)
export function addChemStash(
  player: PlayerState,
  chemId: string,
  quantity: number,
): PlayerState {
  const existing = player.inventory[chemId]
  const newQty = (existing?.quantity ?? 0) + quantity
  return {
    ...player,
    inventory: {
      ...player.inventory,
      [chemId]: { quantity: newQty, pricePaid: existing?.pricePaid ?? 0 },
    },
  }
}

export type { GunDefinition }
