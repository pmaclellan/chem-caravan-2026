import type { ActiveBuff, AnimStep, ArmorState, CombatState, EnemyUnit, GameType, GuardUnit, MountState, PAGuardUnit, PlayerState } from '../types/game'
import type { GameModeConfig } from '../data/modes'
import { GUARD_CLASSES } from '../data/guardClasses'
import { rng, rngInt, rngWeightedPick } from './rng'
import { addChemStash } from './economy'
import { loseBrahmin } from './travel'
import { minEnemyCount, runEscapeChance } from './tuning'

const SPAWN_COUNT_FACTOR = 5  // base: dangerLevel × SPAWN_COUNT_FACTOR

export function computeEnemyCount(
  dangerLevel: number,
  countMultiplier: number,
  scaleFactor: number,
  turn: number,
  gameType: GameType,
): number {
  const baseCount = Math.max(1, Math.round(dangerLevel * SPAWN_COUNT_FACTOR))
  const formulaCount = Math.max(1, Math.round(baseCount * countMultiplier * scaleFactor))
  return Math.max(formulaCount, minEnemyCount(turn, dangerLevel, gameType))
}

export function initiateCombat(
  dangerLevel: number,
  modeConfig: GameModeConfig,
  roadEnemyWeights?: Partial<Record<string, number>>,
  forcedEnemyTypeId?: string,
  forcedCount?: number,
  scaleFactor = 1,
  turn = 0,
  gameType: GameType = 'standard',
  waveNumber = 1,
  isCheckpointFight = false,
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

  const count = forcedCount ?? computeEnemyCount(dangerLevel, enemyType.countMultiplier ?? 1, scaleFactor, turn, gameType)

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
    raider:        (n) => n === 1 ? "A Raider blocks the road ahead." : `${n} Raiders block the road ahead.`,
    feral_ghoul:   (n) => n === 1 ? "A Feral Ghoul lurches toward you." : `${n} Feral Ghouls close in from the darkness.`,
    radscorpion:   (n) => n === 1 ? "A Radscorpion rears up, claws snapping." : `${n} Radscorpions burst from the sand.`,
    yao_guai:      (n) => n === 1 ? "A Yao Guai charges, roaring." : `${n} Yao Guai surge from cover.`,
    super_mutant:  (n) => n === 1 ? "A Super Mutant charges from the rubble." : `${n} Super Mutants block the road ahead.`,
    deathclaw:     (n) => n === 1 ? "A Deathclaw rounds the bend. Run or fight." : `${n} Deathclaws emerge from the ruins.`,
    fiend:         (n) => n === 1 ? "A Fiend rushes from cover, screaming." : `${n} Fiends pour out of cover.`,
    great_khan:    (n) => n === 1 ? "A Great Khan rides out of the dust." : `${n} Great Khans block the road ahead.`,
    legionnaire:   (n) => n === 1 ? "A Legionnaire steps from the shadows, blade drawn." : `${n} Legionnaires step from the shadows.`,
    powder_ganger: (n) => n === 1 ? "A Powder Ganger raises a lit stick of dynamite." : `${n} Powder Gangers light their dynamite.`,
    cazador:       (n) => n === 1 ? "A Cazador darts from the brush, wings buzzing." : `${n} Cazadores swarm out of the canyon.`,
    thug:          (n) => n === 1 ? "A Thug steps out of the alley, cracking his knuckles." : `${n} Thugs spill out of the alleyway, looking for trouble.`,
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
    waveNumber,
    isCheckpointFight,
    priorWaveCapsLooted: 0,
    priorWaveXpGained: 0,
    priorWaveEnemyLoot: {},
    activeBuffs: [],
    chemUsesThisRound: 0,
    replaySteps: [],
  }
}

// Base 1 manual Field Medicine use per round, +1 for each living Medic guard in the squad.
export function chemUseCap(player: PlayerState): number {
  const medicCount = player.guards.filter(g => !g.dead && GUARD_CLASSES[g.classId].grantsExtraChemUse).length
  return 1 + medicCount
}

// ── Per-attack targeting — shared by resolveFight() and taming.ts's failed-tame retaliation ──

export interface TargetRef { kind: 'player' | 'guard' | 'pa_guard' | 'mount'; id: string; weight: number }

export const TARGET_WEIGHTS = { player: 1, guard: 2, paGuard: 4, mount: 2 }  // tunable — front line draws more fire
export const DEFAULT_ENEMY_ACCURACY = 0.80  // used when an enemy type has no explicit accuracy in enemyStats

export function buildTargetRoster(guards: GuardUnit[], paGuards: PAGuardUnit[], mount: MountState | null): TargetRef[] {
  const roster: TargetRef[] = [{ kind: 'player', id: 'player', weight: TARGET_WEIGHTS.player }]
  for (const g of guards) {
    if (!g.dead) roster.push({ kind: 'guard', id: g.id, weight: TARGET_WEIGHTS.guard })
  }
  for (const g of paGuards) {
    if (!g.dead) roster.push({ kind: 'pa_guard', id: g.id, weight: TARGET_WEIGHTS.paGuard })
  }
  if (mount && mount.health > 0) {
    roster.push({ kind: 'mount', id: 'mount', weight: TARGET_WEIGHTS.mount })
  }
  return roster
}

export interface SingleAttackResult {
  health: number
  guards: GuardUnit[]
  paGuards: PAGuardUnit[]
  mount: MountState | null
  armor: ArmorState | null
  targetHealthAfter: number
  targetDied: boolean
  armorAbsorbed: number
}

// Applies a landed hit (accuracy already resolved by the caller) against a chosen target.
// Armor mitigates only when the target is the player — it's the player's own gear, guards don't wear it.
export function resolveSingleAttack(
  target: TargetRef,
  damage: number,
  health: number,
  guards: GuardUnit[],
  paGuards: PAGuardUnit[],
  mount: MountState | null,
  armor: ArmorState | null,
): SingleAttackResult {
  if (target.kind === 'player') {
    let armorAbsorbed = 0
    let newArmor = armor
    if (armor && armor.armorPoints > 0) {
      armorAbsorbed = Math.min(armor.armorPoints, damage)
      newArmor = { ...armor, armorPoints: armor.armorPoints - armorAbsorbed }
    }
    const newHealth = Math.max(0, health - (damage - armorAbsorbed))
    return { health: newHealth, guards, paGuards, mount, armor: newArmor, targetHealthAfter: newHealth, targetDied: newHealth <= 0, armorAbsorbed }
  }

  if (target.kind === 'guard') {
    let targetHealthAfter = 0
    const newGuards = guards.map(g => {
      if (g.id !== target.id) return g
      targetHealthAfter = Math.max(0, g.health - damage)
      return { ...g, health: targetHealthAfter, dead: targetHealthAfter <= 0 }
    })
    return { health, guards: newGuards, paGuards, mount, armor, targetHealthAfter, targetDied: targetHealthAfter <= 0, armorAbsorbed: 0 }
  }

  if (target.kind === 'pa_guard') {
    let targetHealthAfter = 0
    let paGuardArmorAbsorbed = 0
    const newPAGuards = paGuards.map(g => {
      if (g.id !== target.id) return g
      paGuardArmorAbsorbed = Math.min(g.armorPoints, damage)
      targetHealthAfter = Math.max(0, g.health - (damage - paGuardArmorAbsorbed))
      return { ...g, health: targetHealthAfter, armorPoints: g.armorPoints - paGuardArmorAbsorbed, dead: targetHealthAfter <= 0 }
    })
    return { health, guards, paGuards: newPAGuards, mount, armor, targetHealthAfter, targetDied: targetHealthAfter <= 0, armorAbsorbed: paGuardArmorAbsorbed }
  }

  // mount
  const currentMountHealth = mount?.health ?? 0
  const newMountHealth = Math.max(0, currentMountHealth - damage)
  const mountDied = newMountHealth <= 0
  const newMount = mountDied ? null : (mount ? { ...mount, health: newMountHealth } : null)
  return { health, guards, paGuards, mount: newMount, armor, targetHealthAfter: newMountHealth, targetDied: mountDied, armorAbsorbed: 0 }
}

export function targetLabel(target: TargetRef, guards: GuardUnit[], paGuards: PAGuardUnit[], mount: MountState | null): string {
  if (target.kind === 'player') return 'you'
  if (target.kind === 'mount') return mount?.name ?? 'your mount'
  if (target.kind === 'pa_guard') return `PA Guard ${paGuards.findIndex(g => g.id === target.id) + 1}`
  return `Guard ${guards.findIndex(g => g.id === target.id) + 1}`
}

const ACCURACY_CEILING = 0.95

// Looks up an active Jet/Ultrajet accuracy bonus for a specific firer (player/guard/pa_guard) and
// applies it to their base accuracy, clamped so there's always at least a 5% miss chance.
export function applyAccuracyBuff(
  baseAccuracy: number,
  activeBuffs: ActiveBuff[],
  targetKind: 'player' | 'guard' | 'pa_guard',
  targetId: string,
): number {
  const buff = activeBuffs.find(b => b.targetKind === targetKind && b.targetId === targetId)
  return Math.min(ACCURACY_CEILING, baseAccuracy + (buff?.accuracyBonus ?? 0))
}

// Ticks buff durations down by one round and expires any that hit 0 — call once per resolved round.
export function tickActiveBuffs(activeBuffs: ActiveBuff[]): ActiveBuff[] {
  return activeBuffs.map(b => ({ ...b, roundsRemaining: b.roundsRemaining - 1 })).filter(b => b.roundsRemaining > 0)
}

export function resolveFight(
  player: PlayerState,
  combat: CombatState,
  modeConfig: GameModeConfig,
): { player: PlayerState; combat: CombatState; animSteps: AnimStep[] } {
  if (player.gun?.requiresPowerArmor && player.armor?.id !== 'power_armor') {
    return { player, combat: { ...combat, log: [...combat.log, `${player.gun.name} requires YOU to be wearing Power Armor (not the same as power armor guards). Equip a suit from the Armory.`] }, animSteps: [] }
  }
  const log: string[] = []
  const animSteps: AnimStep[] = []
  const updatedEnemies = combat.enemies.map(e => ({ ...e }))
  let { capsPool } = combat
  let health = player.health
  let guards = player.guards.map(g => ({ ...g }))
  let paGuards = player.paGuards.map(g => ({ ...g }))
  let gun = player.gun ? { ...player.gun } : null
  let armor = player.armor ? { ...player.armor } : null
  let mount = player.mount ? { ...player.mount } : null
  let damageDealt = 0

  // ── Player fires (only if armed) ─────────────────────────────────────────
  if (gun) {
  const shotsPerTurn = gun.shotsPerTurn ?? 1
  const isBurst = shotsPerTurn > 1
  const inCooldown = (gun.cooldownRemaining ?? 0) > 0
  const playerCanFire = !inCooldown && gun.ammo >= gun.ammoPerShot
  if (inCooldown) {
    const remaining = gun.cooldownRemaining! - 1
    gun = { ...gun, cooldownRemaining: remaining }
    const msg = remaining > 0
      ? `Reloading ${gun.name}… (${remaining} turn${remaining > 1 ? 's' : ''} remaining)`
      : `Reloading ${gun.name}… Ready next turn.`
    log.push(msg)
  } else if (playerCanFire) {
    gun.ammo -= gun.ammoPerShot
    if (gun.cooldownTurns) gun.cooldownRemaining = gun.cooldownTurns
    // Threaded onto this shot's AnimStep so the UI can sync the reload badge to the shot's own animation
    const shooterCooldownRemaining = gun.cooldownTurns ? gun.cooldownRemaining : undefined
    const venomedAccuracy = (combat.playerVenomed ?? false) ? gun.accuracy * 0.70 : gun.accuracy
    const effectiveAccuracy = applyAccuracyBuff(venomedAccuracy, combat.activeBuffs, 'player', 'player')

    // Collect burst shots to emit as a single burst animStep
    const burstShots: Array<{ targetId: string | null; hit: boolean; damage: number; targetDied: boolean; targetHealthAfter: number; logLine: string }> = []

    for (let s = 0; s < shotsPerTurn; s++) {
      const target = updatedEnemies.find(e => !e.dead)
      if (!target) break
      const shotLabel = isBurst ? ` (shot ${s + 1})` : ''
      const dmg = gun.damageRange ? rngInt(gun.damageRange[0], gun.damageRange[1]) : gun.damage
      if (rng() < effectiveAccuracy) {
        const dealt = Math.min(dmg, target.health)
        damageDealt += dealt
        target.health = Math.max(0, target.health - dmg)
        target.dead = target.health <= 0
        const logLine = target.dead
          ? `You fire the ${gun.name}${shotLabel} at ${target.name}. Hit! (${dmg} damage) — ${target.name} is dead!`
          : `You fire the ${gun.name}${shotLabel} at ${target.name}. Hit! (${dmg} damage)`
        log.push(logLine)

        // Splash damage — hits subsequent alive enemies at decreasing ratios
        const splashHits: Array<{ targetId: string; damage: number; died: boolean; healthAfter: number; logLine: string }> = []
        if (gun.splashRatios && gun.splashRatios.length > 0) {
          const splashTargets = updatedEnemies.filter(e => !e.dead && e.id !== target.id)
          for (let si = 0; si < Math.min(gun.splashRatios.length, splashTargets.length); si++) {
            const st = splashTargets[si]
            const splashDmg = Math.max(1, Math.round(dmg * gun.splashRatios[si]))
            const splashDealt = Math.min(splashDmg, st.health)
            damageDealt += splashDealt
            st.health = Math.max(0, st.health - splashDmg)
            st.dead = st.health <= 0
            const splashLine = st.dead
              ? `Blast wave hits ${st.name} for ${splashDmg} damage — ${st.name} is dead!`
              : `Blast wave hits ${st.name} for ${splashDmg} damage.`
            log.push(splashLine)
            splashHits.push({ targetId: st.id, damage: splashDealt, died: st.dead, healthAfter: st.health, logLine: splashLine })
          }
        }

        if (isBurst) {
          burstShots.push({ targetId: target.id, hit: true, damage: dealt, targetDied: target.dead, targetHealthAfter: target.health, logLine })
        } else if (splashHits.length > 0) {
          animSteps.push({ kind: 'blast', shooterId: null, primaryTargetId: target.id, primaryDamage: dealt, primaryDied: target.dead, primaryHealthAfter: target.health, splashHits, logLine, shooterCooldownRemaining })
        } else {
          animSteps.push({ kind: 'shot', by: 'player', shooterId: null, hit: true, damage: dealt, targetId: target.id, targetDied: target.dead, targetHealthAfter: target.health, logLine, shooterCooldownRemaining })
        }
      } else {
        const logLine = `You fire the ${gun.name}${shotLabel} at ${target.name}. Missed.`
        log.push(logLine)

        // Stray shot — missed primary but may clip a random other alive enemy
        let strayShot: typeof burstShots[0] | null = null
        if (gun.strayChance && rng() < gun.strayChance) {
          const others = updatedEnemies.filter(e => !e.dead && e.id !== target.id)
          if (others.length > 0) {
            const stray = others[Math.floor(rng() * others.length)]
            const strayDealt = Math.min(dmg, stray.health)
            damageDealt += strayDealt
            stray.health = Math.max(0, stray.health - dmg)
            stray.dead = stray.health <= 0
            const strayLine = stray.dead
              ? `Stray round clips ${stray.name} for ${dmg} damage — ${stray.name} is dead!`
              : `Stray round clips ${stray.name} for ${dmg} damage.`
            log.push(strayLine)
            strayShot = { targetId: stray.id, hit: true, damage: strayDealt, targetDied: stray.dead, targetHealthAfter: stray.health, logLine: strayLine }
          }
        }

        if (isBurst) {
          // Miss: push the miss shot; if there's a stray, push it as a hit immediately after
          burstShots.push({ targetId: target.id, hit: false, damage: 0, targetDied: false, targetHealthAfter: target.health, logLine })
          if (strayShot) burstShots.push(strayShot)
        } else {
          animSteps.push({ kind: 'shot', by: 'player', shooterId: null, hit: false, damage: 0, targetId: target.id, targetDied: false, targetHealthAfter: target.health, logLine, shooterCooldownRemaining })
          if (strayShot) {
            animSteps.push({ kind: 'shot', by: 'player', shooterId: null, hit: true, damage: strayShot.damage, targetId: strayShot.targetId, targetDied: strayShot.targetDied, targetHealthAfter: strayShot.targetHealthAfter, logLine: strayShot.logLine })
          }
        }
      }
    }

    if (isBurst && burstShots.length > 0) {
      animSteps.push({ kind: 'burst', shots: burstShots, shooterCooldownRemaining })
    }
  } else {
    log.push(`Not enough ammo to fire the ${gun.name}.`)
  }
  } else {
    log.push('You have no weapon equipped!')
  } // end if (gun)

  // ── Guards fire with their own sidearms (no shared ammo pool) ────────────
  const aliveGuardUnits = guards.filter(g => !g.dead)
  for (const guardUnit of aliveGuardUnits) {
    const classDef = GUARD_CLASSES[guardUnit.classId]
    const label = `Guard ${guards.findIndex(g => g.id === guardUnit.id) + 1}`

    const inCooldown = (guardUnit.cooldownRemaining ?? 0) > 0
    if (inCooldown) {
      const remaining = guardUnit.cooldownRemaining! - 1
      guardUnit.cooldownRemaining = remaining
      log.push(remaining > 0
        ? `${label} reloads… (${remaining} turn${remaining > 1 ? 's' : ''} remaining)`
        : `${label} reloads… Ready next turn.`)
      continue
    }

    const target = updatedEnemies.find(e => !e.dead)
    if (!target) break
    const guardAccuracy = applyAccuracyBuff(classDef.accuracy, combat.activeBuffs, 'guard', guardUnit.id)
    if (classDef.cooldownTurns) guardUnit.cooldownRemaining = classDef.cooldownTurns
    // Threaded onto this shot's AnimStep so the UI can sync the reload badge to the shot's own animation
    const shooterCooldownRemaining = classDef.cooldownTurns ? guardUnit.cooldownRemaining : undefined

    if (rng() < guardAccuracy) {
      const dmg = rngInt(classDef.damage[0], classDef.damage[1])
      const dealt = Math.min(dmg, target.health)
      damageDealt += dealt
      target.health = Math.max(0, target.health - dmg)
      target.dead = target.health <= 0
      const logLine = target.dead
        ? `${label} fires. Hit! (${dmg} damage) — ${target.name} is dead!`
        : `${label} fires. Hit! (${dmg} damage)`
      log.push(logLine)

      // Shotgunner: sprays into additional alive enemies at decreasing ratios, landing in the
      // same instant as the primary hit (one 'blast' step) rather than as separate sequential shots
      const splashHits: Array<{ targetId: string; damage: number; died: boolean; healthAfter: number; logLine: string }> = []
      if (classDef.splashRatios && classDef.splashRatios.length > 0) {
        const splashTargets = updatedEnemies.filter(e => !e.dead && e.id !== target.id)
        for (let si = 0; si < Math.min(classDef.splashRatios.length, splashTargets.length); si++) {
          const st = splashTargets[si]
          const splashDmg = Math.max(1, Math.round(dmg * classDef.splashRatios[si]))
          const splashDealt = Math.min(splashDmg, st.health)
          damageDealt += splashDealt
          st.health = Math.max(0, st.health - splashDmg)
          st.dead = st.health <= 0
          const splashLine = st.dead
            ? `${label}'s spray catches ${st.name} for ${splashDmg} damage — ${st.name} is dead!`
            : `${label}'s spray catches ${st.name} for ${splashDmg} damage.`
          log.push(splashLine)
          splashHits.push({ targetId: st.id, damage: splashDealt, died: st.dead, healthAfter: st.health, logLine: splashLine })
        }
      }

      if (splashHits.length > 0) {
        animSteps.push({ kind: 'blast', shooterId: guardUnit.id, primaryTargetId: target.id, primaryDamage: dealt, primaryDied: target.dead, primaryHealthAfter: target.health, splashHits, logLine, shooterCooldownRemaining })
      } else {
        animSteps.push({ kind: 'shot', by: 'guard', shooterId: guardUnit.id, hit: true, damage: dealt, targetId: target.id, targetDied: target.dead, targetHealthAfter: target.health, logLine, shooterCooldownRemaining })
      }
    } else {
      const logLine = `${label} fires. Missed.`
      log.push(logLine)
      animSteps.push({ kind: 'shot', by: 'guard', shooterId: guardUnit.id, hit: false, damage: 0, targetId: target.id, targetDied: false, targetHealthAfter: target.health, logLine, shooterCooldownRemaining })
    }
  }

  // ── PA guards fire (unclassed, flat per-mode stats, minigun burst) ───────
  const alivePAGuardUnits = paGuards.filter(g => !g.dead)
  for (const paGuardUnit of alivePAGuardUnits) {
    const label = `PA Guard ${paGuards.findIndex(g => g.id === paGuardUnit.id) + 1}`
    const shots = modeConfig.powerArmorGuardShotsPerTurn
    const acc   = applyAccuracyBuff(modeConfig.powerArmorGuardAccuracy, combat.activeBuffs, 'pa_guard', paGuardUnit.id)
    const dmgRange = modeConfig.powerArmorGuardDamage
    const burstShots: Array<{ targetId: string | null; hit: boolean; damage: number; targetDied: boolean; targetHealthAfter: number; logLine: string }> = []
    for (let s = 0; s < shots; s++) {
      const t = updatedEnemies.find(e => !e.dead)
      if (!t) break
      if (rng() < acc) {
        const dmg = rngInt(dmgRange[0], dmgRange[1])
        const dealt = Math.min(dmg, t.health)
        damageDealt += dealt
        t.health = Math.max(0, t.health - dmg)
        t.dead = t.health <= 0
        const logLine = t.dead
          ? `${label} fires. Hit! (${dmg} damage) — ${t.name} is dead!`
          : `${label} fires. Hit! (${dmg} damage)`
        log.push(logLine)
        burstShots.push({ targetId: t.id, hit: true, damage: dealt, targetDied: t.dead, targetHealthAfter: t.health, logLine })
      } else {
        const t2 = updatedEnemies.find(e => !e.dead)
        const logLine = `${label} fires. Missed.`
        log.push(logLine)
        burstShots.push({ targetId: t2?.id ?? null, hit: false, damage: 0, targetDied: false, targetHealthAfter: t2?.health ?? 0, logLine })
      }
    }
    if (burstShots.length > 0) animSteps.push({ kind: 'pa_burst', shooterId: paGuardUnit.id, shots: burstShots })
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

  // ── Surviving enemies attack — each resolves independently against a weighted target ──
  const aliveEnemies = updatedEnemies.filter(e => !e.dead)
  let damageTaken = 0
  let playerVenomed = combat.playerVenomed ?? false

  if (aliveEnemies.length > 0) {
    let roster = buildTargetRoster(guards, paGuards, mount)
    let venomApplied = false

    for (const enemy of aliveEnemies) {
      if (roster.length === 0 || health <= 0) break
      const stats = modeConfig.enemyStats[enemy.typeId]
      const dmg = stats ? rngInt(stats.damage[0], stats.damage[1]) : rngInt(10, 30)
      const accuracy = stats?.accuracy ?? DEFAULT_ENEMY_ACCURACY
      const target = rngWeightedPick(roster)
      if (!target) break

      const label = targetLabel(target, guards, paGuards, mount)

      if (rng() < accuracy) {
        const result = resolveSingleAttack(target, dmg, health, guards, paGuards, mount, armor)
        health = result.health
        guards = result.guards
        paGuards = result.paGuards
        mount = result.mount
        armor = result.armor
        damageTaken += dmg

        const logLine = target.kind === 'player'
          ? (result.armorAbsorbed > 0
              ? `${enemy.name} fires at you. Hit! Armor absorbs ${result.armorAbsorbed}, you take ${dmg - result.armorAbsorbed} damage.`
              : `${enemy.name} fires at you. Hit! (${dmg} damage)`)
          : target.kind === 'pa_guard' && result.armorAbsorbed > 0
            ? `${enemy.name} fires at ${label}. Hit! Armor absorbs ${result.armorAbsorbed}, ${label} takes ${dmg - result.armorAbsorbed} damage.${result.targetDied ? ` — ${label} is down!` : ''}`
            : result.targetDied
              ? `${enemy.name} fires at ${label}. Hit! (${dmg} damage) — ${label} is down!`
              : `${enemy.name} fires at ${label}. Hit! (${dmg} damage)`
        log.push(logLine)

        animSteps.push({
          kind: 'enemy_attack',
          enemyId: enemy.id,
          hit: true,
          damage: dmg,
          targetKind: target.kind,
          targetId: target.id,
          targetHealthAfter: result.targetHealthAfter,
          targetDied: result.targetDied,
          armorAbsorbed: (target.kind === 'player' || target.kind === 'pa_guard') ? result.armorAbsorbed : undefined,
          logLine,
        })

        if (target.kind === 'player' && enemy.typeId === 'cazador' && !playerVenomed && (dmg - result.armorAbsorbed) > 0) {
          playerVenomed = true
          venomApplied = true
        }

        if (result.targetDied) {
          roster = roster.filter(r => r.id !== target.id)
        }
      } else {
        const logLine = `${enemy.name} fires at ${label}. Missed.`
        log.push(logLine)
        const currentTargetHealth =
          target.kind === 'player'   ? health :
          target.kind === 'mount'    ? (mount?.health ?? 0) :
          target.kind === 'pa_guard' ? (paGuards.find(g => g.id === target.id)?.health ?? 0) :
                                        (guards.find(g => g.id === target.id)?.health ?? 0)
        animSteps.push({
          kind: 'enemy_attack',
          enemyId: enemy.id,
          hit: false,
          damage: 0,
          targetKind: target.kind,
          targetId: target.id,
          targetHealthAfter: currentTargetHealth,
          targetDied: false,
          logLine,
        })
      }
    }

    // Venom DoT — ticks every round starting the round AFTER the initial sting
    // (gated on the *incoming* playerVenomed state, so the sting round itself doesn't also tick)
    let venomDotDamage = 0
    if (combat.playerVenomed ?? false) {
      venomDotDamage = 5
      health = Math.max(0, health - venomDotDamage)
      damageTaken += venomDotDamage
      log.push(`Venom burns through you. -${venomDotDamage} HP.`)
    }
    if (venomApplied) {
      log.push('Cazador venom enters your bloodstream. Accuracy -30%, +5 HP/round.')
    }

    // Thread the venom flags onto the last enemy_attack step so the animation shows them in sync
    if (venomApplied || venomDotDamage > 0) {
      const lastStep = animSteps[animSteps.length - 1]
      if (lastStep && lastStep.kind === 'enemy_attack') {
        if (venomApplied) lastStep.venomApplied = true
        if (venomDotDamage > 0) lastStep.venomDotDamage = venomDotDamage
      }
    }
  }

  // ── Determine outcome ─────────────────────────────────────────────────────
  let phase = combat.phase
  let wonCaps = 0
  let updatedPlayer: PlayerState = { ...player, health, guards, paGuards, gun: gun ?? null, armor: armor ?? null, mount: mount ?? null }

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
      playerVenomed,
      activeBuffs: tickActiveBuffs(combat.activeBuffs),
      chemUsesThisRound: 0,
      replaySteps: [...combat.replaySteps, ...animSteps],
    },
    animSteps,
  }
}

export function resolveRun(
  player: PlayerState,
  combat: CombatState,
  modeConfig: GameModeConfig,
): { player: PlayerState; combat: CombatState; animSteps: AnimStep[] } {
  const runChance = runEscapeChance(player.guards.filter(g => !g.dead).length, player.paGuards.filter(g => !g.dead).length, player.brahmin)
  const success = rng() < runChance
  const log: string[] = []
  let updatedPlayer = player
  let { phase } = combat
  let damageTaken = 0
  const animSteps: AnimStep[] = []

  if (success) {
    if (player.brahmin > 0 && rng() < 0.30) {
      const { player: p, dropped } = loseBrahmin(player)
      updatedPlayer = p
      const droppedDesc = Object.entries(dropped).map(([id, q]) => `${q}× ${id}`).join(', ')
      log.push(droppedDesc
        ? `You escape! One of your brahmin bolted. Lost: ${droppedDesc} (pack over capacity).`
        : "You escape! But one of your brahmin couldn't keep up and bolted.")
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
    animSteps.push({
      kind: 'enemy_attack',
      enemyId: aliveEnemies[0]?.id ?? 'unknown',
      hit: true,
      damage: totalDamage,
      targetKind: 'player',
      targetId: 'player',
      targetHealthAfter: updatedPlayer.health,
      targetDied: updatedPlayer.health <= 0,
      armorAbsorbed: armorAbsorb,
      logLine: log[log.length - 1],
    })
  }

  return {
    player: updatedPlayer,
    combat: {
      ...combat,
      totalDamageTaken: combat.totalDamageTaken + damageTaken,
      phase,
      log: [...combat.log, ...log],
      activeBuffs: tickActiveBuffs(combat.activeBuffs),
      chemUsesThisRound: 0,
      replaySteps: [...combat.replaySteps, ...animSteps],
    },
    animSteps,
  }
}

// Count of alive enemies (convenience helper used in a few places)
export function aliveEnemyCount(combat: CombatState): number {
  return combat.enemies.filter(e => !e.dead).length
}
