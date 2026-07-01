import type { RunStats } from '../types/stats'
import type { GameEventMap } from './eventBus'

export function initStats(): RunStats {
  return {
    totalKills: 0,
    killsByEnemy: {},
    killsByGun: {},
    combatsFought: 0,
    combatsWon: 0,
    totalDamageDealt: 0,
    totalDamageTaken: 0,
    capsFromCombat: 0,
    chemsSold: {},
    lifetimeCapsEarned: 0,
    turnsInDebt: 0,
  }
}

type GameEvent = {
  [K in keyof GameEventMap]: { type: K } & GameEventMap[K]
}[keyof GameEventMap]

export function updateStats(stats: RunStats, event: GameEvent): RunStats {
  switch (event.type) {
    case 'COMBAT_RESOLVED': {
      const killCount = event.killedEnemies.length
      const newKillsByEnemy = { ...stats.killsByEnemy }
      for (const e of event.killedEnemies) {
        newKillsByEnemy[e.typeId] = (newKillsByEnemy[e.typeId] ?? 0) + 1
      }
      const newKillsByGun = { ...stats.killsByGun }
      if (killCount > 0) {
        const key = event.weaponId ?? 'unarmed'
        newKillsByGun[key] = (newKillsByGun[key] ?? 0) + killCount
      }
      return {
        ...stats,
        totalKills: stats.totalKills + killCount,
        killsByEnemy: newKillsByEnemy,
        killsByGun: newKillsByGun,
        combatsFought: stats.combatsFought + 1,
        combatsWon: stats.combatsWon + (event.outcome === 'won' ? 1 : 0),
        totalDamageDealt: stats.totalDamageDealt + event.damageDealt,
        totalDamageTaken: stats.totalDamageTaken + event.damageTaken,
        capsFromCombat: stats.capsFromCombat + event.capsLooted,
        lifetimeCapsEarned: stats.lifetimeCapsEarned + event.capsLooted,
      }
    }
    case 'CHEM_SOLD': {
      const existing = stats.chemsSold[event.chemId] ?? { qty: 0, capsEarned: 0, profitEarned: 0 }
      return {
        ...stats,
        chemsSold: {
          ...stats.chemsSold,
          [event.chemId]: {
            qty: existing.qty + event.quantity,
            capsEarned: existing.capsEarned + event.revenue,
            profitEarned: existing.profitEarned + event.profit,
          },
        },
        lifetimeCapsEarned: stats.lifetimeCapsEarned + event.revenue,
      }
    }
    case 'TURN_COMPLETED': {
      return {
        ...stats,
        turnsInDebt: stats.turnsInDebt + (event.inDebt ? 1 : 0),
      }
    }
    default:
      return stats
  }
}
