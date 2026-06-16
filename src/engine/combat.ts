import type { AnimStep, CombatState, EnemyUnit, GameType, PlayerState } from '../types/game'
import type { GameModeConfig } from '../data/modes'
import { rng, rngInt, rngWeightedPick } from './rng'
import { addChemStash } from './economy'
import { loseBrahmin } from './travel'
import { minEnemyCount } from './tuning'

const RUN_BASE_CHANCE      = 0.40
const RUN_GUARD_BONUS      = 0.10  // per guard (regular or PA)
const RUN_BRAHMIN_PENALTY  = 0.05  // per brahmin

const SPAWN_COUNT_FACTOR   = 7     // base: dangerLevel × SPAWN_COUNT_FACTOR


export function initiateCombat(
  dangerLevel: number,
  modeConfig: GameModeConfig,
  roadEnemyWeights?: Partial<Record<string, number>>,
  forcedEnemyTypeId?: string,
  forcedCount?: number,
  scaleFactor = 1,
  turn = 0,
  gameType: GameType = 'standard',
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

  const baseCount = Math.max(1, Math.round(dangerLevel * SPAWN_COUNT_FACTOR))
  const formulaCount = Math.max(1, Math.round(baseCount * (enemyType.countMultiplier ?? 1) * scaleFactor))
  const count = forcedCount ?? Math.max(formulaCount, minEnemyCount(turn, dangerLevel, gameType))

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

  const COMBAT_INTRO: Record<string, (n: number) => string> = {
    raider:       (n) => n === 1 ? "A Raider blocks the road ahead." : `${n} Raiders block the road ahead.`,
    feral_ghoul:  (n) => n === 1 ? "A Feral Ghoul lurches toward you." : `${n} Feral Ghouls close in from the darkness.`,
    radscorpion:  (n) => n === 1 ? "A Radscorpion rears up, claws snapping." : `${n} Radscorpions burst from the sand.`,
    yao_guai:     (n) => n === 1 ? "A Yao Guai charges, roaring." : `${n} Yao Guai surge from cover.`,
    super_mutant: (n) => n === 1 ? "A Super Mutant charges from the rubble." : `${n} Super Mutants block the road ahead.`,
    deathclaw:    (n) => n === 1 ? "A Deathclaw rounds the bend. Run or fight." : `${n} Deathclaws emerge from the ruins.`,
    fiend:        (n) => n === 1 ? "A Fiend rushes from cover, screaming." : `${n} Fiends pour out of cover.`,
    great_khan:   (n) => n === 1 ? "A Great Khan rides out of the dust." : `${n} Great Khans block the road ahead.`,
    legionnaire:  (n) => n === 1 ? "A Legionnaire steps from the shadows, blade drawn." : `${n} Legionnaires step from the shadows.`,
  }
  const description = COMBAT_INTRO[enemyType.id]?.(count) ?? (count === 1 ? `A ${enemyType.name} blocks the road ahead.` : `${count} ${enemyType.name}s block the road ahead.`)

  return {
    enemies,
    capsPool,
    totalDamageDealt: 0,
    totalDamageTaken: 0,
    enemyLoot,
    capsLooted: 0,
    xpGained: 0,
    phase: 'player_choice',
    log: [description],
  }
}

export function resolveFight(
  player: PlayerState,
  combat: CombatState,
  modeConfig: GameModeConfig,
): { player: PlayerState; combat: CombatState; animSteps: AnimStep[] } {
  if (!player.gun) {
    return { player, combat: { ...combat, log: [...combat.log, "You have no weapon!"] }, animSteps: [] }
  }
  if (player.gun.ammo === 0) {
    return { player, combat: { ...combat, log: [...combat.log, "You squeeze the trigger — click. No ammo."] }, animSteps: [] }
  }

  const log: string[] = []
  const animSteps: AnimStep[] = []
  const updatedEnemies = combat.enemies.map(e => ({ ...e }))
  let { capsPool } = combat
  let { health, guards } = player
  let powerArmorGuards = player.powerArmorGuards ?? 0
  let gun = { ...player.gun }
  let armor = player.armor ? { ...player.armor } : null
  let mount = player.mount ? { ...player.mount } : null
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
        target.dead = target.health <= 0
        const logLine = target.dead
          ? `You fire the ${gun.name} at ${target.name}. Hit! (${gun.damage} damage) — ${target.name} is dead!`
          : `You fire the ${gun.name} at ${target.name}. Hit! (${gun.damage} damage)`
        log.push(logLine)
        animSteps.push({ kind: 'shot', by: 'player', guardIdx: -1, hit: true, damage: dealt, targetId: target.id, targetDied: target.dead, targetHealthAfter: target.health, logLine })
      } else {
        const logLine = `You fire the ${gun.name} at ${target.name}. Missed.`
        log.push(logLine)
        animSteps.push({ kind: 'shot', by: 'player', guardIdx: -1, hit: false, damage: 0, targetId: target.id, targetDied: false, targetHealthAfter: target.health, logLine })
      }
    }
  } else {
    log.push(`Not enough ammo to fire the ${gun.name}.`)
  }

  // ── Guards fire (each costs 1 ammo from shared pool) ─────────────────────
  const allGuardCount = guards + powerArmorGuards
  for (let g = 0; g < allGuardCount; g++) {
    if (gun.ammo === 0) break
    gun.ammo -= 1
    const target = updatedEnemies.find(e => !e.dead)
    if (!target) break
    const isPAGuard = g >= guards
    const label = isPAGuard ? `PA Guard ${g - guards + 1}` : `Guard ${g + 1}`
    if (rng() < modeConfig.guardAccuracy) {
      const guardDmg = rngInt(modeConfig.guardDamage[0], modeConfig.guardDamage[1])
      const dealt = Math.min(guardDmg, target.health)
      damageDealt += dealt
      target.health = Math.max(0, target.health - guardDmg)
      target.dead = target.health <= 0
      const logLine = target.dead
        ? `${label} fires. Hit! (${guardDmg} damage) — ${target.name} is dead!`
        : `${label} fires. Hit! (${guardDmg} damage)`
      log.push(logLine)
      animSteps.push({ kind: 'shot', by: isPAGuard ? 'pa_guard' : 'guard', guardIdx: g, hit: true, damage: dealt, targetId: target.id, targetDied: target.dead, targetHealthAfter: target.health, logLine })
    } else {
      const logLine = `${label} fires. Missed.`
      log.push(logLine)
      animSteps.push({ kind: 'shot', by: isPAGuard ? 'pa_guard' : 'guard', guardIdx: g, hit: false, damage: 0, targetId: target.id, targetDied: false, targetHealthAfter: target.health, logLine })
    }
  }

  // ── Mount attacks (after guards, no ammo cost) ───────────────────────────
  if (mount && mount.health > 0) {
    const target = updatedEnemies.find(e => !e.dead)
    if (target) {
      if (rng() < mount.accuracy) {
        const mountDmg = rngInt(mount.damage[0], mount.damage[1])
        const dealt = Math.min(mountDmg, target.health)
        damageDealt += dealt
        target.health = Math.max(0, target.health - mountDmg)
        target.dead = target.health <= 0
        const logLine = target.dead
          ? `${mount.name} lunges at ${target.name}. Hit! (${mountDmg} damage) — ${target.name} is dead!`
          : `${mount.name} lunges at ${target.name}. Hit! (${mountDmg} damage)`
        log.push(logLine)
        animSteps.push({ kind: 'mount_attack', hit: true, damage: dealt, targetId: target.id, targetDied: target.dead, targetHealthAfter: target.health, logLine })
      } else {
        const logLine = `${mount.name} lunges at ${target.name}. Missed.`
        log.push(logLine)
        animSteps.push({ kind: 'mount_attack', hit: false, damage: 0, targetId: target.id, targetDied: false, targetHealthAfter: target.health, logLine })
      }
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

    // PA guards absorb first
    const paAbsorb = Math.min(powerArmorGuards, Math.floor(totalIncoming / modeConfig.powerArmorGuardHealth))
    const paAbsorbed = paAbsorb * modeConfig.powerArmorGuardHealth
    powerArmorGuards = Math.max(0, powerArmorGuards - paAbsorb)
    const postPADamage = Math.max(0, totalIncoming - paAbsorbed)

    // Regular guards absorb remaining
    const guardAbsorb = Math.min(guards, Math.floor(postPADamage / modeConfig.guardHealth))
    const absorbed = guardAbsorb * modeConfig.guardHealth
    guards = Math.max(0, guards - guardAbsorb)
    const postGuardDamage = Math.max(0, postPADamage - absorbed)

    // Armor absorbs remaining
    let armorAbsorb = 0
    if (armor && postGuardDamage > 0) {
      armorAbsorb = Math.min(armor.armorPoints, postGuardDamage)
      armor = { ...armor, armorPoints: armor.armorPoints - armorAbsorb }
    }
    const postArmorDamage = Math.max(0, postGuardDamage - armorAbsorb)

    // Mount absorbs last — only takes hits if guards and armor are exhausted
    let mountDamageTaken = 0
    let mountDied = false
    if (mount && mount.health > 0 && postArmorDamage > 0) {
      const mountAbsorb = Math.min(mount.health, postArmorDamage)
      mountDamageTaken = mountAbsorb
      mount = { ...mount, health: mount.health - mountAbsorb }
      mountDied = mount.health <= 0
      if (mountDied) mount = null
    }
    const finalDamage = Math.max(0, postArmorDamage - mountDamageTaken)
    health = Math.max(0, health - finalDamage)
    damageTaken = finalDamage + armorAbsorb + mountDamageTaken

    const retaliationLogLines: string[] = []
    if (paAbsorb > 0) retaliationLogLines.push(`${paAbsorb} power armor guard${paAbsorb > 1 ? 's' : ''} take the brunt of the attack.`)
    if (guardAbsorb > 0) retaliationLogLines.push(`${guardAbsorb} guard${guardAbsorb > 1 ? 's' : ''} take the brunt of the attack.`)
    if (armorAbsorb > 0) retaliationLogLines.push(`Your armor absorbs ${armorAbsorb} damage. (${armor!.armorPoints} AP remaining)`)
    if (mountDamageTaken > 0 && !mountDied) retaliationLogLines.push(`${player.mount!.name} shields you for ${mountDamageTaken} damage. (${mount!.health} HP remaining)`)
    if (mountDied) retaliationLogLines.push(`${player.mount!.name} shields you and falls!`)
    if (finalDamage > 0) retaliationLogLines.push(`Enemies hit you for ${finalDamage} damage.`)
    log.push(...retaliationLogLines)
    animSteps.push({ kind: 'retaliation', paGuardsLost: paAbsorb, guardsLost: guardAbsorb, armorAbsorb, hpDamage: finalDamage, mountDamageTaken, mountDied, logLines: retaliationLogLines })
  }

  // ── Determine outcome ─────────────────────────────────────────────────────
  let phase = combat.phase
  let wonCaps = 0
  let updatedPlayer: PlayerState = { ...player, health, guards, powerArmorGuards, gun, armor, mount }

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
      enragedEnemyIds: [],
    },
    animSteps,
  }
}

export function resolveRun(
  player: PlayerState,
  combat: CombatState,
  modeConfig: GameModeConfig,
): { player: PlayerState; combat: CombatState } {
  const totalGuards = player.guards + (player.powerArmorGuards ?? 0)
  const runChance = Math.min(0.9, Math.max(0.1,
    RUN_BASE_CHANCE + totalGuards * RUN_GUARD_BONUS - player.brahmin * RUN_BRAHMIN_PENALTY
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
    damageTaken = finalDamage + armorAbsorb
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
