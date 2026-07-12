import { useEffect, useRef, useState } from 'react'
import type { AnimStep, EnemyUnit, GuardUnit, PAGuardUnit } from '../types/game'
import type { FloatLine } from '../components/ui/FloatingCombatText'

// All timings scaled 1.5x from their original values (620/130/280/220/900/360/480) to give
// FloatingCombatText's longer hold+fade (1275ms) room to play out between hits on the same
// unit without getting cut off by the next event landing. Revert the multiplier if this ends
// up feeling too sluggish rather than re-deriving each value by hand.
const INTER_SHOT_MS         = 930   // gap between each player/guard shot starting
const BURST_INTER_MS        = 195   // gap between shots within a burst (rapid fire)
const SHOOTER_FLASH_MS      = 420   // how long the shooter glows before the bullet lands
const TARGET_FLASH_DELAY    = 330   // after shooter flash, when the enemy reacts (hit or dodge)
const RETALIATION_PAUSE     = 1350  // extra pause before enemies strike back
const ATTACK_LAND_DELAY     = 540   // after enemy lunge, when damage/dodge registers on its target
const INTER_ENEMY_ATTACK_MS = 720   // gap between individual enemy attacks — quicker than player/guard shots

export interface EnemyAnimEntry { key: number; type: 'hit' | 'miss' | 'attack' }

export interface FloatTextEntry { key: number; lines: FloatLine[] }

const NO_FLOAT: FloatTextEntry = { key: 0, lines: [] }

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
  displayPAGuardArmor: Record<string, number>    // keyed by PAGuardUnit.id
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
  enemyFloatText: Record<string, FloatTextEntry>
  guardFloatText: Record<string, FloatTextEntry>   // shared guard + pa_guard, keyed by unit id
  playerFloatText: FloatTextEntry
  mountFloatText: FloatTextEntry
}

function initialGuardHealthMap(guards: GuardUnit[] | PAGuardUnit[]): Record<string, number> {
  return Object.fromEntries(guards.map(g => [g.id, g.health]))
}

function initialPAGuardArmorMap(paGuards: PAGuardUnit[]): Record<string, number> {
  return Object.fromEntries(paGuards.map(g => [g.id, g.armorPoints]))
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
    displayPAGuardArmor: initialPAGuardArmorMap(paGuards),
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
    enemyFloatText: {},
    guardFloatText: {},
    playerFloatText: NO_FLOAT,
    mountFloatText: NO_FLOAT,
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
    const workingPAGuardArmor  = initialPAGuardArmorMap(paGuards)
    const workingGuardDamageKeys: Record<string, number> = {}
    const workingGuardDodgeKeys:  Record<string, number> = {}
    const workingGuardCooldown = initialGuardCooldownMap(guards)
    let workingGunCooldown = initialGunCooldown
    const workingEnemyFloatText: Record<string, FloatTextEntry> = {}
    const workingGuardFloatText: Record<string, FloatTextEntry> = {}
    let floatKeySeq = 0
    const nextFloatEntry = (lines: FloatLine[]): FloatTextEntry => ({ key: ++floatKeySeq, lines })
    // Enemies/mount have no armor concept — a hit is always a flat "-X HP", a miss is "MISS".
    const setEnemyFloat = (targetId: string, hit: boolean, damage: number) => {
      workingEnemyFloatText[targetId] = nextFloatEntry(
        hit ? [{ text: `-${damage} HP`, color: 'var(--pip-red)' }] : [{ text: 'MISS', color: 'var(--pip-purple)' }],
      )
    }
    // Player/PA guards can have armor absorb part of a hit — up to two stacked lines,
    // mirroring the "Armor absorbs X, you take Y damage" text log wording.
    const armorSplitLines = (damage: number, armorAbsorbed: number): FloatLine[] => {
      const lines: FloatLine[] = []
      if (armorAbsorbed > 0) lines.push({ text: `-${armorAbsorbed} AP`, color: 'var(--pip-blue)' })
      const hpLoss = damage - armorAbsorbed
      if (hpLoss > 0) lines.push({ text: `-${hpLoss} HP`, color: 'var(--pip-red)' })
      return lines
    }
    // Shared by 'burst' and 'pa_burst' — both fire a volley of shots at enemies with identical
    // per-shot landing/timing behavior; only who's doing the shooting differs (see call sites).
    type BurstShot = Extract<AnimStep, { kind: 'burst' }>['shots'][number]
    const scheduleBurstShots = (shots: BurstShot[], baseOffset: number) => {
      // Running per-target damage total across this burst — each landed hit's popup shows the
      // accumulated total so far (-20, then -40, then -60), not just that one shot's damage, so
      // rapid-fire shots read as one growing number instead of a blur of tiny replacements.
      // Snapshotted per-shot up front (not read inside the timeout) since all shots are known
      // synchronously here, before any of their staggered timers actually fire.
      const runningTotal: Record<string, number> = {}
      const totalAtShot: number[] = shots.map(shot => {
        if (shot.hit && shot.targetId) runningTotal[shot.targetId] = (runningTotal[shot.targetId] ?? 0) + shot.damage
        return shot.targetId ? (runningTotal[shot.targetId] ?? 0) : 0
      })
      shots.forEach((shot, si) => {
        const tHit = baseOffset + TARGET_FLASH_DELAY + si * BURST_INTER_MS
        timersRef.current.push(setTimeout(() => {
          if (shot.hit && shot.targetId) {
            workingHealth[shot.targetId]  = shot.targetHealthAfter
            workingHitKeys[shot.targetId] = (workingHitKeys[shot.targetId] ?? 0) + 1
            workingAnimInfo[shot.targetId] = { key: (workingAnimInfo[shot.targetId]?.key ?? 0) + 1, type: 'hit' }
          } else if (!shot.hit && shot.targetId) {
            workingAnimInfo[shot.targetId] = { key: (workingAnimInfo[shot.targetId]?.key ?? 0) + 1, type: 'miss' }
          }
          if (shot.targetId) {
            workingEnemyFloatText[shot.targetId] = nextFloatEntry(
              shot.hit ? [{ text: `-${totalAtShot[si]} HP`, color: 'var(--pip-red)' }] : [{ text: 'MISS', color: 'var(--pip-purple)' }],
            )
          }
          setState(s => ({
            ...s,
            activeTargetId:     shot.hit && shot.targetId ? shot.targetId : null,
            displayEnemyHealth: shot.hit ? { ...workingHealth } : s.displayEnemyHealth,
            enemyHitKeys:       shot.hit ? { ...workingHitKeys } : s.enemyHitKeys,
            enemyAnimInfo:      { ...workingAnimInfo },
            enemyFloatText:     { ...workingEnemyFloatText },
          }))
          onLogLineRef.current?.(shot.logLine)
        }, tHit))
      })
    }

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
      displayPAGuardArmor: { ...workingPAGuardArmor },
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
      enemyFloatText: {},
      guardFloatText: {},
      playerFloatText: NO_FLOAT,
      mountFloatText: NO_FLOAT,
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
            setEnemyFloat(targetId, hit, step.damage)
            setState(s => ({
              ...s,
              activeTargetId:     hit ? targetId : null,
              displayEnemyHealth: hit ? { ...workingHealth } : s.displayEnemyHealth,
              enemyHitKeys:       hit ? { ...workingHitKeys } : s.enemyHitKeys,
              enemyAnimInfo:      { ...workingAnimInfo },
              enemyFloatText:     { ...workingEnemyFloatText },
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
            setEnemyFloat(targetId, hit, step.damage)
            setState(s => ({
              ...s,
              activeTargetId:     hit ? targetId : null,
              displayEnemyHealth: hit ? { ...workingHealth } : s.displayEnemyHealth,
              enemyHitKeys:       hit ? { ...workingHitKeys } : s.enemyHitKeys,
              enemyAnimInfo:      { ...workingAnimInfo },
              enemyFloatText:     { ...workingEnemyFloatText },
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
              const lines = armorSplitLines(step.damage, apLoss)
              if (step.venomDotDamage) lines.push({ text: `-${step.venomDotDamage} HP (venom)`, color: 'var(--pip-red)' })
              if (step.venomDotDamage) workingPlayerHealth = Math.max(0, workingPlayerHealth - step.venomDotDamage)
              setState(s => ({
                ...s,
                displayPlayerHealth: workingPlayerHealth,
                displayPlayerAP:     workingPlayerAP,
                playerDamageKey:     s.playerDamageKey + 1,
                playerFloatText:     nextFloatEntry(lines),
              }))
            } else if (step.targetKind === 'guard') {
              workingGuardHealth[step.targetId] = step.targetHealthAfter
              workingGuardDamageKeys[step.targetId] = (workingGuardDamageKeys[step.targetId] ?? 0) + 1
              workingGuardFloatText[step.targetId] = nextFloatEntry([{ text: `-${step.damage} HP`, color: 'var(--pip-red)' }])
              setState(s => ({ ...s, displayGuardHealth: { ...workingGuardHealth }, guardDamageKeys: { ...workingGuardDamageKeys }, guardFloatText: { ...workingGuardFloatText } }))
            } else if (step.targetKind === 'pa_guard') {
              const apLoss = step.armorAbsorbed ?? 0
              workingPAGuardArmor[step.targetId] = Math.max(0, (workingPAGuardArmor[step.targetId] ?? 0) - apLoss)
              workingPAGuardHealth[step.targetId] = step.targetHealthAfter
              workingGuardDamageKeys[step.targetId] = (workingGuardDamageKeys[step.targetId] ?? 0) + 1
              workingGuardFloatText[step.targetId] = nextFloatEntry(armorSplitLines(step.damage, apLoss))
              setState(s => ({ ...s, displayPAGuardHealth: { ...workingPAGuardHealth }, displayPAGuardArmor: { ...workingPAGuardArmor }, guardDamageKeys: { ...workingGuardDamageKeys }, guardFloatText: { ...workingGuardFloatText } }))
            } else {
              workingMountHealth = step.targetHealthAfter
              setState(s => ({ ...s, displayMountHealth: workingMountHealth, mountDamageKey: s.mountDamageKey + 1, mountDied: step.targetDied || s.mountDied, mountFloatText: nextFloatEntry([{ text: `-${step.damage} HP`, color: 'var(--pip-red)' }]) }))
            }
          } else {
            const missLines: FloatLine[] = [{ text: 'MISS', color: 'var(--pip-purple)' }]
            if (step.targetKind === 'player') {
              setState(s => ({ ...s, playerDodgeKey: s.playerDodgeKey + 1, playerFloatText: nextFloatEntry(missLines) }))
            } else if (step.targetKind === 'guard') {
              workingGuardDodgeKeys[step.targetId] = (workingGuardDodgeKeys[step.targetId] ?? 0) + 1
              workingGuardFloatText[step.targetId] = nextFloatEntry(missLines)
              setState(s => ({ ...s, guardDodgeKeys: { ...workingGuardDodgeKeys }, guardFloatText: { ...workingGuardFloatText } }))
            } else if (step.targetKind === 'pa_guard') {
              workingGuardDodgeKeys[step.targetId] = (workingGuardDodgeKeys[step.targetId] ?? 0) + 1
              workingGuardFloatText[step.targetId] = nextFloatEntry(missLines)
              setState(s => ({ ...s, guardDodgeKeys: { ...workingGuardDodgeKeys }, guardFloatText: { ...workingGuardFloatText } }))
            } else {
              setState(s => ({ ...s, mountDodgeKey: s.mountDodgeKey + 1, mountFloatText: nextFloatEntry(missLines) }))
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
        const burstCooldown = step.shooterCooldownRemaining
        timersRef.current.push(setTimeout(() => {
          if (burstCooldown !== undefined) workingGunCooldown = burstCooldown
          setState(s => ({ ...s, activeShooterId: null, activeTargetId: null, playerFireKey: s.playerFireKey + 1, displayAmmo: ammoAtBurst, displayGunCooldown: workingGunCooldown }))
        }, offset))

        // Each shot in the burst lands BURST_INTER_MS apart
        scheduleBurstShots(step.shots, offset)

        // Advance offset past the entire burst duration
        offset += TARGET_FLASH_DELAY + step.shots.length * BURST_INTER_MS + INTER_SHOT_MS

      } else if (step.kind === 'pa_burst') {
        // ── PA guard minigun burst — guard card glows, then shots land in rapid succession ──
        const shooterId = step.shooterId
        timersRef.current.push(setTimeout(() => {
          workingFireKeys[shooterId] = (workingFireKeys[shooterId] ?? 0) + 1
          setState(s => ({ ...s, activeShooterId: shooterId, activeTargetId: null, guardFireKeys: { ...workingFireKeys } }))
        }, offset))

        scheduleBurstShots(step.shots, offset)

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
          setEnemyFloat(step.primaryTargetId, true, step.primaryDamage)
          for (const sh of step.splashHits) {
            workingHealth[sh.targetId] = sh.healthAfter
            workingHitKeys[sh.targetId] = (workingHitKeys[sh.targetId] ?? 0) + 1
            workingAnimInfo[sh.targetId] = { key: (workingAnimInfo[sh.targetId]?.key ?? 0) + 1, type: 'hit' }
            setEnemyFloat(sh.targetId, true, sh.damage)
          }
          setState(s => ({
            ...s,
            activeTargetId:     step.primaryTargetId,
            displayEnemyHealth: { ...workingHealth },
            enemyHitKeys:       { ...workingHitKeys },
            enemyAnimInfo:      { ...workingAnimInfo },
            enemyFloatText:     { ...workingEnemyFloatText },
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

    // Signal completion — reset hit keys and float text to 0 so FlashOverlay/FloatingCombatText
    // are null when cards remount on the key change from animated-key → unit.id
    timersRef.current.push(setTimeout(() => {
      setState(s => ({
        ...s,
        isAnimating: false,
        enemyHitKeys: {},
        enemyFloatText: {},
        guardFloatText: {},
        playerFloatText: NO_FLOAT,
        mountFloatText: NO_FLOAT,
      }))
      onCompleteRef.current()
    }, offset + SHOOTER_FLASH_MS))

  }, [animSteps]) // eslint-disable-line react-hooks/exhaustive-deps

  return state
}
