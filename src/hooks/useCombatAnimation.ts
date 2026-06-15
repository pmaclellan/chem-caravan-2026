import { useEffect, useRef, useState } from 'react'
import type { AnimStep, EnemyUnit } from '../types/game'

const INTER_SHOT_MS      = 620   // gap between each shot starting
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
  displayGuards: number      // alive count during animation; use to determine which cards are greyed
  displayPAGuards: number
  initialGuards: number      // pre-fight count; use as total cards to render (including grey dead)
  initialPAGuards: number
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
  onComplete: () => void,
): CombatAnimState {
  const [state, setState] = useState<CombatAnimState>({
    isAnimating: false,
    activeShooterIdx: null,
    activeTargetId: null,
    displayEnemyHealth: {},
    displayPlayerHealth: initialPlayerHealth,
    displayPlayerAP: initialPlayerAP,
    displayGuards: initialGuards,
    displayPAGuards: initialPAGuards,
    initialGuards,
    initialPAGuards,
    playerFireKey: 0,
    playerDamageKey: 0,
    guardFireKeys: {},
    enemyHitKeys: {},
    enemyAnimInfo: {},
  })

  const timersRef     = useRef<ReturnType<typeof setTimeout>[]>([])
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

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
      displayGuards: initialGuards,
      displayPAGuards: initialPAGuards,
      initialGuards,
      initialPAGuards,
      playerFireKey: 0,
      playerDamageKey: 0,
      guardFireKeys: {},
      enemyHitKeys: {},
      enemyAnimInfo: {},
    }))

    let offset = 80

    for (const step of animSteps) {
      if (step.kind === 'shot') {
        const shooterIdx  = step.by === 'player' ? -1 : step.guardIdx
        const targetId    = step.targetId
        const healthAfter = step.targetHealthAfter
        const hit         = step.hit

        // Shooter glows
        const t1 = offset
        timersRef.current.push(setTimeout(() => {
          if (shooterIdx === -1) {
            setState(s => ({ ...s, activeShooterIdx: shooterIdx, activeTargetId: null, playerFireKey: s.playerFireKey + 1 }))
          } else {
            workingFireKeys[shooterIdx] = (workingFireKeys[shooterIdx] ?? 0) + 1
            setState(s => ({ ...s, activeShooterIdx: shooterIdx, activeTargetId: null, guardFireKeys: { ...workingFireKeys } }))
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
          }, t2))
        }

        offset += INTER_SHOT_MS

      } else {
        // ── Enemy retaliation — two sub-phases ──────────────────────────────
        offset += RETALIATION_PAUSE

        const guardsLost   = step.guardsLost
        const paGuardsLost = step.paGuardsLost
        const hpDamage     = step.hpDamage
        const armorAbsorb  = step.armorAbsorb

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

        // Phase 2: damage lands on player — HP/AP bars animate, guards disappear
        timersRef.current.push(setTimeout(() => {
          setState(s => ({
            ...s,
            displayGuards:       Math.max(0, s.displayGuards   - guardsLost),
            displayPAGuards:     Math.max(0, s.displayPAGuards - paGuardsLost),
            displayPlayerHealth: Math.max(0, initialPlayerHealth - hpDamage),
            displayPlayerAP:     Math.max(0, initialPlayerAP   - armorAbsorb),
            playerDamageKey:     (hpDamage > 0 || armorAbsorb > 0) ? s.playerDamageKey + 1 : s.playerDamageKey,
          }))
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
