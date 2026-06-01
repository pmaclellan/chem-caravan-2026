import type { CombatState, PlayerState } from '../types/game'
import { rng, rngInt } from './rng'

const RAIDER_HEALTH_PER = 40       // HP per raider
const RAIDER_CAPS_MIN = 20
const RAIDER_CAPS_MAX = 150
const RAIDER_DAMAGE_MIN = 10
const RAIDER_DAMAGE_MAX = 30       // per raider still alive
const RUN_BASE_CHANCE = 0.40
const RUN_GUARD_BONUS = 0.10       // per guard
const RUN_BRAHMIN_PENALTY = 0.05   // per brahmin
const RUN_FAIL_DAMAGE_MIN = 5
const RUN_FAIL_DAMAGE_MAX = 15     // per raider while fleeing

export function initiateCombat(dangerLevel: number): CombatState {
  const raiderCount = Math.max(1, Math.round(dangerLevel * 5))
  return {
    raiderCount,
    raiderHealth: raiderCount * RAIDER_HEALTH_PER,
    raiderCaps: raidersCarryCaps(raiderCount),
    phase: 'player_choice',
    log: [`${raiderCount} raider${raiderCount > 1 ? 's' : ''} block the road ahead.`],
  }
}

function raidersCarryCaps(count: number): number {
  let total = 0
  for (let i = 0; i < count; i++) total += rngInt(RAIDER_CAPS_MIN, RAIDER_CAPS_MAX)
  return total
}

export function resolveFight(
  player: PlayerState,
  combat: CombatState,
): { player: PlayerState; combat: CombatState } {
  if (!player.gun || player.gun.ammo < player.gun.ammoPerShot) {
    const log = [...combat.log, "You squeeze the trigger — click. No ammo."]
    return { player, combat: { ...combat, log } }
  }

  const log: string[] = []
  let { raiderHealth, raiderCaps } = combat
  let { health, guards } = player
  const gun = { ...player.gun, ammo: player.gun.ammo - player.gun.ammoPerShot }

  // Player shoots
  const hit = rng() < gun.accuracy
  if (hit) {
    raiderHealth = Math.max(0, raiderHealth - gun.damage)
    log.push(`You fire the ${gun.name}. Hit! (${gun.damage} damage)`)
  } else {
    log.push(`You fire the ${gun.name}. Missed.`)
  }

  // Raiders attack if still alive
  const aliveRaiders = Math.ceil(raiderHealth / RAIDER_HEALTH_PER)
  if (raiderHealth > 0) {
    const damage = aliveRaiders * rngInt(RAIDER_DAMAGE_MIN, RAIDER_DAMAGE_MAX)
    const guardAbsorb = Math.min(guards, Math.floor(damage / 20))
    const guardDamageAbsorbed = guardAbsorb * 20
    const playerDamage = Math.max(0, damage - guardDamageAbsorbed)
    guards = Math.max(0, guards - guardAbsorb)
    health = Math.max(0, health - playerDamage)
    if (guardAbsorb > 0) log.push(`${guardAbsorb} guard${guardAbsorb > 1 ? 's' : ''} take the brunt of the attack.`)
    if (playerDamage > 0) log.push(`Raiders hit you for ${playerDamage} damage.`)
  }

  // Check outcome
  let phase = combat.phase
  let wonCaps = 0
  if (raiderHealth <= 0) {
    phase = 'won'
    wonCaps = raiderCaps
    raiderCaps = 0
    log.push(`Raiders defeated! You loot ${wonCaps} caps from their bodies.`)
  }

  if (health <= 0) {
    phase = 'lost'
    log.push("You've been killed.")
  }

  return {
    player: { ...player, health, guards, gun, caps: player.caps + wonCaps },
    combat: { ...combat, raiderHealth, raiderCaps, raiderCount: aliveRaiders, phase, log: [...combat.log, ...log] },
  }
}

export function resolveRun(
  player: PlayerState,
  combat: CombatState,
): { player: PlayerState; combat: CombatState } {
  const runChance = Math.min(0.9, Math.max(0.1,
    RUN_BASE_CHANCE + player.guards * RUN_GUARD_BONUS - player.brahmin * RUN_BRAHMIN_PENALTY
  ))
  const success = rng() < runChance
  const log: string[] = []
  let { health, brahmin } = player
  let { phase } = combat

  if (success) {
    // Chance to lose a brahmin while fleeing
    if (brahmin > 0 && rng() < 0.30) {
      brahmin = brahmin - 1
      log.push("You escape! But one of your brahmin couldn't keep up and bolted.")
    } else {
      log.push("You manage to escape!")
    }
    phase = 'fled'
  } else {
    const aliveRaiders = Math.ceil(combat.raiderHealth / RAIDER_HEALTH_PER)
    const damage = aliveRaiders * rngInt(RUN_FAIL_DAMAGE_MIN, RUN_FAIL_DAMAGE_MAX)
    health = Math.max(0, health - damage)
    log.push(`You try to run but the raiders catch you! They hit you for ${damage} damage.`)
    if (health <= 0) {
      phase = 'lost'
      log.push("You've been killed trying to flee.")
    }
  }

  return {
    player: { ...player, health, brahmin },
    combat: { ...combat, phase, log: [...combat.log, ...log] },
  }
}
