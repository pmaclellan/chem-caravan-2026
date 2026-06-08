import type { CombatState, EnemyUnit, PlayerState } from '../types/game'
import type { GameModeConfig } from '../data/modes'
import { rng, rngInt, rngWeightedPick } from './rng'
import { addChemStash } from './economy'

const RUN_BASE_CHANCE      = 0.40
const RUN_GUARD_BONUS      = 0.10  // per guard
const RUN_BRAHMIN_PENALTY  = 0.05  // per brahmin

export function initiateCombat(
  dangerLevel: number,
  modeConfig: GameModeConfig,
  roadEnemyWeights?: Partial<Record<string, number>>,
): CombatState {
  const count = Math.max(1, Math.round(dangerLevel * 5))

  // Build weighted pool from mode enemy types + optional road-specific weights
  const weightedPool = modeConfig.enemies.map(e => ({
    ...e,
    weight: roadEnemyWeights?.[e.id] ?? 1,
  }))

  const enemies: EnemyUnit[] = []
  let capsPool = 0

  for (let i = 0; i < count; i++) {
    const enemyType = rngWeightedPick(weightedPool) ?? modeConfig.enemies[0]
    const stats = modeConfig.enemyStats[enemyType.id] ?? { health: 40, damage: [10, 30] as [number, number] }
    const label = count > 1 ? `${enemyType.name} ${i + 1}` : enemyType.name

    enemies.push({
      id: `enemy_${i}`,
      typeId: enemyType.id,
      name: label,
      health: stats.health,
      maxHealth: stats.health,
      dead: false,
    })

    capsPool += rngInt(enemyType.caps[0], enemyType.caps[1])
  }

  // Collect loot pool from the enemy types present in this encounter
  const encounteredTypeIds = [...new Set(enemies.map(e => e.typeId))]
  const encounteredTypes = encounteredTypeIds.map(id => modeConfig.enemies.find(e => e.id === id)!)
  const possibleChems = [...new Set(encounteredTypes.flatMap(e => e.lootChems))]

  const enemyLoot: Record<string, number> = {}
  for (const chemId of possibleChems) {
    if (rng() < 0.30) {
      enemyLoot[chemId] = rngInt(1, Math.max(2, Math.ceil(count / 2)))
    }
  }

  // Build description from enemy type breakdown
  const typeCounts = encounteredTypeIds.map(typeId => {
    const n = enemies.filter(e => e.typeId === typeId).length
    const typeName = modeConfig.enemies.find(e => e.id === typeId)!.name
    return `${n} ${typeName}${n > 1 ? 's' : ''}`
  })
  const description = typeCounts.join(', ') + ' block the road ahead.'

  return {
    enemies,
    capsPool,
    totalDamageDealt: 0,
    totalDamageTaken: 0,
    enemyLoot,
    capsLooted: 0,
    phase: 'player_choice',
    log: [description],
  }
}

export function resolveFight(
  player: PlayerState,
  combat: CombatState,
  modeConfig: GameModeConfig,
): { player: PlayerState; combat: CombatState } {
  if (!player.gun) {
    return { player, combat: { ...combat, log: [...combat.log, "You have no weapon!"] } }
  }
  if (player.gun.ammo === 0) {
    return { player, combat: { ...combat, log: [...combat.log, "You squeeze the trigger — click. No ammo."] } }
  }

  const log: string[] = []
  const updatedEnemies = combat.enemies.map(e => ({ ...e }))
  let { capsPool } = combat
  let { health, guards } = player
  let gun = { ...player.gun }
  let damageDealt = 0

  // ── Player fires ─────────────────────────────────────────────────────────
  const playerCanFire = gun.ammo >= gun.ammoPerShot
  if (playerCanFire) {
    gun.ammo -= gun.ammoPerShot
    const target = updatedEnemies.find(e => !e.dead)
    if (target) {
      if (rng() < gun.accuracy) {
        const dealt = Math.min(gun.damage, target.health)
        damageDealt += dealt
        target.health = Math.max(0, target.health - gun.damage)
        if (target.health <= 0) {
          target.dead = true
          log.push(`You fire the ${gun.name} at ${target.name}. Hit! (${gun.damage} damage) — ${target.name} is dead!`)
        } else {
          log.push(`You fire the ${gun.name} at ${target.name}. Hit! (${gun.damage} damage)`)
        }
      } else {
        log.push(`You fire the ${gun.name} at ${target.name}. Missed.`)
      }
    }
  } else {
    log.push(`Not enough ammo to fire the ${gun.name}.`)
  }

  // ── Guards fire (each costs 1 ammo from shared pool) ─────────────────────
  for (let g = 0; g < guards; g++) {
    if (gun.ammo === 0) break
    gun.ammo -= 1
    const target = updatedEnemies.find(e => !e.dead)
    if (!target) break
    if (rng() < modeConfig.guardAccuracy) {
      const guardDmg = rngInt(modeConfig.guardDamage[0], modeConfig.guardDamage[1])
      const dealt = Math.min(guardDmg, target.health)
      damageDealt += dealt
      target.health = Math.max(0, target.health - guardDmg)
      if (target.health <= 0) {
        target.dead = true
        log.push(`Guard ${g + 1} fires. Hit! (${guardDmg} damage) — ${target.name} is dead!`)
      } else {
        log.push(`Guard ${g + 1} fires. Hit! (${guardDmg} damage)`)
      }
    } else {
      log.push(`Guard ${g + 1} fires. Missed.`)
    }
  }

  // ── Surviving enemies attack ──────────────────────────────────────────────
  const aliveEnemies = updatedEnemies.filter(e => !e.dead)
  let damageTaken = 0

  if (aliveEnemies.length > 0) {
    let totalIncoming = 0
    for (const enemy of aliveEnemies) {
      const stats = modeConfig.enemyStats[enemy.typeId]
      totalIncoming += stats ? rngInt(stats.damage[0], stats.damage[1]) : rngInt(10, 30)
    }

    // Guards absorb incoming (each guard absorbs guardHealth before player takes damage)
    const guardAbsorb = Math.min(guards, Math.floor(totalIncoming / modeConfig.guardHealth))
    const absorbed = guardAbsorb * modeConfig.guardHealth
    const playerDamage = Math.max(0, totalIncoming - absorbed)
    guards = Math.max(0, guards - guardAbsorb)
    health = Math.max(0, health - playerDamage)
    damageTaken = playerDamage

    if (guardAbsorb > 0) log.push(`${guardAbsorb} guard${guardAbsorb > 1 ? 's' : ''} take the brunt of the attack.`)
    if (playerDamage > 0) log.push(`Enemies hit you for ${playerDamage} damage.`)
  }

  // ── Determine outcome ─────────────────────────────────────────────────────
  let phase = combat.phase
  let wonCaps = 0
  let updatedPlayer: PlayerState = { ...player, health, guards, gun }

  if (aliveEnemies.length === 0) {
    phase = 'won'
    wonCaps = capsPool
    capsPool = 0
    updatedPlayer = { ...updatedPlayer, caps: player.caps + wonCaps }
    for (const [chemId, qty] of Object.entries(combat.enemyLoot)) {
      updatedPlayer = addChemStash(updatedPlayer, chemId, qty)
    }
    log.push(`All enemies defeated! You loot ${wonCaps} caps from their bodies.`)
  }

  if (health <= 0) {
    phase = 'lost'
    log.push("You've been killed.")
  }

  return {
    player: updatedPlayer,
    combat: {
      ...combat,
      enemies: updatedEnemies,
      capsPool,
      capsLooted: phase === 'won' ? wonCaps : combat.capsLooted,
      totalDamageDealt: combat.totalDamageDealt + damageDealt,
      totalDamageTaken: combat.totalDamageTaken + damageTaken,
      phase,
      log: [...combat.log, ...log],
    },
  }
}

export function resolveRun(
  player: PlayerState,
  combat: CombatState,
  modeConfig: GameModeConfig,
): { player: PlayerState; combat: CombatState } {
  const runChance = Math.min(0.9, Math.max(0.1,
    RUN_BASE_CHANCE + player.guards * RUN_GUARD_BONUS - player.brahmin * RUN_BRAHMIN_PENALTY
  ))
  const success = rng() < runChance
  const log: string[] = []
  let { health, brahmin } = player
  let { phase } = combat
  let damageTaken = 0

  if (success) {
    if (brahmin > 0 && rng() < 0.30) {
      brahmin = brahmin - 1
      log.push("You escape! But one of your brahmin couldn't keep up and bolted.")
    } else {
      log.push("You manage to escape!")
    }
    phase = 'fled'
  } else {
    const aliveEnemies = combat.enemies.filter(e => !e.dead)
    let totalDamage = 0
    for (const enemy of aliveEnemies) {
      const stats = modeConfig.enemyStats[enemy.typeId]
      // Fleeing: enemies get partial attacks at lower end of their damage range
      const [min, max] = stats ? stats.damage : [5, 15]
      totalDamage += rngInt(Math.max(1, Math.floor(min * 0.5)), Math.floor(max * 0.5))
    }
    health = Math.max(0, health - totalDamage)
    damageTaken = totalDamage
    log.push(`You try to run but the enemies catch you! They hit you for ${totalDamage} damage.`)
    if (health <= 0) {
      phase = 'lost'
      log.push("You've been killed trying to flee.")
    }
  }

  return {
    player: { ...player, health, brahmin },
    combat: {
      ...combat,
      totalDamageTaken: combat.totalDamageTaken + damageTaken,
      phase,
      log: [...combat.log, ...log],
    },
  }
}

// Count of alive enemies (convenience helper used in a few places)
export function aliveEnemyCount(combat: CombatState): number {
  return combat.enemies.filter(e => !e.dead).length
}
