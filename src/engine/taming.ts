import type { AnimStep, CombatState, MountState, PlayerState } from '../types/game'
import type { GameModeConfig } from '../data/modes'
import { TAMEABLE_ENEMY_IDS, TAMED_MOUNT_STATS, isTameable } from '../data/mounts'
import { rngInt } from './rng'

export function canAttemptTame(player: PlayerState, combat: CombatState): boolean {
  const alive = combat.enemies.filter(e => !e.dead)
  if (alive.length !== 1) return false
  const enemy = alive[0]
  return (
    TAMEABLE_ENEMY_IDS.has(enemy.typeId) &&
    !!player.tamingTool &&
    player.hasSaddle &&
    !player.mount
  )
}

// Called when the taming mini-game succeeds (3 green hits).
// Marks the tamed enemy dead (so XP is awarded via afterCombat), sets player.mount,
// consumes the taming tool, and transitions combat to 'won'.
export function resolveTameSuccess(
  player: PlayerState,
  combat: CombatState,
): { player: PlayerState; combat: CombatState } {
  const enemy = combat.enemies.find(e => !e.dead)
  if (!enemy || !isTameable(enemy.typeId)) {
    return { player, combat: { ...combat, log: [...combat.log, "Nothing to tame."] } }
  }

  const mountDef = TAMED_MOUNT_STATS[enemy.typeId]
  const mount: MountState = { ...mountDef }

  const updatedEnemies = combat.enemies.map(e =>
    e.id === enemy.id ? { ...e, dead: true } : e
  )
  const log = [...combat.log, `${enemy.name} submits. ${mount.name} is yours.`]

  return {
    player: { ...player, tamingTool: null, mount },
    combat: {
      ...combat,
      enemies: updatedEnemies,
      capsPool: 0,    // no caps looted from tamed creature
      phase: 'won',
      log,
    },
  }
}

// Called when the taming mini-game is abandoned / closed.
// The creature is enraged and attacks immediately (+20% damage).
// Returns the updated state plus a retaliation AnimStep so the animation plays.
export function resolveFailedTame(
  player: PlayerState,
  combat: CombatState,
  modeConfig: GameModeConfig,
): { player: PlayerState; combat: CombatState; animStep: AnimStep } {
  const enemy = combat.enemies.find(e => !e.dead)!
  const stats = modeConfig.enemyStats[enemy.typeId]
  const rawDmg = stats ? rngInt(stats.damage[0], stats.damage[1]) : rngInt(10, 30)
  const enragedDmg = Math.round(rawDmg * 1.2)

  // Damage cascade: PA Guards → Regular Guards → Armor → HP
  let { health, guards } = player
  let powerArmorGuards = player.powerArmorGuards ?? 0
  let armor = player.armor ? { ...player.armor } : null
  let totalIncoming = enragedDmg

  const paAbsorb = Math.min(powerArmorGuards, Math.floor(totalIncoming / modeConfig.powerArmorGuardHealth))
  const paAbsorbed = paAbsorb * modeConfig.powerArmorGuardHealth
  powerArmorGuards = Math.max(0, powerArmorGuards - paAbsorb)
  const postPADamage = Math.max(0, totalIncoming - paAbsorbed)

  const guardAbsorb = Math.min(guards, Math.floor(postPADamage / modeConfig.guardHealth))
  const guardAbsorbed = guardAbsorb * modeConfig.guardHealth
  guards = Math.max(0, guards - guardAbsorb)
  const postGuardDamage = Math.max(0, postPADamage - guardAbsorbed)

  let armorAbsorb = 0
  if (armor && postGuardDamage > 0) {
    armorAbsorb = Math.min(armor.armorPoints, postGuardDamage)
    armor = { ...armor, armorPoints: armor.armorPoints - armorAbsorb }
  }
  const finalDamage = Math.max(0, postGuardDamage - armorAbsorb)
  health = Math.max(0, health - finalDamage)

  const logLines: string[] = [`${enemy.name} is ENRAGED! Attacks for ${enragedDmg} damage!`]
  if (paAbsorb > 0) logLines.push(`${paAbsorb} power armor guard${paAbsorb > 1 ? 's' : ''} absorbed the blow.`)
  if (guardAbsorb > 0) logLines.push(`${guardAbsorb} guard${guardAbsorb > 1 ? 's' : ''} absorbed the blow.`)
  if (armorAbsorb > 0) logLines.push(`Armor absorbed ${armorAbsorb}. (${armor!.armorPoints} AP remaining)`)
  if (finalDamage > 0) logLines.push(`You take ${finalDamage} damage.`)

  const animStep: AnimStep = {
    kind: 'retaliation',
    paGuardsLost: paAbsorb,
    guardsLost: guardAbsorb,
    armorAbsorb,
    hpDamage: finalDamage,
    mountDamageTaken: 0,
    mountDied: false,
    logLines,
  }

  // If the player is killed, mark combat as lost so afterCombat handles game over
  const phase: CombatState['phase'] = health <= 0 ? 'lost' : 'player_choice'
  if (health <= 0) logLines.push("You've been killed.")

  const updatedPlayer: PlayerState = { ...player, health, guards, powerArmorGuards, armor }
  const updatedCombat: CombatState = {
    ...combat,
    totalDamageTaken: combat.totalDamageTaken + finalDamage + armorAbsorb,
    phase,
    log: [...combat.log, ...logLines],
  }

  return { player: updatedPlayer, combat: updatedCombat, animStep }
}
