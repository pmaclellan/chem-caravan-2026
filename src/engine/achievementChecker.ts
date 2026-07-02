import { ACHIEVEMENTS } from '../data/achievements'
import type { GameModeConfig } from '../data/modes'
import type { AchievementDef } from '../types/achievement'
import type { GameState } from '../types/game'

type CheckFn = (prev: GameState, next: GameState, mc: GameModeConfig) => boolean

const CHECKS: Record<string, CheckFn> = {
  toll_collector: (prev, next) =>
    next.stats.checkpointCombatsWon > prev.stats.checkpointCombatsWon,

  first_blood: (prev, next) =>
    next.stats.combatsWon > 0 && prev.stats.combatsWon === 0,

  second_wave: (prev, next) =>
    next.stats.secondWavesDefeated > prev.stats.secondWavesDefeated,

  kill_all_enemies: (_prev, next, mc) =>
    mc.enemies
      .filter(e => !e.eventOnly)
      .every(e => (next.stats.killsByEnemy[e.id] ?? 0) > 0),

  pacifist: (prev, next) =>
    next.stats.turnsWithoutFight >= 10 && prev.stats.turnsWithoutFight < 10,

  friends_with_benefits: (prev, next) =>
    next.stats.guardsOnlyWins > prev.stats.guardsOnlyWins,

  flee_10: (prev, next) =>
    next.stats.combatsFled >= 10 && prev.stats.combatsFled < 10,

  flee_50: (prev, next) =>
    next.stats.combatsFled >= 50 && prev.stats.combatsFled < 50,

  tame_yao_guai: (_prev, next) =>
    (next.stats.tamesByEnemy['yao_guai'] ?? 0) > 0,

  tame_radscorpion: (_prev, next) =>
    (next.stats.tamesByEnemy['radscorpion'] ?? 0) > 0,

  tame_deathclaw: (_prev, next) =>
    (next.stats.tamesByEnemy['deathclaw'] ?? 0) > 0,

  tame_all_three: (_prev, next) =>
    (next.stats.tamesByEnemy['yao_guai'] ?? 0) > 0 &&
    (next.stats.tamesByEnemy['radscorpion'] ?? 0) > 0 &&
    (next.stats.tamesByEnemy['deathclaw'] ?? 0) > 0,

  all_settlements: (_prev, next, mc) =>
    mc.settlementIds.every(id => next.player.visitedSettlements.includes(id)),

  all_chems_traded: (_prev, next, mc) =>
    mc.availableChemIds.every(
      id => (next.stats.chemsBought[id] ?? 0) > 0 && (next.stats.chemsSold[id]?.qty ?? 0) > 0
    ),

  // profit_100 and profit_1000 are triggered via checkProfitAchievements() in the
  // CHEM_SOLD subscriber — they need per-trade revenue/profit, not a state diff.

  opportunist: (prev, next) =>
    next.stats.hasSoldToDesperateBuyer && !prev.stats.hasSoldToDesperateBuyer,

  sell_merchant: (prev, next) =>
    next.stats.hasSoldToMerchant && !prev.stats.hasSoldToMerchant,

  drug_lord: (prev, next) => {
    const prevMax = Math.max(0, ...Object.values(prev.stats.chemsSold).map(s => s.qty))
    const nextMax = Math.max(0, ...Object.values(next.stats.chemsSold).map(s => s.qty))
    return nextMax >= 100 && prevMax < 100
  },

  buy_power_armor: (prev, next) =>
    next.player.armor?.id === 'power_armor' && prev.player.armor?.id !== 'power_armor',

  own_3_guns: (prev, next) => {
    const prevCount = Object.keys(prev.player.ownedGuns).length
    const nextCount = Object.keys(next.player.ownedGuns).length
    return nextCount >= 3 && prevCount < 3
  },

  max_guards: (prev, next, mc) =>
    next.player.guards >= mc.maxGuards && prev.player.guards < mc.maxGuards,

  max_pa_guards: (prev, next, mc) =>
    next.player.powerArmorGuards >= mc.maxPowerArmorGuards &&
    prev.player.powerArmorGuards < mc.maxPowerArmorGuards,

  max_brahmin: (prev, next, mc) =>
    next.player.brahmin >= mc.maxBrahmin && prev.player.brahmin < mc.maxBrahmin,

  max_all_followers: (prev, next, mc) => {
    const prevAll =
      prev.player.guards >= mc.maxGuards &&
      prev.player.powerArmorGuards >= mc.maxPowerArmorGuards &&
      prev.player.brahmin >= mc.maxBrahmin
    const nextAll =
      next.player.guards >= mc.maxGuards &&
      next.player.powerArmorGuards >= mc.maxPowerArmorGuards &&
      next.player.brahmin >= mc.maxBrahmin
    return nextAll && !prevAll
  },

  pay_off_debt: (prev, next) =>
    (next.player.debtEverCleared ?? false) && !(prev.player.debtEverCleared ?? false),

  survive_30: (prev, next) =>
    next.world.turn >= 30 && prev.world.turn < 30,

  survive_50: (prev, next) =>
    next.world.turn >= 50 && prev.world.turn < 50,

  survive_75: (prev, next) =>
    next.world.turn >= 75 && prev.world.turn < 75,

  survive_100: (prev, next) =>
    next.world.turn >= 100 && prev.world.turn < 100,
}

export function checkNewAchievements(
  prev: GameState,
  next: GameState,
  mc: GameModeConfig,
): AchievementDef[] {
  const alreadyEarned = new Set(next.earnedAchievements.map(a => a.id))
  const results: AchievementDef[] = []

  for (const def of ACHIEVEMENTS) {
    if (alreadyEarned.has(def.id)) continue
    if (def.modeFilter && !def.modeFilter.includes(next.mode)) continue

    const check = CHECKS[def.id]
    if (check && check(prev, next, mc)) {
      results.push(def)
    }
  }

  return results
}

// Called from the CHEM_SOLD event subscriber for per-trade profit achievements.
// Returns achievement ids that should be triggered by this specific sale.
export function checkProfitAchievements(
  revenue: number,
  profit: number,
  alreadyEarned: Set<string>,
): string[] {
  const triggered: string[] = []
  const cost = revenue - profit
  if (cost <= 0) return triggered  // found items: skip

  const profitPct = profit / cost
  if (profitPct >= 10 && !alreadyEarned.has('profit_1000')) triggered.push('profit_1000')
  if (profitPct >= 1 && !alreadyEarned.has('profit_100')) triggered.push('profit_100')
  return triggered
}
