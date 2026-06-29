import { useEffect, useRef, useState } from 'react'
import type { AnimStep, EnemyUnit } from '../types/game'

const INTER_SHOT_MS      = 620   // gap between each shot starting
const BURST_INTER_MS     = 130   // gap between shots within a burst (rapid fire)
const SHOOTER_FLASH_MS   = 280   // how long the shooter glows before the bullet lands
const TARGET_FLASH_DELAY = 220   // after shooter flash, when the enemy reacts (hit or dodge)
const RETALIATION_PAUSE  = 900   // extra pause before enemies strike back
const ATTACK_LAND_DELAY  = 360   // after enemy lunge, when damage registers on player

export interface EnemyAnimEntry { key: number; type: 'hit' | 'miss' | 'attack' }

export interface CombatAnimState {
  isAnimating: boolean
  activeShooterIdx: number | null
  activeTargetId: string | null
  displayEnemyHealth: Record<string, number>
  displayPlayerHealth: number
  displayPlayerAP: number
  displayAmmo: number
  displayGuards: number      // alive count during animation; use to determine which cards are greyed
  displayPAGuards: number
  initialGuards: number      // pre-fight count; use as total cards to render (including grey dead)
  initialPAGuards: number
  displayMountHealth: number
  initialMountHealth: number
  mountFireKey: number
  mountDied: boolean
  playerFireKey: number
  playerDamageKey: number
  guardFireKeys: Record<number, number>
  enemyHitKeys: Record<string, number>
  enemyAnimInfo: Record<string, EnemyAnimEntry>
}

export function useCombatAnimation(
  animSteps: AnimStep[] | null,
  enemies: EnemyUnit[],
  initialGuards: number,
  initialPAGuards: number,
  initialPlayerHealth: number,
  initialPlayerAP: number,
  initialMountHealth: number,
  initialAmmo: number,
  onComplete: () => void,
  onLogLine?: (line: string) => void,
): CombatAnimState {
  const [state, setState] = useState<CombatAnimState>({
    isAnimating: false,
    activeShooterIdx: null,
    activeTargetId: null,
    displayEnemyHealth: {},
    displayPlayerHealth: initialPlayerHealth,
    displayPlayerAP: initialPlayerAP,
    displayAmmo: initialAmmo,
    displayGuards: initialGuards,
    displayPAGuards: initialPAGuards,
    initialGuards,
    initialPAGuards,
    displayMountHealth: initialMountHealth,
    initialMountHealth,
    mountFireKey: 0,
    mountDied: false,
    playerFireKey: 0,
    playerDamageKey: 0,
    guardFireKeys: {},
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
    const workingFireKeys: Record<number, number>         = {}
    const workingHitKeys:  Record<string, number>         = {}
    const workingAnimInfo: Record<string, EnemyAnimEntry> = {}

    setState(s => ({
      ...s,
      isAnimating: true,
      activeShooterIdx: null,
      activeTargetId: null,
      displayEnemyHealth: initialHealth,
      displayPlayerHealth: initialPlayerHealth,
      displayPlayerAP: initialPlayerAP,
      displayAmmo: initialAmmo,
      displayGuards: initialGuards,
      displayPAGuards: initialPAGuards,
      initialGuards,
      initialPAGuards,
      displayMountHealth: initialMountHealth,
      initialMountHealth,
      mountFireKey: 0,
      mountDied: false,
      playerFireKey: 0,
      playerDamageKey: 0,
      guardFireKeys: {},
      enemyHitKeys: {},
      enemyAnimInfo: {},
    }))

    let offset = 80
    let workingAmmo = initialAmmo

    for (const step of animSteps) {
      if (step.kind === 'shot') {
        const shooterIdx  = step.by === 'player' ? -1 : step.guardIdx
        const targetId    = step.targetId
        const healthAfter = step.targetHealthAfter
        const hit         = step.hit

        // Shooter glows + ammo ticks down
        const t1 = offset
        workingAmmo = Math.max(0, workingAmmo - 1)
        const ammoAtShot = workingAmmo
        timersRef.current.push(setTimeout(() => {
          if (shooterIdx === -1) {
            setState(s => ({ ...s, activeShooterIdx: shooterIdx, activeTargetId: null, playerFireKey: s.playerFireKey + 1, displayAmmo: ammoAtShot }))
          } else {
            workingFireKeys[shooterIdx] = (workingFireKeys[shooterIdx] ?? 0) + 1
            setState(s => ({ ...s, activeShooterIdx: shooterIdx, activeTargetId: null, guardFireKeys: { ...workingFireKeys }, displayAmmo: ammoAtShot }))
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
        // ── Mount attack — same timing pattern as a shot ────────────────────
        const targetId    = step.targetId
        const healthAfter = step.targetHealthAfter
        const hit         = step.hit

        // Mount card glows
        timersRef.current.push(setTimeout(() => {
          setState(s => ({ ...s, activeShooterIdx: null, activeTargetId: null, mountFireKey: s.mountFireKey + 1 }))
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

      } else if (step.kind === 'burst') {
        // ── Rapid-fire burst — shots staggered by BURST_INTER_MS, all close together ──
        // Player fires once (ammo already deducted as a block)
        workingAmmo = Math.max(0, workingAmmo - step.shots.length)
        const ammoAtBurst = workingAmmo
        timersRef.current.push(setTimeout(() => {
          setState(s => ({ ...s, activeShooterIdx: -1, activeTargetId: null, playerFireKey: s.playerFireKey + 1, displayAmmo: ammoAtBurst }))
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

      } else if (step.kind === 'blast') {
        // ── Blast (e.g. missile launcher) — primary + splash land simultaneously ──
        workingAmmo = Math.max(0, workingAmmo - 1)
        const ammoAtShot = workingAmmo

        // Player fires
        timersRef.current.push(setTimeout(() => {
          setState(s => ({ ...s, activeShooterIdx: -1, activeTargetId: null, playerFireKey: s.playerFireKey + 1, displayAmmo: ammoAtShot }))
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

      } else {
        // ── Enemy retaliation — two sub-phases ──────────────────────────────
        offset += RETALIATION_PAUSE

        const guardsLost        = step.guardsLost
        const paGuardsLost      = step.paGuardsLost
        const hpDamage          = step.hpDamage
        const armorAbsorb       = step.armorAbsorb
        const mountDamageTaken  = step.mountDamageTaken
        const mountDied         = step.mountDied

        // Phase 1: alive enemies lunge (attack animation)
        const attackAt = offset
        timersRef.current.push(setTimeout(() => {
          for (const e of enemies) {
            if ((workingHealth[e.id] ?? e.health) > 0) {
              workingAnimInfo[e.id] = {
                key:  (workingAnimInfo[e.id]?.key ?? 0) + 1,
                type: 'attack',
              }
            }
          }
          setState(s => ({
            ...s,
            activeShooterIdx: null,
            activeTargetId:   null,
            enemyAnimInfo:    { ...workingAnimInfo },
          }))
        }, attackAt))

        // Phase 2: damage lands on player — HP/AP bars animate, guards/mount update
        timersRef.current.push(setTimeout(() => {
          setState(s => ({
            ...s,
            displayGuards:       Math.max(0, s.displayGuards   - guardsLost),
            displayPAGuards:     Math.max(0, s.displayPAGuards - paGuardsLost),
            displayPlayerHealth: Math.max(0, initialPlayerHealth - hpDamage),
            displayPlayerAP:     Math.max(0, initialPlayerAP   - armorAbsorb),
            displayMountHealth:  Math.max(0, s.displayMountHealth - mountDamageTaken),
            mountDied:           mountDied || s.mountDied,
            playerDamageKey:     (hpDamage > 0 || armorAbsorb > 0) ? s.playerDamageKey + 1 : s.playerDamageKey,
          }))
          for (const line of step.logLines) onLogLineRef.current?.(line)
        }, attackAt + ATTACK_LAND_DELAY))

        offset += ATTACK_LAND_DELAY + INTER_SHOT_MS
      }
    }

    // Clear active indicators
    timersRef.current.push(setTimeout(() => {
      setState(s => ({ ...s, activeShooterIdx: null, activeTargetId: null }))
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
