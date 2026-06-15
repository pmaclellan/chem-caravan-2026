import { useEffect, useRef, useState } from 'react'
import type { AnimStep, EnemyUnit } from '../types/game'

const INTER_SHOT_MS      = 620   // gap between each shot starting
const SHOOTER_FLASH_MS   = 280   // how long the shooter glows before the bullet lands
const TARGET_FLASH_DELAY = 220   // after shooter flash, when the enemy reacts (hit or dodge)
const RETALIATION_PAUSE  = 900   // extra pause before enemies strike back

export interface EnemyAnimEntry { key: number; type: 'hit' | 'miss' }

export interface CombatAnimState {
  isAnimating: boolean
  activeShooterIdx: number | null   // -1 = player, 0+ = guard index, null = nobody
  activeTargetId: string | null     // which enemy is being hit right now
  displayEnemyHealth: Record<string, number>
  displayGuards: number
  displayPAGuards: number
  playerFireKey: number                   // increments when player fires — drives PlayerGlow
  guardFireKeys: Record<number, number>   // increments when guard[idx] fires — used to trigger CSS anim
  enemyHitKeys: Record<string, number>   // increments on hits only — drives red FlashOverlay
  enemyAnimInfo: Record<string, EnemyAnimEntry>  // hit OR miss — drives stagger/dodge animation
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
    enemyAnimInfo: {},
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
    const workingHealth    = { ...initialHealth }
    const workingFireKeys: Record<number, number>                      = {}
    const workingHitKeys:  Record<string, number>                      = {}
    const workingAnimInfo: Record<string, EnemyAnimEntry>              = {}

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
      enemyAnimInfo: {},
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

        // Land the hit or trigger a dodge on the enemy
        if (targetId) {
          const t2 = offset + TARGET_FLASH_DELAY
          timersRef.current.push(setTimeout(() => {
            if (hit) {
              workingHealth[targetId]  = healthAfter
              workingHitKeys[targetId] = (workingHitKeys[targetId] ?? 0) + 1
            }
            workingAnimInfo[targetId] = {
              key: (workingAnimInfo[targetId]?.key ?? 0) + 1,
              type: hit ? 'hit' : 'miss',
            }
            setState(s => ({
              ...s,
              activeTargetId: hit ? targetId : null,
              displayEnemyHealth: hit ? { ...workingHealth } : s.displayEnemyHealth,
              enemyHitKeys: hit ? { ...workingHitKeys } : s.enemyHitKeys,
              enemyAnimInfo: { ...workingAnimInfo },
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
