import { useEffect, useRef, useState } from 'react'
import type { AnimStep, EnemyUnit, GuardUnit, PAGuardUnit } from '../types/game'

const INTER_SHOT_MS         = 620   // gap between each player/guard shot starting
const BURST_INTER_MS        = 130   // gap between shots within a burst (rapid fire)
const SHOOTER_FLASH_MS      = 280   // how long the shooter glows before the bullet lands
const TARGET_FLASH_DELAY    = 220   // after shooter flash, when the enemy reacts (hit or dodge)
const RETALIATION_PAUSE     = 900   // extra pause before enemies strike back
const ATTACK_LAND_DELAY     = 360   // after enemy lunge, when damage/dodge registers on its target
const INTER_ENEMY_ATTACK_MS = 480   // gap between individual enemy attacks — quicker than player/guard shots

export interface EnemyAnimEntry { key: number; type: 'hit' | 'miss' | 'attack' }

export interface CombatAnimState {
  isAnimating: boolean
  activeShooterId: string | null
  activeTargetId: string | null
  displayEnemyHealth: Record<string, number>
  displayPlayerHealth: number
  displayPlayerAP: number
  displayAmmo: number
  displayGuardHealth: Record<string, number>     // keyed by GuardUnit.id
  displayPAGuardHealth: Record<string, number>   // keyed by PAGuardUnit.id
  displayGunCooldown: number
  displayGuardCooldown: Record<string, number>   // keyed by GuardUnit.id
  displayMountHealth: number
  initialMountHealth: number
  mountFireKey: number
  mountDamageKey: number
  mountDodgeKey: number
  mountDied: boolean
  playerFireKey: number
  playerDamageKey: number
  playerDodgeKey: number
  guardFireKeys: Record<string, number>
  guardDamageKeys: Record<string, number>
  guardDodgeKeys: Record<string, number>
  enemyHitKeys: Record<string, number>
  enemyAnimInfo: Record<string, EnemyAnimEntry>
}

function initialGuardHealthMap(guards: GuardUnit[] | PAGuardUnit[]): Record<string, number> {
  return Object.fromEntries(guards.map(g => [g.id, g.health]))
}

function initialGuardCooldownMap(guards: GuardUnit[]): Record<string, number> {
  return Object.fromEntries(guards.map(g => [g.id, g.cooldownRemaining ?? 0]))
}

export function useCombatAnimation(
  animSteps: AnimStep[] | null,
  enemies: EnemyUnit[],
  guards: GuardUnit[],
  paGuards: PAGuardUnit[],
  initialPlayerHealth: number,
  initialPlayerAP: number,
  initialMountHealth: number,
  initialAmmo: number,
  initialGunCooldown: number,
  onComplete: () => void,
  onLogLine?: (line: string) => void,
): CombatAnimState {
  const [state, setState] = useState<CombatAnimState>({
    isAnimating: false,
    activeShooterId: null,
    activeTargetId: null,
    displayEnemyHealth: {},
    displayPlayerHealth: initialPlayerHealth,
    displayPlayerAP: initialPlayerAP,
    displayAmmo: initialAmmo,
    displayGuardHealth: initialGuardHealthMap(guards),
    displayPAGuardHealth: initialGuardHealthMap(paGuards),
    displayGunCooldown: initialGunCooldown,
    displayGuardCooldown: initialGuardCooldownMap(guards),
    displayMountHealth: initialMountHealth,
    initialMountHealth,
    mountFireKey: 0,
    mountDamageKey: 0,
    mountDodgeKey: 0,
    mountDied: false,
    playerFireKey: 0,
    playerDamageKey: 0,
    playerDodgeKey: 0,
    guardFireKeys: {},
    guardDamageKeys: {},
    guardDodgeKeys: {},
    enemyHitKeys: {},
    enemyAnimInfo: {},
  })

  const timersRef     = useRef<ReturnType<typeof setTimeout>[]>([])
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete
  const onLogLineRef  = useRef(onLogLine)
  onLogLineRef.current = onLogLine

  useEffect(() => () => { timersRef.current.forEach(clearTimeout) }, [])

  useEffect(() => {
    if (!animSteps || animSteps.length === 0) return

    timersRef.current.forEach(clearTimeout)
    timersRef.current = []

    const initialHealth  = Object.fromEntries(enemies.map(e => [e.id, e.health]))
    const workingHealth  = { ...initialHealth }
    const workingFireKeys: Record<string, number>          = {}
    const workingHitKeys:  Record<string, number>          = {}
    const workingAnimInfo: Record<string, EnemyAnimEntry>  = {}
    const workingGuardHealth   = initialGuardHealthMap(guards)
    const workingPAGuardHealth = initialGuardHealthMap(paGuards)
    const workingGuardDamageKeys: Record<string, number> = {}
    const workingGuardDodgeKeys:  Record<string, number> = {}
    const workingGuardCooldown = initialGuardCooldownMap(guards)
    let workingGunCooldown = initialGunCooldown

    setState(s => ({
      ...s,
      isAnimating: true,
      activeShooterId: null,
      activeTargetId: null,
      displayEnemyHealth: initialHealth,
      displayPlayerHealth: initialPlayerHealth,
      displayPlayerAP: initialPlayerAP,
      displayAmmo: initialAmmo,
      displayGuardHealth: { ...workingGuardHealth },
      displayPAGuardHealth: { ...workingPAGuardHealth },
      displayGunCooldown: workingGunCooldown,
      displayGuardCooldown: { ...workingGuardCooldown },
      displayMountHealth: initialMountHealth,
      initialMountHealth,
      mountFireKey: 0,
      mountDamageKey: 0,
      mountDodgeKey: 0,
      mountDied: false,
      playerFireKey: 0,
      playerDamageKey: 0,
      playerDodgeKey: 0,
      guardFireKeys: {},
      guardDamageKeys: {},
      guardDodgeKeys: {},
      enemyHitKeys: {},
      enemyAnimInfo: {},
    }))

    let offset = 80
    let workingAmmo = initialAmmo
    let workingPlayerHealth = initialPlayerHealth
    let workingPlayerAP = initialPlayerAP
    let workingMountHealth = initialMountHealth
    let retaliationStarted = false

    for (const step of animSteps) {
      if (step.kind === 'shot') {
        const shooterId    = step.by === 'player' ? null : step.shooterId
        const targetId    = step.targetId
        const healthAfter = step.targetHealthAfter
        const hit         = step.hit

        // Shooter glows — only player shots decrement the ammo display
        const t1 = offset
        if (step.by === 'player') workingAmmo = Math.max(0, workingAmmo - 1)
        const ammoAtShot = workingAmmo
        const shotCooldown = step.shooterCooldownRemaining
        timersRef.current.push(setTimeout(() => {
          if (shooterId === null) {
            if (shotCooldown !== undefined) workingGunCooldown = shotCooldown
            setState(s => ({ ...s, activeShooterId: null, activeTargetId: null, playerFireKey: s.playerFireKey + 1, displayAmmo: ammoAtShot, displayGunCooldown: workingGunCooldown }))
          } else {
            workingFireKeys[shooterId] = (workingFireKeys[shooterId] ?? 0) + 1
            if (shotCooldown !== undefined) workingGuardCooldown[shooterId] = shotCooldown
            setState(s => ({ ...s, activeShooterId: shooterId, activeTargetId: null, guardFireKeys: { ...workingFireKeys }, displayGuardCooldown: { ...workingGuardCooldown } }))
          }
        }, t1))

        // Enemy hit staggers or dodges
        if (targetId) {
          const t2 = offset + TARGET_FLASH_DELAY
          timersRef.current.push(setTimeout(() => {
            if (hit) {
              workingHealth[targetId]  = healthAfter
              workingHitKeys[targetId] = (workingHitKeys[targetId] ?? 0) + 1
            }
            workingAnimInfo[targetId] = {
              key:  (workingAnimInfo[targetId]?.key ?? 0) + 1,
              type: hit ? 'hit' : 'miss',
            }
            setState(s => ({
              ...s,
              activeTargetId:     hit ? targetId : null,
              displayEnemyHealth: hit ? { ...workingHealth } : s.displayEnemyHealth,
              enemyHitKeys:       hit ? { ...workingHitKeys } : s.enemyHitKeys,
              enemyAnimInfo:      { ...workingAnimInfo },
            }))
            onLogLineRef.current?.(step.logLine)
          }, t2))
        }

        offset += INTER_SHOT_MS

      } else if (step.kind === 'mount_attack') {
        // ── Mount attack (targeting an enemy) — same timing pattern as a shot ──
        const targetId    = step.targetId
        const healthAfter = step.targetHealthAfter
        const hit         = step.hit

        // Mount card glows
        timersRef.current.push(setTimeout(() => {
          setState(s => ({ ...s, activeShooterId: null, activeTargetId: null, mountFireKey: s.mountFireKey + 1 }))
        }, offset))

        // Enemy reacts
        if (targetId) {
          const t2 = offset + TARGET_FLASH_DELAY
          timersRef.current.push(setTimeout(() => {
            if (hit) {
              workingHealth[targetId]  = healthAfter
              workingHitKeys[targetId] = (workingHitKeys[targetId] ?? 0) + 1
            }
            workingAnimInfo[targetId] = {
              key:  (workingAnimInfo[targetId]?.key ?? 0) + 1,
              type: hit ? 'hit' : 'miss',
            }
            setState(s => ({
              ...s,
              activeTargetId:     hit ? targetId : null,
              displayEnemyHealth: hit ? { ...workingHealth } : s.displayEnemyHealth,
              enemyHitKeys:       hit ? { ...workingHitKeys } : s.enemyHitKeys,
              enemyAnimInfo:      { ...workingAnimInfo },
            }))
            onLogLineRef.current?.(step.logLine)
          }, t2))
        }

        offset += INTER_SHOT_MS

      } else if (step.kind === 'enemy_attack') {
        // ── Individual enemy attack — lunge on the attacker, then damage/dodge lands on its target ──
        if (!retaliationStarted) {
          offset += RETALIATION_PAUSE
          retaliationStarted = true
        }

        const attackAt = offset
        const enemyId  = step.enemyId
        timersRef.current.push(setTimeout(() => {
          if ((workingHealth[enemyId] ?? 0) > 0) {
            workingAnimInfo[enemyId] = { key: (workingAnimInfo[enemyId]?.key ?? 0) + 1, type: 'attack' }
            setState(s => ({ ...s, activeShooterId: null, activeTargetId: null, enemyAnimInfo: { ...workingAnimInfo } }))
          }
        }, attackAt))

        const landAt = attackAt + ATTACK_LAND_DELAY
        timersRef.current.push(setTimeout(() => {
          if (step.hit) {
            if (step.targetKind === 'player') {
              const apLoss = step.armorAbsorbed ?? 0
              const hpLoss = step.damage - apLoss
              workingPlayerAP     = Math.max(0, workingPlayerAP - apLoss)
              workingPlayerHealth = Math.max(0, workingPlayerHealth - hpLoss)
              if (step.venomDotDamage) workingPlayerHealth = Math.max(0, workingPlayerHealth - step.venomDotDamage)
              setState(s => ({
                ...s,
                displayPlayerHealth: workingPlayerHealth,
                displayPlayerAP:     workingPlayerAP,
                playerDamageKey:     s.playerDamageKey + 1,
              }))
            } else if (step.targetKind === 'guard') {
              workingGuardHealth[step.targetId] = step.targetHealthAfter
              workingGuardDamageKeys[step.targetId] = (workingGuardDamageKeys[step.targetId] ?? 0) + 1
              setState(s => ({ ...s, displayGuardHealth: { ...workingGuardHealth }, guardDamageKeys: { ...workingGuardDamageKeys } }))
            } else if (step.targetKind === 'pa_guard') {
              workingPAGuardHealth[step.targetId] = step.targetHealthAfter
              workingGuardDamageKeys[step.targetId] = (workingGuardDamageKeys[step.targetId] ?? 0) + 1
              setState(s => ({ ...s, displayPAGuardHealth: { ...workingPAGuardHealth }, guardDamageKeys: { ...workingGuardDamageKeys } }))
            } else {
              workingMountHealth = step.targetHealthAfter
              setState(s => ({ ...s, displayMountHealth: workingMountHealth, mountDamageKey: s.mountDamageKey + 1, mountDied: step.targetDied || s.mountDied }))
            }
          } else {
            if (step.targetKind === 'player') {
              setState(s => ({ ...s, playerDodgeKey: s.playerDodgeKey + 1 }))
            } else if (step.targetKind === 'guard') {
              workingGuardDodgeKeys[step.targetId] = (workingGuardDodgeKeys[step.targetId] ?? 0) + 1
              setState(s => ({ ...s, guardDodgeKeys: { ...workingGuardDodgeKeys } }))
            } else if (step.targetKind === 'pa_guard') {
              workingGuardDodgeKeys[step.targetId] = (workingGuardDodgeKeys[step.targetId] ?? 0) + 1
              setState(s => ({ ...s, guardDodgeKeys: { ...workingGuardDodgeKeys } }))
            } else {
              setState(s => ({ ...s, mountDodgeKey: s.mountDodgeKey + 1 }))
            }
          }
          onLogLineRef.current?.(step.logLine)
          if (step.venomApplied) onLogLineRef.current?.('Cazador venom enters your bloodstream. Accuracy -30%, +5 HP/round.')
          if (step.venomDotDamage) onLogLineRef.current?.(`Venom burns through you. -${step.venomDotDamage} HP.`)
        }, landAt))

        offset += ATTACK_LAND_DELAY + INTER_ENEMY_ATTACK_MS

      } else if (step.kind === 'burst') {
        // ── Rapid-fire burst — shots staggered by BURST_INTER_MS, all close together ──
        // Player fires once (ammo already deducted as a block)
        workingAmmo = Math.max(0, workingAmmo - step.shots.length)
        const ammoAtBurst = workingAmmo
        timersRef.current.push(setTimeout(() => {
          setState(s => ({ ...s, activeShooterId: null, activeTargetId: null, playerFireKey: s.playerFireKey + 1, displayAmmo: ammoAtBurst }))
        }, offset))

        // Each shot in the burst lands BURST_INTER_MS apart
        step.shots.forEach((shot, si) => {
          const tHit = offset + TARGET_FLASH_DELAY + si * BURST_INTER_MS
          timersRef.current.push(setTimeout(() => {
            if (shot.hit && shot.targetId) {
              workingHealth[shot.targetId]  = shot.targetHealthAfter
              workingHitKeys[shot.targetId] = (workingHitKeys[shot.targetId] ?? 0) + 1
              workingAnimInfo[shot.targetId] = { key: (workingAnimInfo[shot.targetId]?.key ?? 0) + 1, type: 'hit' }
            } else if (!shot.hit && shot.targetId) {
              workingAnimInfo[shot.targetId] = { key: (workingAnimInfo[shot.targetId]?.key ?? 0) + 1, type: 'miss' }
            }
            setState(s => ({
              ...s,
              activeTargetId:     shot.hit && shot.targetId ? shot.targetId : null,
              displayEnemyHealth: shot.hit ? { ...workingHealth } : s.displayEnemyHealth,
              enemyHitKeys:       shot.hit ? { ...workingHitKeys } : s.enemyHitKeys,
              enemyAnimInfo:      { ...workingAnimInfo },
            }))
            onLogLineRef.current?.(shot.logLine)
          }, tHit))
        })

        // Advance offset past the entire burst duration
        offset += TARGET_FLASH_DELAY + step.shots.length * BURST_INTER_MS + INTER_SHOT_MS

      } else if (step.kind === 'pa_burst') {
        // ── PA guard minigun burst — guard card glows, then shots land in rapid succession ──
        const shooterId = step.shooterId
        timersRef.current.push(setTimeout(() => {
          workingFireKeys[shooterId] = (workingFireKeys[shooterId] ?? 0) + 1
          setState(s => ({ ...s, activeShooterId: shooterId, activeTargetId: null, guardFireKeys: { ...workingFireKeys } }))
        }, offset))

        step.shots.forEach((shot, si) => {
          const tHit = offset + TARGET_FLASH_DELAY + si * BURST_INTER_MS
          timersRef.current.push(setTimeout(() => {
            if (shot.hit && shot.targetId) {
              workingHealth[shot.targetId]  = shot.targetHealthAfter
              workingHitKeys[shot.targetId] = (workingHitKeys[shot.targetId] ?? 0) + 1
              workingAnimInfo[shot.targetId] = { key: (workingAnimInfo[shot.targetId]?.key ?? 0) + 1, type: 'hit' }
            } else if (!shot.hit && shot.targetId) {
              workingAnimInfo[shot.targetId] = { key: (workingAnimInfo[shot.targetId]?.key ?? 0) + 1, type: 'miss' }
            }
            setState(s => ({
              ...s,
              activeTargetId:     shot.hit && shot.targetId ? shot.targetId : null,
              displayEnemyHealth: shot.hit ? { ...workingHealth } : s.displayEnemyHealth,
              enemyHitKeys:       shot.hit ? { ...workingHitKeys } : s.enemyHitKeys,
              enemyAnimInfo:      { ...workingAnimInfo },
            }))
            onLogLineRef.current?.(shot.logLine)
          }, tHit))
        })

        offset += TARGET_FLASH_DELAY + step.shots.length * BURST_INTER_MS + INTER_SHOT_MS

      } else if (step.kind === 'blast') {
        // ── Blast (missile launcher, shotgunner spray) — primary + splash land simultaneously ──
        const shooterId = step.shooterId
        if (shooterId === null) {
          workingAmmo = Math.max(0, workingAmmo - 1)
        }
        const ammoAtShot = workingAmmo
        const shotCooldown = step.shooterCooldownRemaining

        // Shooter fires — player (ammo + player glow) or a guard (fire-glow, no ammo)
        timersRef.current.push(setTimeout(() => {
          if (shooterId === null) {
            if (shotCooldown !== undefined) workingGunCooldown = shotCooldown
            setState(s => ({ ...s, activeShooterId: null, activeTargetId: null, playerFireKey: s.playerFireKey + 1, displayAmmo: ammoAtShot, displayGunCooldown: workingGunCooldown }))
          } else {
            workingFireKeys[shooterId] = (workingFireKeys[shooterId] ?? 0) + 1
            if (shotCooldown !== undefined) workingGuardCooldown[shooterId] = shotCooldown
            setState(s => ({ ...s, activeShooterId: shooterId, activeTargetId: null, guardFireKeys: { ...workingFireKeys }, displayGuardCooldown: { ...workingGuardCooldown } }))
          }
        }, offset))

        // All targets react at the same moment
        timersRef.current.push(setTimeout(() => {
          workingHealth[step.primaryTargetId] = step.primaryHealthAfter
          workingHitKeys[step.primaryTargetId] = (workingHitKeys[step.primaryTargetId] ?? 0) + 1
          workingAnimInfo[step.primaryTargetId] = { key: (workingAnimInfo[step.primaryTargetId]?.key ?? 0) + 1, type: 'hit' }
          for (const sh of step.splashHits) {
            workingHealth[sh.targetId] = sh.healthAfter
            workingHitKeys[sh.targetId] = (workingHitKeys[sh.targetId] ?? 0) + 1
            workingAnimInfo[sh.targetId] = { key: (workingAnimInfo[sh.targetId]?.key ?? 0) + 1, type: 'hit' }
          }
          setState(s => ({
            ...s,
            activeTargetId:     step.primaryTargetId,
            displayEnemyHealth: { ...workingHealth },
            enemyHitKeys:       { ...workingHitKeys },
            enemyAnimInfo:      { ...workingAnimInfo },
          }))
          onLogLineRef.current?.(step.logLine)
          for (const sh of step.splashHits) onLogLineRef.current?.(sh.logLine)
        }, offset + TARGET_FLASH_DELAY))

        offset += INTER_SHOT_MS
      }
    }

    // Clear active indicators
    timersRef.current.push(setTimeout(() => {
      setState(s => ({ ...s, activeShooterId: null, activeTargetId: null }))
    }, offset))

    // Signal completion — reset hit keys to 0 so FlashOverlay is null when
    // EnemyUnitCard remounts on the key change from animated-key → unit.id
    timersRef.current.push(setTimeout(() => {
      setState(s => ({ ...s, isAnimating: false, enemyHitKeys: {} }))
      onCompleteRef.current()
    }, offset + SHOOTER_FLASH_MS))

  }, [animSteps]) // eslint-disable-line react-hooks/exhaustive-deps

  return state
}
