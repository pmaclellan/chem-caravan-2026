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
import { TAMEABLE_ENEMY_IDS, TAME_HP_THRESHOLD } from '../../data/mounts'

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
  const { fight, run, completeCombatAnim, openTamingMinigame, completeTame, abandonTame } = useGameStore()
  const combatAnimSteps    = useGameStore(s => s.combatAnimSteps)
  const showTamingMinigame = useGameStore(s => s.showTamingMinigame)
  const mode = useGameStore(s => s.gameState?.mode ?? 'commonwealth')
  const mc   = GAME_MODES[mode]

  const paGuards    = player.powerArmorGuards ?? 0
  const isResolved  = combat.phase === 'won' || combat.phase === 'fled' || combat.phase === 'lost'
  const isResolving = combat.phase === 'resolving'
  const canFight    = !!player.gun && player.gun.ammo > 0 && !isResolving

  const runChancePct = Math.round(Math.min(0.9, Math.max(0.1,
    0.40 + player.guards * 0.10 - player.brahmin * 0.05
  )) * 100)

  const aliveEnemies = combat.enemies.filter(e => !e.dead)
  const soloAlive    = aliveEnemies.length === 1 ? aliveEnemies[0] : null
  const isTameableEnemy = soloAlive ? TAMEABLE_ENEMY_IDS.has(soloAlive.typeId) : false
  const isCornerered    = soloAlive ? soloAlive.health / soloAlive.maxHealth <= TAME_HP_THRESHOLD : false
  const canTame = isTameableEnemy && isCornerered && !!player.tamingTool && player.hasSaddle && !player.mount && !isResolving

  const initialMountHealth = player.mount?.health ?? 0

  const anim = useCombatAnimation(
    combatAnimSteps,
    combat.enemies,
    player.guards,
    paGuards,
    player.health,
    player.armor?.armorPoints ?? 0,
    initialMountHealth,
    completeCombatAnim,
  )

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
  // Total cards to render — stays at pre-fight count so dead guards show as grey
  const totalGuards   = Math.max(anim.initialGuards,   player.guards)
  const totalPAGuards = Math.max(anim.initialPAGuards, paGuards)
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
  const { flashKey: ammoFlash, direction: ammoDir } = useValueFlash(player.gun?.ammo ?? 0)
  const { flashKey: apFlash }      = useValueFlash(player.armor?.armorPoints ?? 0)

  const logRef = (el: HTMLDivElement | null) => {
    if (el) el.scrollTop = el.scrollHeight
  }

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
              {player.gun.name} · {player.gun.ammo} ammo
            </FlashText>
          )}
          {player.guards > 0 && (
            <FlashText flashKey={guardsFlash} variant="red">{player.guards} guards</FlashText>
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
                    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor" style={{ color: 'var(--pip-blue)' }}>
                      <path d="M20 6C20 6 19.1843 6 19.0001 6C16.2681 6 13.8871 4.93485 11.9999 3C10.1128 4.93478 7.73199 6 5.00009 6C4.81589 6 4.00009 6 4.00009 6C4.00009 6 4 8 4 9.16611C4 14.8596 7.3994 19.6436 12 21C16.6006 19.6436 20 14.8596 20 9.16611C20 8 20 6 20 6Z" />
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
                  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{ color: 'var(--pip-amber)' }}>
                    <path d="M5 14c0-2.5 1.5-4 3.5-4s3.5 1.5 3.5 4M12 14c0-2.5 1.5-4 3.5-4s3.5 1.5 3.5 4M3 18h18M7 18v2.5M10 18v2.5M14 18v2.5M17 18v2.5" />
                  </svg>
                </div>
                <div className="h-1 rounded w-full" style={{ backgroundColor: 'var(--pip-amber)' }} />
                <div className="text-center" style={{ fontSize: '0.6rem', color: 'var(--pip-amber)', opacity: 0.7 }}>BRAHMIN</div>
              </div>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-3" style={{ fontSize: '0.6rem', opacity: 0.6 }}>
            {player.mount && !mountIsDead && <span style={{ color: 'var(--pip-amber)' }}>Mount: absorbs {displayMountHp}/{player.mount.maxHealth} HP, then attacks</span>}
            {totalGuards > 0 && <span style={{ color: 'var(--pip-green)' }}>Guard: absorbs {mc.guardHealth} HP ea.</span>}
            {totalPAGuards > 0 && <span style={{ color: 'var(--pip-blue)' }}>PA: absorbs {mc.powerArmorGuardHealth} HP ea.</span>}
            {player.brahmin > 0 && <span style={{ color: 'var(--pip-amber)' }}>Brahmin: 30% escape risk ea.</span>}
          </div>
        </div>
      )}

      {/* Combat log */}
      <div
        ref={logRef}
        className="border border-pip-border p-3 rounded bg-pip-border-dim text-xs font-mono space-y-1 overflow-y-auto max-h-36"
      >
        {combat.log.map((line, i) => (
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

      {/* Tame hint — creature is cornered but player lacks equipment */}
      {isTameableEnemy && isCornerered && !canTame && !isResolving && !isResolved && (
        <div className="text-xs font-mono border rounded p-2" style={{ color: 'var(--pip-amber)', borderColor: 'var(--pip-amber)', opacity: 0.8 }}>
          {soloAlive!.name} is cornered!
          {!player.tamingTool && !player.hasSaddle && ' Buy a taming tool + saddle at any Armory to attempt capture.'}
          {!player.tamingTool && player.hasSaddle && ' Buy a taming tool (Lasso/Tranq Gun/Mesmetron) at any Armory.'}
          {player.tamingTool && !player.hasSaddle && ' Buy a saddle at any Armory to ride it.'}
          {player.mount && ' You already have a mount.'}
        </div>
      )}

      {!isResolved && (
        <div className="flex gap-3">
          <button className="pip-btn-danger flex-1" disabled={!canFight} onClick={fight}>
            {isResolving
              ? 'FIRING...'
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

      {/* Taming mini-game overlay */}
      {showTamingMinigame && player.tamingTool && soloAlive && (
        <TamingMinigame
          tool={player.tamingTool}
          creatureName={soloAlive.name}
          creatureTypeId={soloAlive.typeId}
          onSuccess={completeTame}
          onAbandon={abandonTame}
        />
      )}
    </div>
  )
}
