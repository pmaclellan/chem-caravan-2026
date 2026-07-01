export interface ChemSaleStats {
  qty: number
  capsEarned: number
  profitEarned: number
}

export interface RunStats {
  totalKills: number
  killsByEnemy: Record<string, number>   // enemyTypeId → kill count
  killsByGun: Record<string, number>     // gunId → kill count; 'unarmed' for bare-hands kills
  combatsFought: number
  combatsWon: number
  combatsFled: number
  secondWavesDefeated: number
  totalDamageDealt: number
  totalDamageTaken: number
  capsFromCombat: number
  chemsSold: Record<string, ChemSaleStats>  // chemId → aggregate sale stats
  chemsBought: Record<string, number>       // chemId → total qty bought
  tamesByEnemy: Record<string, number>      // enemyTypeId → tame count
  hasSoldToMerchant: boolean
  hasSoldToDesperateBuyer: boolean
  lifetimeCapsEarned: number
  turnsInDebt: number
}
