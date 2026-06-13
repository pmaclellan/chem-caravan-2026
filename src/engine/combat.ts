import type { CombatState, EnemyUnit, PlayerState } from '../types/game'
import type { GameModeConfig } from '../data/modes'
import { rng, rngInt, rngWeightedPick } from './rng'
import { addChemStash } from './economy'
import { loseBrahmin } from './travel'

const RUN_BASE_CHANCE      = 0.40
const RUN_GUARD_BONUS      = 0.10  // per guard
const RUN_BRAHMIN_PENALTY  = 0.05  // per brahmin

export function initiateCombat(
  dangerLevel: number,
  modeConfig: GameModeConfig,
  roadEnemyWeights?: Partial<Record<string, number>>,
  forcedEnemyTypeId?: string,
  forcedCount?: number,
): CombatState {
  // Pick enemy type first so countMultiplier can scale the base count
  const weightedPool = modeConfig.enemies
    .filter(e => !e.eventOnly)
    .map(e => ({
      ...e,
      weight: roadEnemyWeights?.[e.id] ?? 1,
    }))
  const enemyType = forcedEnemyTypeId
    ? (modeConfig.enemies.find(e => e.id === forcedEnemyTypeId) ?? rngWeightedPick(weightedPool) ?? modeConfig.enemies[0])
    : (rngWeightedPick(weightedPool) ?? modeConfig.enemies[0])

  const baseCount = Math.max(1, Math.round(dangerLevel * 5))
  const count = forcedCount ?? Math.max(1, Math.round(baseCount * (enemyType.countMultiplier ?? 1)))

  const stats = modeConfig.enemyStats[enemyType.id] ?? { health: 40, damage: [10, 30] as [number, number] }

  const enemies: EnemyUnit[] = []
  let capsPool = 0

  for (let i = 0; i < count; i++) {
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

  // Loot from this enemy type only
  const enemyLoot: Record<string, number> = {}
  for (const chemId of enemyType.lootChems) {
    if (rng() < 0.30) {
      enemyLoot[chemId] = rngInt(1, Math.max(2, Math.ceil(count / 2)))
    }
  }

  const description = `${count} ${enemyType.name}${count > 1 ? 's' : ''} block the road ahead.`

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
  let armor = player.armor ? { ...player.armor } : null
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
    const postGuardDamage = Math.max(0, totalIncoming - absorbed)
    guards = Math.max(0, guards - guardAbsorb)

    // Armor absorbs remaining damage before HP
    let armorAbsorb = 0
    if (armor && postGuardDamage > 0) {
      armorAbsorb = Math.min(armor.armorPoints, postGuardDamage)
      armor = { ...armor, armorPoints: armor.armorPoints - armorAbsorb }
    }
    const finalDamage = Math.max(0, postGuardDamage - armorAbsorb)
    health = Math.max(0, health - finalDamage)
    damageTaken = finalDamage

    if (guardAbsorb > 0) log.push(`${guardAbsorb} guard${guardAbsorb > 1 ? 's' : ''} take the brunt of the attack.`)
    if (armorAbsorb > 0) log.push(`Your armor absorbs ${armorAbsorb} damage. (${armor!.armorPoints} AP remaining)`)
    if (finalDamage > 0) log.push(`Enemies hit you for ${finalDamage} damage.`)
  }

  // ── Determine outcome ─────────────────────────────────────────────────────
  let phase = combat.phase
  let wonCaps = 0
  let updatedPlayer: PlayerState = { ...player, health, guards, gun, armor }

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
  let updatedPlayer = player
  let { phase } = combat
  let damageTaken = 0

  if (success) {
    if (player.brahmin > 0 && rng() < 0.30) {
      updatedPlayer = loseBrahmin(player)
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
    let armor = updatedPlayer.armor ? { ...updatedPlayer.armor } : null
    let armorAbsorb = 0
    if (armor && totalDamage > 0) {
      armorAbsorb = Math.min(armor.armorPoints, totalDamage)
      armor = { ...armor, armorPoints: armor.armorPoints - armorAbsorb }
    }
    const finalDamage = Math.max(0, totalDamage - armorAbsorb)
    updatedPlayer = { ...updatedPlayer, health: Math.max(0, updatedPlayer.health - finalDamage), armor }
    damageTaken = finalDamage
    log.push(`You try to run but the enemies catch you! They hit you for ${totalDamage} damage.${armorAbsorb > 0 ? ` Armor absorbed ${armorAbsorb}.` : ''}`)
    if (updatedPlayer.health <= 0) {
      phase = 'lost'
      log.push("You've been killed trying to flee.")
    }
  }

  return {
    player: updatedPlayer,
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
