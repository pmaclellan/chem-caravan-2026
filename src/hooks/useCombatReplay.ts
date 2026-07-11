import { useMemo } from 'react'
import type { AnimStep, CombatReplayRoster } from '../types/game'

export interface EnemyAnimEntry { key: number; type: 'hit' | 'miss' | 'attack' }

// Synchronous sibling of useCombatAnimation.ts's CombatAnimState — same field shape so
// EnemyUnitCard/GuardUnitCard/MountCaravanCard/PlayerCaravanCard can render either one, but
// computed as a fold over steps[0..stepIndex] instead of a setTimeout-scheduled sequence. Used
// by the run-history browser's arrow-key steppable combat replay viewer (no live timers there).
export interface CombatReplayFrame {
  displayEnemyHealth: Record<string, number>
  displayGuardHealth: Record<string, number>
  displayPAGuardHealth: Record<string, number>
  displayPAGuardArmor: Record<string, number>
  displayGuardCooldown: Record<string, number>
  displayMountHealth: number
  mountDied: boolean
  displayPlayerHealth: number
  displayPlayerAP: number
  displayAmmo: number
  displayGunCooldown: number
  enemyHitKeys: Record<string, number>     // 1 for units touched by the *current* step, else 0
  enemyAnimInfo: Record<string, EnemyAnimEntry>
  playerFireKey: number
  playerDamageKey: number
  playerDodgeKey: number
  guardFireKeys: Record<string, number>
  guardDamageKeys: Record<string, number>
  guardDodgeKeys: Record<string, number>
  mountFireKey: number
  mountDamageKey: number
  mountDodgeKey: number
  currentLogLines: string[]                // log line(s) produced by steps[stepIndex]
}

function emptyFrame(roster: CombatReplayRoster): CombatReplayFrame {
  return {
    displayEnemyHealth: Object.fromEntries(roster.enemies.map(e => [e.id, e.health])),
    displayGuardHealth: Object.fromEntries(roster.guards.map(g => [g.id, g.health])),
    displayPAGuardHealth: Object.fromEntries(roster.paGuards.map(g => [g.id, g.health])),
    displayPAGuardArmor: Object.fromEntries(roster.paGuards.map(g => [g.id, g.armorPoints])),
    displayGuardCooldown: Object.fromEntries(roster.guards.map(g => [g.id, g.cooldownRemaining ?? 0])),
    displayMountHealth: roster.mount?.health ?? 0,
    mountDied: false,
    displayPlayerHealth: roster.playerHealth,
    displayPlayerAP: roster.playerArmorPoints,
    displayAmmo: roster.startAmmo ?? 0,
    displayGunCooldown: 0,
    enemyHitKeys: {},
    enemyAnimInfo: {},
    playerFireKey: 0,
    playerDamageKey: 0,
    playerDodgeKey: 0,
    guardFireKeys: {},
    guardDamageKeys: {},
    guardDodgeKeys: {},
    mountFireKey: 0,
    mountDamageKey: 0,
    mountDodgeKey: 0,
    currentLogLines: [],
  }
}

// stepIndex: -1 = pre-combat (nothing resolved), 0..steps.length-1 = state immediately after
// that step resolved. Only the step at stepIndex gets non-zero flash keys / anim info — earlier
// steps are folded into the settled health/ammo/cooldown values with no visible animation.
export function foldCombatReplayFrame(
  steps: AnimStep[],
  roster: CombatReplayRoster,
  stepIndex: number,
): CombatReplayFrame {
  const frame = emptyFrame(roster)
  if (stepIndex < 0) return frame

  for (let i = 0; i <= stepIndex && i < steps.length; i++) {
    const step = steps[i]
    const isCurrent = i === stepIndex
    const lines: string[] = []

    if (step.kind === 'shot') {
      if (step.by === 'player') {
        frame.displayAmmo = Math.max(0, frame.displayAmmo - 1)
        if (step.shooterCooldownRemaining !== undefined) frame.displayGunCooldown = step.shooterCooldownRemaining
        if (isCurrent) frame.playerFireKey = 1
      } else if (step.shooterId) {
        if (step.shooterCooldownRemaining !== undefined) frame.displayGuardCooldown[step.shooterId] = step.shooterCooldownRemaining
        if (isCurrent) frame.guardFireKeys[step.shooterId] = 1
      }
      if (step.targetId) {
        if (step.hit) frame.displayEnemyHealth[step.targetId] = step.targetHealthAfter
        if (isCurrent) {
          if (step.hit) frame.enemyHitKeys[step.targetId] = 1
          frame.enemyAnimInfo[step.targetId] = { key: 1, type: step.hit ? 'hit' : 'miss' }
        }
      }
      lines.push(step.logLine)

    } else if (step.kind === 'mount_attack') {
      if (isCurrent) frame.mountFireKey = 1
      if (step.targetId) {
        if (step.hit) frame.displayEnemyHealth[step.targetId] = step.targetHealthAfter
        if (isCurrent) {
          if (step.hit) frame.enemyHitKeys[step.targetId] = 1
          frame.enemyAnimInfo[step.targetId] = { key: 1, type: step.hit ? 'hit' : 'miss' }
        }
      }
      lines.push(step.logLine)

    } else if (step.kind === 'enemy_attack') {
      if (isCurrent) frame.enemyAnimInfo[step.enemyId] = { key: 1, type: 'attack' }
      if (step.hit) {
        if (step.targetKind === 'player') {
          const apLoss = step.armorAbsorbed ?? 0
          frame.displayPlayerAP = Math.max(0, frame.displayPlayerAP - apLoss)
          frame.displayPlayerHealth = Math.max(0, frame.displayPlayerHealth - (step.damage - apLoss))
          if (step.venomDotDamage) frame.displayPlayerHealth = Math.max(0, frame.displayPlayerHealth - step.venomDotDamage)
          if (isCurrent) frame.playerDamageKey = 1
        } else if (step.targetKind === 'guard') {
          frame.displayGuardHealth[step.targetId] = step.targetHealthAfter
          if (isCurrent) frame.guardDamageKeys[step.targetId] = 1
        } else if (step.targetKind === 'pa_guard') {
          const apLoss = step.armorAbsorbed ?? 0
          frame.displayPAGuardArmor[step.targetId] = Math.max(0, (frame.displayPAGuardArmor[step.targetId] ?? 0) - apLoss)
          frame.displayPAGuardHealth[step.targetId] = step.targetHealthAfter
          if (isCurrent) frame.guardDamageKeys[step.targetId] = 1
        } else {
          frame.displayMountHealth = step.targetHealthAfter
          frame.mountDied = frame.mountDied || step.targetDied
          if (isCurrent) frame.mountDamageKey = 1
        }
      } else if (isCurrent) {
        if (step.targetKind === 'player') frame.playerDodgeKey = 1
        else if (step.targetKind === 'mount') frame.mountDodgeKey = 1
        else frame.guardDodgeKeys[step.targetId] = 1
      }
      lines.push(step.logLine)
      if (step.venomApplied) lines.push('Cazador venom enters your bloodstream. Accuracy -30%, +5 HP/round.')
      if (step.venomDotDamage) lines.push(`Venom burns through you. -${step.venomDotDamage} HP.`)

    } else if (step.kind === 'burst' || step.kind === 'pa_burst') {
      if (step.kind === 'burst') {
        frame.displayAmmo = Math.max(0, frame.displayAmmo - step.shots.length)
        if (step.shooterCooldownRemaining !== undefined) frame.displayGunCooldown = step.shooterCooldownRemaining
        if (isCurrent) frame.playerFireKey = 1
      } else {
        if (isCurrent) frame.guardFireKeys[step.shooterId] = 1
      }
      for (const shot of step.shots) {
        if (!shot.targetId) continue
        if (shot.hit) frame.displayEnemyHealth[shot.targetId] = shot.targetHealthAfter
        if (isCurrent) {
          if (shot.hit) frame.enemyHitKeys[shot.targetId] = 1
          frame.enemyAnimInfo[shot.targetId] = { key: 1, type: shot.hit ? 'hit' : 'miss' }
        }
        lines.push(shot.logLine)
      }

    } else if (step.kind === 'blast') {
      if (step.shooterId === null) {
        frame.displayAmmo = Math.max(0, frame.displayAmmo - 1)
        if (step.shooterCooldownRemaining !== undefined) frame.displayGunCooldown = step.shooterCooldownRemaining
        if (isCurrent) frame.playerFireKey = 1
      } else {
        if (step.shooterCooldownRemaining !== undefined) frame.displayGuardCooldown[step.shooterId] = step.shooterCooldownRemaining
        if (isCurrent) frame.guardFireKeys[step.shooterId] = 1
      }
      frame.displayEnemyHealth[step.primaryTargetId] = step.primaryHealthAfter
      if (isCurrent) {
        frame.enemyHitKeys[step.primaryTargetId] = 1
        frame.enemyAnimInfo[step.primaryTargetId] = { key: 1, type: 'hit' }
      }
      lines.push(step.logLine)
      for (const sh of step.splashHits) {
        frame.displayEnemyHealth[sh.targetId] = sh.healthAfter
        if (isCurrent) {
          frame.enemyHitKeys[sh.targetId] = 1
          frame.enemyAnimInfo[sh.targetId] = { key: 1, type: 'hit' }
        }
        lines.push(sh.logLine)
      }
    }

    if (isCurrent) frame.currentLogLines = lines
  }

  return frame
}

export function useCombatReplayFrame(
  steps: AnimStep[],
  roster: CombatReplayRoster,
  stepIndex: number,
): CombatReplayFrame {
  return useMemo(
    () => foldCombatReplayFrame(steps, roster, stepIndex),
    [steps, roster, stepIndex],
  )
}
