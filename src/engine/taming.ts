import type { AnimStep, CombatState, MountState, PlayerState } from '../types/game'
import type { GameModeConfig } from '../data/modes'
import { TAMEABLE_ENEMY_IDS, TAMED_MOUNT_STATS, isTameable } from '../data/mounts'
import { rng, rngInt, rngWeightedPick } from './rng'
import { DEFAULT_ENEMY_ACCURACY, buildTargetRoster, resolveSingleAttack, targetLabel } from './combat'

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
  const accuracy = stats?.accuracy ?? DEFAULT_ENEMY_ACCURACY

  let health = player.health
  let guards = player.guards.map(g => ({ ...g }))
  let paGuards = player.paGuards.map(g => ({ ...g }))
  let armor = player.armor ? { ...player.armor } : null

  const roster = buildTargetRoster(guards, paGuards, player.mount)
  const target = rngWeightedPick(roster)
  const hit = !!target && rng() < accuracy

  const logLines: string[] = [`${enemy.name} is ENRAGED! Attacks for ${enragedDmg} damage!`]
  let finalDamage = 0
  let armorAbsorbed = 0
  let targetDied = false

  if (target && hit) {
    const label = targetLabel(target, guards, paGuards, player.mount)
    const result = resolveSingleAttack(target, enragedDmg, health, guards, paGuards, player.mount, armor)
    health = result.health
    guards = result.guards
    paGuards = result.paGuards
    armor = result.armor
    armorAbsorbed = result.armorAbsorbed
    targetDied = result.targetDied
    finalDamage = target.kind === 'player' ? enragedDmg - armorAbsorbed : 0

    if (target.kind === 'player') {
      logLines.push(armorAbsorbed > 0
        ? `Armor absorbed ${armorAbsorbed}. You take ${finalDamage} damage.`
        : `You take ${finalDamage} damage.`)
    } else if (target.kind === 'pa_guard' && armorAbsorbed > 0) {
      logLines.push(targetDied
        ? `Armor absorbs ${armorAbsorbed}. ${label} takes the rest — down!`
        : `Armor absorbs ${armorAbsorbed}. ${label} takes the rest.`)
    } else {
      logLines.push(targetDied ? `${label} takes the blow — down!` : `${label} takes the blow.`)
    }
  } else if (target) {
    logLines.push(`${enemy.name}'s attack misses.`)
  }

  const animStep: AnimStep = {
    kind: 'enemy_attack',
    enemyId: enemy.id,
    hit,
    damage: enragedDmg,
    targetKind: target?.kind ?? 'player',
    targetId: target?.id ?? 'player',
    targetHealthAfter: target?.kind === 'player' || !target ? health : (target.kind === 'guard' ? (guards.find(g => g.id === target.id)?.health ?? 0) : target.kind === 'pa_guard' ? (paGuards.find(g => g.id === target.id)?.health ?? 0) : (player.mount?.health ?? 0)),
    targetDied,
    armorAbsorbed: (target?.kind === 'player' || target?.kind === 'pa_guard') ? armorAbsorbed : undefined,
    logLine: logLines[logLines.length - 1],
  }

  // If the player is killed, mark combat as lost so afterCombat handles game over
  const phase: CombatState['phase'] = health <= 0 ? 'lost' : 'player_choice'
  if (health <= 0) logLines.push("You've been killed.")

  const updatedPlayer: PlayerState = { ...player, health, guards, paGuards, armor }
  const updatedCombat: CombatState = {
    ...combat,
    totalDamageTaken: combat.totalDamageTaken + finalDamage + armorAbsorbed,
    phase,
    log: [...combat.log, ...logLines],
    replaySteps: [...combat.replaySteps, animStep],
  }

  return { player: updatedPlayer, combat: updatedCombat, animStep }
}
