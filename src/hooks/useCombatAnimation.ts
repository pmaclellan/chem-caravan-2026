import { useEffect, useRef, useState } from 'react'
import type { AnimStep, EnemyUnit } from '../types/game'

const INTER_SHOT_MS      = 420   // gap between each shot starting
const SHOOTER_FLASH_MS   = 220   // how long the shooter glows before the bullet lands
const TARGET_FLASH_DELAY = 160   // after shooter flash, when the enemy gets hit
const RETALIATION_PAUSE  = 650   // extra pause before enemies strike back

export interface CombatAnimState {
  isAnimating: boolean
  activeShooterIdx: number | null   // -1 = player, 0+ = guard index, null = nobody
  activeTargetId: string | null     // which enemy is being hit right now
  displayEnemyHealth: Record<string, number>
  displayGuards: number
  displayPAGuards: number
  playerFireKey: number                   // increments when player fires — drives PlayerGlow
  guardFireKeys: Record<number, number>   // increments when guard[idx] fires — used to trigger CSS anim
  enemyHitKeys: Record<string, number>   // increments when enemy is hit — drives FlashOverlay
}

export function useCombatAnimation(
  animSteps: AnimStep[] | null,
  enemies: EnemyUnit[],
  initialGuards: number,
  initialPAGuards: number,
  onComplete: () => void,
): CombatAnimState {
  const [state, setState] = useState<CombatAnimState>({
    isAnimating: false,
    activeShooterIdx: null,
    activeTargetId: null,
    displayEnemyHealth: {},
    displayGuards: initialGuards,
    displayPAGuards: initialPAGuards,
    playerFireKey: 0,
    guardFireKeys: {},
    enemyHitKeys: {},
  })

  const timersRef    = useRef<ReturnType<typeof setTimeout>[]>([])
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  useEffect(() => () => { timersRef.current.forEach(clearTimeout) }, [])

  useEffect(() => {
    if (!animSteps || animSteps.length === 0) return

    timersRef.current.forEach(clearTimeout)
    timersRef.current = []

    const initialHealth = Object.fromEntries(enemies.map(e => [e.id, e.health]))
    const workingHealth  = { ...initialHealth }
    const workingFireKeys: Record<number, number> = {}
    const workingHitKeys: Record<string, number>  = {}

    setState(s => ({
      ...s,
      isAnimating: true,
      activeShooterIdx: null,
      activeTargetId: null,
      displayEnemyHealth: initialHealth,
      displayGuards: initialGuards,
      displayPAGuards: initialPAGuards,
      playerFireKey: 0,
      guardFireKeys: {},
      enemyHitKeys: {},
    }))

    let offset = 80

    for (const step of animSteps) {
      if (step.kind === 'shot') {
        const shooterIdx = step.by === 'player' ? -1 : step.guardIdx
        const targetId   = step.targetId
        const healthAfter = step.targetHealthAfter
        const hit        = step.hit

        // Activate shooter glow
        const t1 = offset
        timersRef.current.push(setTimeout(() => {
          if (shooterIdx === -1) {
            setState(s => ({
              ...s,
              activeShooterIdx: shooterIdx,
              activeTargetId: null,
              playerFireKey: s.playerFireKey + 1,
            }))
          } else {
            workingFireKeys[shooterIdx] = (workingFireKeys[shooterIdx] ?? 0) + 1
            setState(s => ({
              ...s,
              activeShooterIdx: shooterIdx,
              activeTargetId: null,
              guardFireKeys: { ...workingFireKeys },
            }))
          }
        }, t1))

        // Land the hit on the enemy
        if (hit && targetId) {
          const t2 = offset + TARGET_FLASH_DELAY
          timersRef.current.push(setTimeout(() => {
            workingHealth[targetId]  = healthAfter
            workingHitKeys[targetId] = (workingHitKeys[targetId] ?? 0) + 1
            setState(s => ({
              ...s,
              activeTargetId: targetId,
              displayEnemyHealth: { ...workingHealth },
              enemyHitKeys: { ...workingHitKeys },
            }))
          }, t2))
        }

        offset += INTER_SHOT_MS

      } else {
        // Enemy retaliation — longer pause, then guards/health update together
        offset += RETALIATION_PAUSE
        const guardsLost   = step.guardsLost
        const paGuardsLost = step.paGuardsLost

        timersRef.current.push(setTimeout(() => {
          setState(s => ({
            ...s,
            activeShooterIdx: null,
            activeTargetId: null,
            displayGuards:   Math.max(0, s.displayGuards   - guardsLost),
            displayPAGuards: Math.max(0, s.displayPAGuards - paGuardsLost),
          }))
        }, offset))

        offset += INTER_SHOT_MS
      }
    }

    // Clear active indicators
    timersRef.current.push(setTimeout(() => {
      setState(s => ({ ...s, activeShooterIdx: null, activeTargetId: null }))
    }, offset))

    // Signal completion
    timersRef.current.push(setTimeout(() => {
      setState(s => ({ ...s, isAnimating: false }))
      onCompleteRef.current()
    }, offset + SHOOTER_FLASH_MS))

  }, [animSteps]) // eslint-disable-line react-hooks/exhaustive-deps

  return state
}
