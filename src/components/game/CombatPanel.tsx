import { useState, useEffect, useCallback } from 'react'
import type { CombatState, PlayerState } from '../../types/game'
import { useGameStore } from '../../store/gameStore'
import { GAME_MODES } from '../../data/modes'
import { useValueFlash } from '../../hooks/useValueFlash'
import { useCombatAnimation } from '../../hooks/useCombatAnimation'
import { FlashText } from '../ui/FlashText'
import { FlashOverlay } from '../ui/FlashOverlay'
import EnemyUnitCard from './EnemyUnitCard'
import TamingMinigame from './TamingMinigame'
import { ENEMY_SVGS } from './enemySvgs'
import { TAMEABLE_ENEMY_IDS } from '../../data/mounts'
import { runEscapeChance } from '../../engine/tuning'

const KEYFRAMES = `
  @keyframes mountFire {
    0%   { opacity: 0; box-shadow: none; }
    20%  { opacity: 1; box-shadow: 0 0 18px var(--pip-amber), inset 0 0 10px rgba(196,80,26,0.45); transform: scale(1.14); }
    65%  { opacity: 0.7; box-shadow: 0 0 10px var(--pip-amber); transform: scale(1.05); }
    100% { opacity: 0; box-shadow: none; transform: scale(1); }
  }
  @keyframes guardFire {
    0%   { opacity: 0; box-shadow: none; }
    20%  { opacity: 1; box-shadow: 0 0 16px var(--pip-green), inset 0 0 8px rgba(74,112,24,0.35); transform: scale(1.12); }
    65%  { opacity: 0.7; box-shadow: 0 0 8px var(--pip-green); transform: scale(1.04); }
    100% { opacity: 0; box-shadow: none; transform: scale(1); }
  }
  @keyframes paGuardFire {
    0%   { opacity: 0; box-shadow: none; }
    20%  { opacity: 1; box-shadow: 0 0 18px var(--pip-blue), inset 0 0 10px rgba(42,90,138,0.45); transform: scale(1.12); }
    65%  { opacity: 0.7; box-shadow: 0 0 10px var(--pip-blue); transform: scale(1.04); }
    100% { opacity: 0; box-shadow: none; transform: scale(1); }
  }
  @keyframes playerCardFire {
    0%   { opacity: 0; box-shadow: none; }
    20%  { opacity: 1; box-shadow: 0 0 16px var(--pip-amber), inset 0 0 8px rgba(196,100,26,0.4); transform: scale(1.12); }
    65%  { opacity: 0.7; box-shadow: 0 0 8px var(--pip-amber); transform: scale(1.04); }
    100% { opacity: 0; box-shadow: none; transform: scale(1); }
  }
  @keyframes playerFire {
    0%   { background: transparent; }
    25%  { background: rgba(196,100,26,0.15); }
    100% { background: transparent; }
  }
  @keyframes playerDamage {
    0%   { background: transparent; box-shadow: none; }
    20%  { background: rgba(180,40,40,0.22); box-shadow: inset 0 0 14px rgba(180,40,40,0.25); }
    100% { background: transparent; box-shadow: none; }
  }
`

// Overlay that pulses when a guard fires — remounts on each new flashKey to restart the CSS animation
function GuardGlow({ flashKey, isPAGuard }: { flashKey: number; isPAGuard: boolean }) {
  if (flashKey === 0) return null
  return (
    <div
      key={flashKey}
      style={{
        position: 'absolute', inset: 0, borderRadius: 'inherit', pointerEvents: 'none',
        animation: `${isPAGuard ? 'paGuardFire' : 'guardFire'} 400ms ease-out forwards`,
        zIndex: 2,
      }}
    />
  )
}

// Amber glow on the player icon card when the player fires
function PlayerCardFire({ flashKey }: { flashKey: number }) {
  if (flashKey === 0) return null
  return (
    <div
      key={flashKey}
      style={{
        position: 'absolute', inset: 0, borderRadius: 'inherit', pointerEvents: 'none',
        animation: 'playerCardFire 400ms ease-out forwards',
        zIndex: 2,
      }}
    />
  )
}

// Amber glow on the mount card when it attacks
function MountGlow({ flashKey }: { flashKey: number }) {
  if (flashKey === 0) return null
  return (
    <div
      key={flashKey}
      style={{
        position: 'absolute', inset: 0, borderRadius: 'inherit', pointerEvents: 'none',
        animation: 'mountFire 420ms ease-out forwards',
        zIndex: 2,
      }}
    />
  )
}

// Amber flash on the "You" panel when the player fires
function PlayerGlow({ flashKey }: { flashKey: number }) {
  if (flashKey === 0) return null
  return (
    <div
      key={flashKey}
      style={{
        position: 'absolute', inset: 0, borderRadius: 'inherit', pointerEvents: 'none',
        animation: 'playerFire 420ms ease-out forwards',
        zIndex: 1,
      }}
    />
  )
}

// Red flash on the "You" panel when enemies land a hit
function PlayerDamageGlow({ flashKey }: { flashKey: number }) {
  if (flashKey === 0) return null
  return (
    <div
      key={flashKey}
      style={{
        position: 'absolute', inset: 0, borderRadius: 'inherit', pointerEvents: 'none',
        animation: 'playerDamage 520ms ease-out forwards',
        zIndex: 1,
      }}
    />
  )
}

interface Props { player: PlayerState; combat: CombatState }

export default function CombatPanel({ player, combat }: Props) {
  const { fight, run, completeCombatAnim, openTamingMinigame, completeTame, abandonTame, useAntivenom } = useGameStore()
  const combatAnimSteps    = useGameStore(s => s.combatAnimSteps)
  const showTamingMinigame = useGameStore(s => s.showTamingMinigame)
  const mode     = useGameStore(s => s.gameState?.mode ?? 'commonwealth')
  const gameType = useGameStore(s => s.gameState?.gameType ?? 'standard')
  const mc   = GAME_MODES[mode]

  const paGuards    = player.powerArmorGuards ?? 0

  // Captured once at encounter start (CombatPanel mounts fresh per encounter).
  // Used as the floor for totalGuards so dead guards stay visible across all fight rounds.
  const [encounterInitialGuards]   = useState(player.guards)
  const [encounterInitialPAGuards] = useState(paGuards)

  const isResolved  = combat.phase === 'won' || combat.phase === 'fled' || combat.phase === 'lost'
  const isResolving = combat.phase === 'resolving'
  const gunCooldown = player.gun?.cooldownRemaining ?? 0
  const canFight    = !!player.gun && (player.gun.ammo > 0 || gunCooldown > 0) && !isResolving

  const runChancePct = Math.round(runEscapeChance(player.guards, player.powerArmorGuards ?? 0, player.brahmin) * 100)

  const aliveEnemies = combat.enemies.filter(e => !e.dead)
  const soloAlive    = aliveEnemies.length === 1 ? aliveEnemies[0] : null
  const isTameableEnemy = soloAlive ? TAMEABLE_ENEMY_IDS.has(soloAlive.typeId) : false
  const soloCurrentHP   = soloAlive ? soloAlive.health : 0
  const canTame = gameType === 'free_play' && isTameableEnemy && !!player.tamingTool && player.hasSaddle && !player.mount && !isResolving

  const initialMountHealth = player.mount?.health ?? 0

  // Real-time lines delivered during the current animation round.
  // combat.log already accumulates across rounds, so we only need to augment
  // it with in-flight messages while an animation is playing.
  const [animLines, setAnimLines] = useState<string[]>([])

  // Clear animLines both when a new fight starts and when animation finishes
  // (at which point combat.log has been committed with everything).
  useEffect(() => { setAnimLines([]) }, [combatAnimSteps])

  const onLogLine = useCallback((line: string) => {
    setAnimLines(prev => [...prev, line])
  }, [])

  const anim = useCombatAnimation(
    combatAnimSteps,
    combat.enemies,
    player.guards,
    paGuards,
    player.health,
    player.armor?.armorPoints ?? 0,
    initialMountHealth,
    player.gun?.ammo ?? 0,
    completeCombatAnim,
    onLogLine,
  )

  // Newest message at top — reverse after building the full list.
  // During animation: augment committed log with real-time lines.
  const displayLog = [...(
    anim.isAnimating ? [...combat.log, ...animLines] : combat.log
  )].reverse()

  // Enemy display: animated health during sequence, real health otherwise
  const displayEnemies = anim.isAnimating
    ? combat.enemies.map(e => {
        const h = anim.displayEnemyHealth[e.id] ?? e.health
        return { ...e, health: h, dead: h <= 0 }
      })
    : combat.enemies

  // Alive counts — used to determine which cards are greyed out
  const aliveGuards   = anim.isAnimating ? anim.displayGuards   : player.guards
  const alivePAGuards = anim.isAnimating ? anim.displayPAGuards : paGuards
  // Total cards to render — encounter-start count so dead guards stay visible all round
  const totalGuards   = encounterInitialGuards
  const totalPAGuards = encounterInitialPAGuards
  // Mount health for display during animation
  const displayMountHp = anim.isAnimating ? anim.displayMountHealth : (player.mount?.health ?? 0)
  const mountIsDead    = anim.isAnimating ? anim.mountDied : (player.mount ? player.mount.health <= 0 : false)

  // Player HP/AP bars animate down during retaliation, snap to real values after
  const displayHealth = anim.isAnimating ? anim.displayPlayerHealth : player.health
  const displayAP     = anim.isAnimating ? anim.displayPlayerAP     : (player.armor?.armorPoints ?? 0)
  const playerHpPct   = Math.max(0, Math.round((displayHealth / player.maxHealth) * 100))

  // Real-state flashes (fire when game state updates after animation completes)
  const { flashKey: hpFlash }      = useValueFlash(player.health)
  const { flashKey: guardsFlash }  = useValueFlash(player.guards)
  const { flashKey: paGuardsFlash } = useValueFlash(paGuards)
  const { flashKey: ammoFlash, direction: ammoDir } = useValueFlash(player.gun?.ammo ?? 0)
  const { flashKey: apFlash }      = useValueFlash(player.armor?.armorPoints ?? 0)


  return (
    <div className="flex flex-col gap-4">
      <style>{KEYFRAMES}</style>

      <div className="text-pip-red font-display text-3xl border-b border-pip-red pb-2">
        !! COMBAT !!
      </div>

      {/* Enemy unit row */}
      <div>
        <div className="pip-label mb-2">
          Enemies — {displayEnemies.filter(e => !e.dead).length} alive · {combat.capsPool} ¤ on them
        </div>
        <div className="flex gap-3 flex-wrap">
          {displayEnemies.map(unit => {
            const animEntry = anim.enemyAnimInfo[unit.id]
            // Key change causes EnemyUnitCard to remount → CSS animation restarts cleanly
            const cardKey = anim.isAnimating && animEntry
              ? `${unit.id}-${animEntry.key}`
              : unit.id
            return (
              <EnemyUnitCard
                key={cardKey}
                unit={unit}
                flashKey={anim.enemyHitKeys[unit.id] ?? 0}
                isHit={anim.isAnimating && animEntry?.type === 'hit'}
                isDodge={anim.isAnimating && animEntry?.type === 'miss'}
                isAttacking={anim.isAnimating && animEntry?.type === 'attack'}
              />
            )
          })}
        </div>
      </div>

      {/* Player status */}
      <div className="relative border border-pip-border rounded p-3">
        <PlayerGlow flashKey={anim.playerFireKey} />
        <PlayerDamageGlow flashKey={anim.playerDamageKey} />
        <div className="pip-label mb-1">You</div>
        <div className="h-2.5 bg-pip-border-dim rounded overflow-hidden mb-1">
          <div className="h-full bg-pip-green transition-all duration-500" style={{ width: `${playerHpPct}%` }} />
        </div>
        {player.armor && (() => {
          const apPct = Math.max(0, Math.round((displayAP / player.armor.maxArmorPoints) * 100))
          return (
            <div className="h-2 bg-pip-border-dim rounded overflow-hidden mb-2">
              <div className="h-full bg-pip-blue transition-all duration-500" style={{ width: `${apPct}%` }} />
            </div>
          )
        })()}
        {!player.armor && <div className="mb-2" />}
        <div className="text-xs text-pip-green-dim flex gap-3 flex-wrap">
          <FlashText flashKey={hpFlash} variant="red">{displayHealth} HP</FlashText>
          {player.armor && (
            <FlashText flashKey={apFlash} variant="amber">
              <span className="text-pip-blue">{displayAP} AP</span>
            </FlashText>
          )}
          {player.gun && (
            <FlashText flashKey={ammoFlash} variant={ammoDir === 'down' ? 'red' : 'green'}>
              {player.gun.name} · {anim.isAnimating ? anim.displayAmmo : player.gun.ammo} ammo
            </FlashText>
          )}
          {player.guards > 0 && (
            <FlashText flashKey={guardsFlash} variant="red">{player.guards} guards</FlashText>
          )}
          {paGuards > 0 && (
            <FlashText flashKey={paGuardsFlash} variant="red"><span style={{ color: 'var(--pip-blue)' }}>{paGuards} PA guards</span></FlashText>
          )}
          {player.brahmin > 0 && <span>{player.brahmin} brahmin</span>}
        </div>
      </div>

      {/* Protectors — player card + guards + brahmin */}
      {(totalGuards > 0 || totalPAGuards > 0 || player.brahmin > 0) && (
        <div className="border border-pip-border rounded p-3">
          <div className="pip-label mb-2">Protectors</div>
          <div className="flex gap-2 flex-wrap">

            {/* Player icon card */}
            {(() => {
              const hpPct = Math.max(0, Math.round((displayHealth / player.maxHealth) * 100))
              const hpColor = hpPct > 50 ? 'var(--pip-green)' : hpPct > 25 ? 'var(--pip-amber)' : 'var(--pip-red)'
              return (
                <div className="flex flex-col items-center gap-1" style={{ width: '3rem' }}>
                  <div className="relative w-10 h-10 border rounded flex items-center justify-center" style={{ borderColor: 'var(--pip-amber)' }}>
                    <PlayerCardFire flashKey={anim.playerFireKey} />
                    <FlashOverlay flashKey={anim.playerDamageKey} variant="damage" />
                    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor" style={{ color: 'var(--pip-amber)' }}>
                      <path d="M6.02958 19.4012C5.97501 19.9508 6.3763 20.4405 6.92589 20.4951C7.47547 20.5497 7.96523 20.1484 8.01979 19.5988L6.02958 19.4012ZM15.9802 19.5988C16.0348 20.1484 16.5245 20.5497 17.0741 20.4951C17.6237 20.4405 18.025 19.9508 17.9704 19.4012L15.9802 19.5988ZM20 12C20 16.4183 16.4183 20 12 20V22C17.5228 22 22 17.5228 22 12H20ZM12 20C7.58172 20 4 16.4183 4 12H2C2 17.5228 6.47715 22 12 22V20ZM4 12C4 7.58172 7.58172 4 12 4V2C6.47715 2 2 6.47715 2 12H4ZM12 4C16.4183 4 20 7.58172 20 12H22C22 6.47715 17.5228 2 12 2V4ZM13 10C13 10.5523 12.5523 11 12 11V13C13.6569 13 15 11.6569 15 10H13ZM12 11C11.4477 11 11 10.5523 11 10H9C9 11.6569 10.3431 13 12 13V11ZM11 10C11 9.44772 11.4477 9 12 9V7C10.3431 7 9 8.34315 9 10H11ZM12 9C12.5523 9 13 9.44772 13 10H15C15 8.34315 13.6569 7 12 7V9ZM8.01979 19.5988C8.22038 17.5785 9.92646 16 12 16V14C8.88819 14 6.33072 16.3681 6.02958 19.4012L8.01979 19.5988ZM12 16C14.0735 16 15.7796 17.5785 15.9802 19.5988L17.9704 19.4012C17.6693 16.3681 15.1118 14 12 14V16Z" />
                    </svg>
                  </div>
                  <div className="h-1 w-full rounded overflow-hidden" style={{ backgroundColor: 'var(--pip-border-dim)' }}>
                    <div className="h-full transition-all duration-500" style={{ width: `${hpPct}%`, backgroundColor: hpColor }} />
                  </div>
                  <div className="text-center" style={{ fontSize: '0.6rem', color: 'var(--pip-amber)', opacity: 0.7 }}>YOU</div>
                </div>
              )
            })()}

            {Array.from({ length: totalGuards }).map((_, i) => {
              const dead = i >= aliveGuards
              return (
                <div
                  key={`g-${i}`}
                  className="flex flex-col items-center gap-1"
                  style={{ width: '3rem', opacity: dead ? 0.35 : 1, filter: dead ? 'grayscale(1)' : 'none', transition: 'opacity 400ms, filter 400ms' }}
                >
                  <div className="relative w-10 h-10 border rounded flex items-center justify-center" style={{ borderColor: 'var(--pip-green)' }}>
                    {!dead && <GuardGlow flashKey={anim.guardFireKeys[i] ?? 0} isPAGuard={false} />}
                    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor" style={{ color: 'var(--pip-green)' }}>
                      <path d="M20 6C20 6 19.1843 6 19.0001 6C16.2681 6 13.8871 4.93485 11.9999 3C10.1128 4.93478 7.73199 6 5.00009 6C4.81589 6 4.00009 6 4.00009 6C4.00009 6 4 8 4 9.16611C4 14.8596 7.3994 19.6436 12 21C16.6006 19.6436 20 14.8596 20 9.16611C20 8 20 6 20 6Z" />
                    </svg>
                  </div>
                  <div className="h-1 rounded w-full" style={{ backgroundColor: dead ? 'var(--pip-border)' : 'var(--pip-green)', transition: 'background-color 400ms' }} />
                  <div className="text-center" style={{ fontSize: '0.6rem', color: 'var(--pip-green)', opacity: 0.7 }}>GUARD</div>
                </div>
              )
            })}
            {Array.from({ length: totalPAGuards }).map((_, i) => {
              const globalIdx = totalGuards + i
              const dead = i >= alivePAGuards
              return (
                <div
                  key={`pa-${i}`}
                  className="flex flex-col items-center gap-1"
                  style={{ width: '3rem', opacity: dead ? 0.35 : 1, filter: dead ? 'grayscale(1)' : 'none', transition: 'opacity 400ms, filter 400ms' }}
                >
                  <div className="relative w-10 h-10 border rounded flex items-center justify-center" style={{ borderColor: 'var(--pip-blue)' }}>
                    {!dead && <GuardGlow flashKey={anim.guardFireKeys[globalIdx] ?? 0} isPAGuard={true} />}
                    <svg viewBox="0 0 100 100" className="w-6 h-6" fill="currentColor" style={{ color: 'var(--pip-blue)' }}>
                      <g transform="translate(0,100) scale(0.1,-0.1)">
                        <path d="M781 976 c-20 -21 -26 -23 -42 -13 -16 10 -24 7 -51 -20 -26 -27 -29 -34 -19 -47 18 -22 4 -38 -28 -31 -21 4 -33 -1 -55 -24 -25 -26 -27 -33 -16 -46 12 -14 2 -27 -70 -100 -83 -84 -85 -85 -125 -78 -32 4 -54 19 -111 74 -40 38 -77 69 -84 69 -19 0 -54 -21 -72 -44 -32 -38 -22 -64 52 -140 38 -40 70 -80 70 -89 0 -15 -44 -57 -60 -57 -4 0 -16 17 -25 37 -23 50 -44 73 -66 73 -29 0 -79 -49 -79 -77 0 -27 36 -93 50 -93 5 0 14 -9 20 -20 9 -16 7 -26 -9 -47 -39 -48 -30 -68 82 -180 133 -133 129 -133 256 -8 63 61 105 95 119 95 28 0 108 77 117 112 4 17 1 39 -9 60 l-17 32 82 82 c70 70 86 82 108 78 37 -8 81 38 64 66 -17 26 9 49 33 30 13 -11 20 -9 47 18 26 27 30 35 20 50 -9 14 -6 22 15 45 l26 27 -94 95 c-52 52 -97 95 -101 95 -3 0 -16 -11 -28 -24z m48 -40 c9 -10 8 -16 -4 -26 -21 -17 -51 6 -34 26 6 8 15 14 19 14 4 0 13 -6 19 -14z m85 -215 c-6 -7 -194 181 -194 194 0 5 45 -35 100 -90 54 -54 97 -101 94 -104z m-29 159 c4 -6 1 -17 -5 -26 -10 -11 -16 -12 -26 -3 -11 9 -11 15 -3 25 14 17 25 18 34 4z m-156 -44 c9 -10 8 -16 -4 -26 -19 -16 -41 1 -32 24 8 20 21 20 36 2z m217 -35 c-9 -14 -33 -14 -41 -1 -4 6 -1 18 6 26 11 13 14 13 27 0 8 -8 11 -19 8 -25z m-216 -76 c52 -52 91 -98 87 -102 -8 -7 -197 175 -197 189 0 19 21 2 110 -87z m55 55 c4 -6 1 -17 -5 -26 -10 -11 -16 -12 -26 -3 -11 9 -11 15 -3 25 14 17 25 18 34 4z m-157 -43 c9 -10 -9 -33 -77 -101 -78 -78 -89 -85 -101 -71 -12 14 -3 27 71 101 46 46 86 84 90 84 4 0 11 -6 17 -13z m218 -36 c-9 -14 -33 -14 -41 -1 -4 6 -1 18 6 26 11 13 14 13 27 0 8 -8 11 -19 8 -25z m-608 -44 l63 -63 -26 -24 -25 -24 -60 59 c-33 33 -60 64 -60 69 0 11 30 46 39 46 4 0 35 -28 69 -63z m449 17 c2 -5 -35 -47 -82 -94 -67 -67 -87 -82 -97 -72 -10 10 5 30 72 97 79 80 99 93 107 69z m-19 -151 c-76 -76 -89 -85 -103 -73 -14 12 -7 23 72 102 78 78 89 86 103 73 13 -14 5 -25 -72 -102z m-176 -51 c59 -60 108 -116 108 -125 0 -10 -16 -35 -36 -57 -57 -63 -72 -58 -190 63 -56 56 -104 110 -107 120 -8 23 67 107 96 107 12 0 62 -42 129 -108z m-392 -7 c0 -8 11 -27 25 -43 24 -28 24 -30 6 -46 -17 -16 -20 -14 -55 24 -41 45 -43 56 -19 82 12 14 19 15 30 7 7 -6 13 -17 13 -24z m268 -322 c-46 -46 -89 -83 -97 -83 -18 0 -179 157 -187 183 -5 15 13 38 77 103 l84 84 102 -102 103 -103 -82 -82z"/>
                      </g>
                    </svg>
                  </div>
                  <div className="h-1 rounded w-full" style={{ backgroundColor: dead ? 'var(--pip-border)' : 'var(--pip-blue)', transition: 'background-color 400ms' }} />
                  <div className="text-center" style={{ fontSize: '0.6rem', color: 'var(--pip-blue)', opacity: 0.7 }}>PA</div>
                </div>
              )
            })}
            {/* Mount card */}
            {player.mount && (() => {
              const mountHpPct  = Math.max(0, Math.round((displayMountHp / player.mount.maxHealth) * 100))
              const mountHpColor = mountHpPct > 50 ? 'var(--pip-green)' : mountHpPct > 25 ? 'var(--pip-amber)' : 'var(--pip-red)'
              const mountSvg = ENEMY_SVGS[player.mount.creatureTypeId] ?? ''
              return (
                <div
                  className="flex flex-col items-center gap-1"
                  style={{ width: '3rem', opacity: mountIsDead ? 0.35 : 1, filter: mountIsDead ? 'grayscale(1)' : 'none', transition: 'opacity 400ms, filter 400ms' }}
                >
                  <div className="relative w-10 h-10 border rounded flex items-center justify-center" style={{ borderColor: 'var(--pip-amber)' }}>
                    {!mountIsDead && <MountGlow flashKey={anim.mountFireKey} />}
                    <svg viewBox="0 0 48 48" className="w-7 h-7" style={{ color: 'var(--pip-amber)' }}
                      dangerouslySetInnerHTML={{ __html: mountSvg }}
                    />
                  </div>
                  <div className="h-1 w-full rounded overflow-hidden" style={{ backgroundColor: 'var(--pip-border-dim)' }}>
                    <div className="h-full transition-all duration-500" style={{ width: `${mountHpPct}%`, backgroundColor: mountHpColor }} />
                  </div>
                  <div className="text-center" style={{ fontSize: '0.6rem', color: 'var(--pip-amber)', opacity: 0.7 }}>MOUNT</div>
                </div>
              )
            })()}

            {Array.from({ length: player.brahmin }).map((_, i) => (
              <div key={`b-${i}`} className="flex flex-col items-center gap-1" style={{ width: '3rem' }}>
                <div className="relative w-10 h-10 border rounded flex items-center justify-center" style={{ borderColor: 'var(--pip-amber)' }}>
                  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor" style={{ color: 'var(--pip-amber)' }}>
                    {/* Body */}
                    <path d="M8 14C8 10.5 10.5 9 15 9C19.5 9 22 10.5 22 14C22 17.5 19.5 19 15 19C10.5 19 8 17.5 8 14Z" />
                    {/* Upper head — centered on upper half of body */}
                    <path d="M2 11C2 8 8 8 8 11C8 14 2 14 2 11Z" />
                    {/* Upper horns */}
                    <path d="M3.5 9C3 7.5 3.5 6 4.5 6C4.5 7 4 8 3.5 9ZM6.5 8.5C6.5 7 7.5 6 8 6C8 7 7.5 8 6.5 8.5Z" />
                    {/* Lower head — centered on lower half of body */}
                    <path d="M2 16C2 13.5 8 13.5 8 16C8 18.5 2 18.5 2 16Z" />
                    {/* Lower horns */}
                    <path d="M3.5 14C3 13 3.5 12 4.5 12C4.5 12.5 4 13.5 3.5 14ZM6.5 13.5C6.5 12.5 7.5 12 8 12C8 12.5 7.5 13 6.5 13.5Z" />
                    {/* Legs */}
                    <rect x="9.5" y="18" width="2" height="5.5" rx="1" />
                    <rect x="12.5" y="18" width="2" height="5.5" rx="1" />
                    <rect x="16" y="18.5" width="2" height="5" rx="1" />
                    <rect x="19" y="18.5" width="1.5" height="4.5" rx="0.75" />
                    {/* Tail */}
                    <path d="M22 13C23.5 11 23 9 21.5 8.5C22.5 10 22.5 12 22 13Z" />
                  </svg>
                </div>
                <div className="h-1 rounded w-full" style={{ backgroundColor: 'var(--pip-amber)' }} />
                <div className="text-center" style={{ fontSize: '0.6rem', color: 'var(--pip-amber)', opacity: 0.7 }}>BRAHMIN</div>
              </div>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-3" style={{ fontSize: '0.6rem', opacity: 0.6 }}>
            {player.mount && !mountIsDead && <span style={{ color: 'var(--pip-amber)' }}>Mount: attacks each turn, shields you if guards &amp; armor are gone ({displayMountHp}/{player.mount.maxHealth} HP)</span>}
            {totalGuards > 0 && <span style={{ color: 'var(--pip-green)' }}>Guard: absorbs {mc.guardHealth} HP ea.</span>}
            {totalPAGuards > 0 && <span style={{ color: 'var(--pip-blue)' }}>PA: absorbs {mc.powerArmorGuardHealth} HP ea.</span>}
            {player.brahmin > 0 && <span style={{ color: 'var(--pip-amber)' }}>Each brahmin: −12% escape chance, 30% bolt risk on escape</span>}
          </div>
        </div>
      )}

      {combat.playerVenomed && !isResolved && (
        <div className="border border-red-500 px-2 py-1 rounded text-xs flex items-center justify-between gap-2">
          <span className="text-red-400 font-bold">VENOMED — Accuracy -30%, -5 HP/round</span>
          {(player.inventory['antivenom']?.quantity ?? 0) > 0 && (
            <button className="pip-btn text-xs py-0.5 px-2 shrink-0" onClick={useAntivenom}>USE ANTIVENOM</button>
          )}
        </div>
      )}

      {!isResolved && (
        <div className="flex gap-3">
          <button className="pip-btn-danger flex-1" disabled={!canFight} onClick={fight}>
            {isResolving
              ? 'FIRING...'
              : gunCooldown > 0
                ? `RELOADING — ${gunCooldown} turn${gunCooldown > 1 ? 's' : ''} left`
                : canFight
                  ? `FIGHT — ${player.gun!.name} (${player.gun!.ammo} ammo)`
                  : 'NO GUN / NO AMMO'}
          </button>
          {canTame && (
            <button className="pip-btn-amber" onClick={openTamingMinigame} style={{ flexShrink: 0, fontSize: '0.9rem', padding: '2px 12px' }}>
              TAME
            </button>
          )}
          <button className="pip-btn-amber flex-1" disabled={isResolving} onClick={run}>
            RUN — {runChancePct}% chance
          </button>
        </div>
      )}

      {isResolved && (
        <div className={`font-display text-2xl text-center ${
          combat.phase === 'won'  ? 'text-pip-amber' :
          combat.phase === 'fled' ? 'text-pip-green' : 'text-pip-red'
        }`}>
          {combat.phase === 'won' ? 'VICTORY' : combat.phase === 'fled' ? 'ESCAPED' : 'DEFEATED'}
        </div>
      )}

      {/* Combat log — below buttons so it can't push them off screen */}
      <div className="border border-pip-border p-3 rounded bg-pip-border-dim text-xs font-mono space-y-1 overflow-y-auto max-h-48">
        {displayLog.map((line, i) => (
          <div
            key={i}
            className={
              line.includes('dead') || line.includes('defeated') ? 'text-pip-amber' :
              line.includes('killed') || line.includes('hit you') || line.includes('flee') || line.includes('Missed') ? 'text-pip-red' :
              line.includes('armor absorbs') ? 'text-pip-blue' :
              line.includes('Hit') ? 'text-pip-green-mid' :
              'text-pip-green'
            }
          >
            &gt; {line}
          </div>
        ))}
      </div>

      {/* Taming mini-game overlay */}
      {showTamingMinigame && player.tamingTool && soloAlive && (
        <TamingMinigame
          tool={player.tamingTool}
          creatureName={soloAlive.name}
          creatureTypeId={soloAlive.typeId}
          currentHP={soloCurrentHP}
          onSuccess={completeTame}
          onAbandon={abandonTame}
        />
      )}
    </div>
  )
}
