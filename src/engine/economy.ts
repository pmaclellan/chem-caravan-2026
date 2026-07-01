import type { GunDefinition } from '../data/guns'
import type { DebtEnforcementEntry, GameModeConfig } from '../data/modes'
import type { ArmorDefinition, GunState, InventoryEntry, PlayerState, SettlementMarket } from '../types/game'
import type { TamingToolDefinition } from '../data/mounts'
import { CHEMS } from '../data/chems'
import { calculateCapacity, totalInventoryItems } from './travel'

export function applyTurnInterest(player: PlayerState, interestRate: number): PlayerState {
  if (player.debt <= 0) return player
  return {
    ...player,
    debt: Math.ceil(player.debt * (1 + interestRate)),
    ageOfDebt: player.ageOfDebt + 1,
    debtPaidThisCycle: 0,      // reset — caller saves the pre-tick value for enforcement check
    debtBorrowedThisCycle: 0,
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
  return {
    ...player,
    caps: player.caps + amount,
    debt: player.debt + amount,
    debtBorrowedThisCycle: (player.debtBorrowedThisCycle ?? 0) + amount,
  }
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
): { player: PlayerState; error?: string } {
  if (player.ownedGuns?.[gunDef.id]) return { player, error: "You already own this gun." }
  if (player.caps < gunDef.price) return { player, error: "Not enough caps." }
  const newGunState: GunState = {
    id: gunDef.id,
    name: gunDef.name,
    accuracy: gunDef.accuracy,
    damage: gunDef.damage,
    ammo: gunDef.ammoWithPurchase,
    ammoPerShot: gunDef.ammoPerShot,
    ammoPrice: gunDef.ammoPrice,
    ...(gunDef.shotsPerTurn   ? { shotsPerTurn:   gunDef.shotsPerTurn   } : {}),
    ...(gunDef.cooldownTurns  ? { cooldownTurns:  gunDef.cooldownTurns  } : {}),
    ...(gunDef.splashRatios   ? { splashRatios:   gunDef.splashRatios   } : {}),
    ...(gunDef.strayChance       ? { strayChance:       gunDef.strayChance       } : {}),
    ...(gunDef.requiresPowerArmor ? { requiresPowerArmor: true                   } : {}),
  }
  // Flush current gun's ammo into ownedGuns before equipping the new one
  const ownedGuns = { ...(player.ownedGuns ?? {}), [gunDef.id]: newGunState }
  if (player.gun) ownedGuns[player.gun.id] = { ...player.gun }
  return {
    player: { ...player, caps: player.caps - gunDef.price, gun: newGunState, ownedGuns },
  }
}

export function equipGun(
  player: PlayerState,
  gunId: string,
): { player: PlayerState; error?: string } {
  const owned = player.ownedGuns?.[gunId]
  if (!owned) return { player, error: "You don't own that gun." }
  if (player.gun?.id === gunId) return { player, error: "Already equipped." }
  // Flush current gun's live ammo back to ownedGuns
  const ownedGuns = { ...(player.ownedGuns ?? {}) }
  if (player.gun) ownedGuns[player.gun.id] = { ...player.gun }
  return {
    player: { ...player, gun: { ...owned }, ownedGuns },
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

export function buyTamingTool(
  player: PlayerState,
  toolDef: TamingToolDefinition,
): { player: PlayerState; error?: string } {
  if (player.caps < toolDef.price) return { player, error: "Not enough caps." }
  return {
    player: {
      ...player,
      caps: player.caps - toolDef.price,
      tamingTool: {
        id: toolDef.id,
        name: toolDef.name,
        greenWindowFraction: toolDef.greenWindowFraction,
        cursorSpeedMultiplier: toolDef.cursorSpeedMultiplier,
      },
    },
  }
}

export function buySaddle(
  player: PlayerState,
  price: number,
): { player: PlayerState; error?: string } {
  if (player.hasSaddle) return { player, error: "You already have a saddle." }
  if (player.caps < price) return { player, error: "Not enough caps." }
  return { player: { ...player, caps: player.caps - price, hasSaddle: true } }
}

export function healMount(
  player: PlayerState,
  cost: number,
): { player: PlayerState; error?: string } {
  if (!player.mount) return { player, error: "You don't have a mount." }
  if (player.mount.health >= player.mount.maxHealth) return { player, error: "Mount is already at full health." }
  if (player.caps < cost) return { player, error: "Not enough caps." }
  return {
    player: { ...player, caps: player.caps - cost, mount: { ...player.mount, health: player.mount.maxHealth } },
  }
}

export function buyAmmo(
  player: PlayerState,
  rounds: number,
): { player: PlayerState; error?: string } {
  if (!player.gun) return { player, error: "You don't have a gun." }
  const cost = rounds * player.gun.ammoPrice
  if (player.caps < cost) return { player, error: "Not enough caps." }
  return {
    player: { ...player, caps: player.caps - cost, gun: { ...player.gun, ammo: player.gun.ammo + rounds } },
  }
}

export function calculateNetWorth(player: PlayerState, mc: GameModeConfig): number {
  const gunsValue = Object.values(player.ownedGuns ?? {}).reduce((sum, gun) => {
    return sum + (mc.guns[gun.id]?.price ?? 0)
  }, 0)
  const armorValue = player.armor
    ? Math.round((player.armor.armorPoints / player.armor.maxArmorPoints) * (mc.armors[player.armor.id]?.price ?? 0))
    : 0
  return player.caps + inventoryBaseValue(player.inventory) + gunsValue + armorValue - player.debt
}

// Standard mode score: net worth + XP. For free play (XP-only), score is computed in gameStore.
export function calculateFinalScore(player: PlayerState, mc: GameModeConfig): number {
  return calculateNetWorth(player, mc) + (player.xp ?? 0)
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

export function inventoryBaseValue(inventory: PlayerState['inventory']): number {
  return Object.entries(inventory).reduce((sum, [chemId, entry]) => {
    return sum + (CHEMS[chemId]?.basePrice ?? 0) * entry.quantity
  }, 0)
}

export function totalGuardSalary(player: PlayerState, mc: GameModeConfig): number {
  return player.guards * mc.guardSalaryPerTurn + (player.powerArmorGuards ?? 0) * mc.powerArmorGuardSalaryPerTurn
}

export function applyGuardSalary(
  player: PlayerState,
  mc: GameModeConfig,
): { player: PlayerState; logs: Array<{ message: string; type: 'info' | 'danger' }> } {
  const salary = totalGuardSalary(player, mc)
  if (salary === 0) return { player, logs: [] }

  const logs: Array<{ message: string; type: 'info' | 'danger' }> = []

  // Can pay outright
  if (player.caps >= salary) {
    return {
      player: { ...player, caps: player.caps - salary },
      logs: [{ message: `Guard salary paid: -${salary} ¤ (${player.guards}g${(player.powerArmorGuards ?? 0) > 0 ? ` +${player.powerArmorGuards}PA` : ''})`, type: 'info' }],
    }
  }

  // Check collateral: caps + inventory at base price
  const collateral = player.caps + inventoryBaseValue(player.inventory)
  if (collateral >= salary) {
    return {
      player,
      logs: [{ message: `Guards defer payment — your pack covers their wages. (-${salary} ¤ owed next sale)`, type: 'info' }],
    }
  }

  // Can't cover — desert cheapest guards first until the remainder is affordable
  let guards    = player.guards
  let paGuards  = player.powerArmorGuards ?? 0
  let deserted  = 0
  let paDeserted = 0

  while (guards + paGuards > 0) {
    const remaining = guards * mc.guardSalaryPerTurn + paGuards * mc.powerArmorGuardSalaryPerTurn
    if (player.caps + inventoryBaseValue(player.inventory) >= remaining) break
    if (guards > 0) { guards--; deserted++ }
    else             { paGuards--; paDeserted++ }
  }

  if (deserted > 0)   logs.push({ message: `${deserted} guard${deserted > 1 ? 's' : ''} deserted — couldn't cover their salary.`, type: 'danger' })
  if (paDeserted > 0) logs.push({ message: `${paDeserted} Power Armor guard${paDeserted > 1 ? 's' : ''} deserted — couldn't cover their salary.`, type: 'danger' })

  const remainingSalary = guards * mc.guardSalaryPerTurn + paGuards * mc.powerArmorGuardSalaryPerTurn
  const updatedPlayer: PlayerState = {
    ...player,
    guards,
    powerArmorGuards: paGuards,
    caps: Math.max(0, player.caps - remainingSalary),
  }

  if (remainingSalary > 0 && player.caps >= remainingSalary) {
    logs.push({ message: `Guard salary paid: -${remainingSalary} ¤`, type: 'info' })
  } else if (remainingSalary > 0) {
    logs.push({ message: `Guards defer payment — your pack covers the remainder.`, type: 'info' })
  }

  return { player: updatedPlayer, logs }
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
