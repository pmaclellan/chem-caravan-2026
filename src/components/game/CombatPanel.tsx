import type { CombatState, PlayerState } from '../../types/game'
import { useGameStore } from '../../store/gameStore'
import { GAME_MODES } from '../../data/modes'
import { useValueFlash } from '../../hooks/useValueFlash'
import { useMapFlash } from '../../hooks/useMapFlash'
import { useCombatAnimation } from '../../hooks/useCombatAnimation'
import { FlashText } from '../ui/FlashText'
import { FlashOverlay } from '../ui/FlashOverlay'
import EnemyUnitCard from './EnemyUnitCard'

const KEYFRAMES = `
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
  const { fight, run, completeCombatAnim } = useGameStore()
  const combatAnimSteps = useGameStore(s => s.combatAnimSteps)
  const mode = useGameStore(s => s.gameState?.mode ?? 'commonwealth')
  const mc   = GAME_MODES[mode]

  const paGuards    = player.powerArmorGuards ?? 0
  const isResolved  = combat.phase === 'won' || combat.phase === 'fled' || combat.phase === 'lost'
  const isResolving = combat.phase === 'resolving'
  const canFight    = !!player.gun && player.gun.ammo > 0 && !isResolving

  const runChancePct = Math.round(Math.min(0.9, Math.max(0.1,
    0.40 + player.guards * 0.10 - player.brahmin * 0.05
  )) * 100)

  const anim = useCombatAnimation(
    combatAnimSteps,
    combat.enemies,
    player.guards,
    paGuards,
    player.health,
    player.armor?.armorPoints ?? 0,
    completeCombatAnim,
  )

  // Enemy display: animated health during sequence, real health otherwise
  const displayEnemies = anim.isAnimating
    ? combat.enemies.map(e => {
        const h = anim.displayEnemyHealth[e.id] ?? e.health
        return { ...e, health: h, dead: h <= 0 }
      })
    : combat.enemies

  const displayGuards   = anim.isAnimating ? anim.displayGuards   : player.guards
  const displayPAGuards = anim.isAnimating ? anim.displayPAGuards : paGuards

  // Player HP/AP bars animate down during retaliation, snap to real values after
  const displayHealth = anim.isAnimating ? anim.displayPlayerHealth : player.health
  const displayAP     = anim.isAnimating ? anim.displayPlayerAP     : (player.armor?.armorPoints ?? 0)
  const playerHpPct   = Math.max(0, Math.round((displayHealth / player.maxHealth) * 100))

  // Real-state flashes (fire when game state updates after animation completes)
  const { flashKey: hpFlash }      = useValueFlash(player.health)
  const { flashKey: guardsFlash }  = useValueFlash(player.guards)
  const { flashKey: paFlash }      = useValueFlash(paGuards)
  const { flashKey: brahminFlash } = useValueFlash(player.brahmin)
  const { flashKey: ammoFlash, direction: ammoDir } = useValueFlash(player.gun?.ammo ?? 0)
  const { flashKey: apFlash }      = useValueFlash(player.armor?.armorPoints ?? 0)

  // Real-state enemy flashes (after animation, when the real state is applied)
  const realEnemyHpMap    = Object.fromEntries(combat.enemies.map(e => [e.id, e.health]))
  const realEnemyFlashes  = useMapFlash(realEnemyHpMap)

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
                flashKey={
                  anim.isAnimating
                    ? (anim.enemyHitKeys[unit.id] ?? 0)
                    : (realEnemyFlashes[unit.id]?.key ?? 0)
                }
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

      {/* Protectors */}
      {(displayGuards > 0 || displayPAGuards > 0 || player.brahmin > 0) && (
        <div className="border border-pip-border rounded p-3">
          <div className="pip-label mb-2">Protectors</div>
          <div className="flex gap-2 flex-wrap">
            {Array.from({ length: displayGuards }).map((_, i) => (
              <div key={`g-${i}`} className="flex flex-col items-center gap-1" style={{ width: '3rem' }}>
                <div className="relative w-10 h-10 border rounded flex items-center justify-center" style={{ borderColor: 'var(--pip-green)' }}>
                  <GuardGlow flashKey={anim.guardFireKeys[i] ?? 0} isPAGuard={false} />
                  <FlashOverlay flashKey={guardsFlash} variant="damage" />
                  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor" style={{ color: 'var(--pip-green)' }}>
                    <path d="M20 6C20 6 19.1843 6 19.0001 6C16.2681 6 13.8871 4.93485 11.9999 3C10.1128 4.93478 7.73199 6 5.00009 6C4.81589 6 4.00009 6 4.00009 6C4.00009 6 4 8 4 9.16611C4 14.8596 7.3994 19.6436 12 21C16.6006 19.6436 20 14.8596 20 9.16611C20 8 20 6 20 6Z" />
                  </svg>
                </div>
                <div className="h-1 rounded w-full" style={{ backgroundColor: 'var(--pip-green)' }} />
                <div className="text-center" style={{ fontSize: '0.6rem', color: 'var(--pip-green)', opacity: 0.7 }}>GUARD</div>
              </div>
            ))}
            {Array.from({ length: displayPAGuards }).map((_, i) => {
              const globalIdx = displayGuards + i
              return (
                <div key={`pa-${i}`} className="flex flex-col items-center gap-1" style={{ width: '3rem' }}>
                  <div className="relative w-10 h-10 border rounded flex items-center justify-center" style={{ borderColor: 'var(--pip-blue)' }}>
                    <GuardGlow flashKey={anim.guardFireKeys[globalIdx] ?? 0} isPAGuard={true} />
                    <FlashOverlay flashKey={paFlash} variant="damage" />
                    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor" style={{ color: 'var(--pip-blue)' }}>
                      <path d="M20 6C20 6 19.1843 6 19.0001 6C16.2681 6 13.8871 4.93485 11.9999 3C10.1128 4.93478 7.73199 6 5.00009 6C4.81589 6 4.00009 6 4.00009 6C4.00009 6 4 8 4 9.16611C4 14.8596 7.3994 19.6436 12 21C16.6006 19.6436 20 14.8596 20 9.16611C20 8 20 6 20 6Z" />
                    </svg>
                  </div>
                  <div className="h-1 rounded w-full" style={{ backgroundColor: 'var(--pip-blue)' }} />
                  <div className="text-center" style={{ fontSize: '0.6rem', color: 'var(--pip-blue)', opacity: 0.7 }}>PA</div>
                </div>
              )
            })}
            {Array.from({ length: player.brahmin }).map((_, i) => (
              <div key={`b-${i}`} className="flex flex-col items-center gap-1" style={{ width: '3rem' }}>
                <div className="relative w-10 h-10 border rounded flex items-center justify-center" style={{ borderColor: 'var(--pip-amber)' }}>
                  <FlashOverlay flashKey={brahminFlash} variant="damage" />
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
            {displayGuards > 0 && <span style={{ color: 'var(--pip-green)' }}>Guard: absorbs {mc.guardHealth} HP ea.</span>}
            {displayPAGuards > 0 && <span style={{ color: 'var(--pip-blue)' }}>PA: absorbs {mc.powerArmorGuardHealth} HP ea.</span>}
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

      {!isResolved && (
        <div className="flex gap-3">
          <button className="pip-btn-danger flex-1" disabled={!canFight} onClick={fight}>
            {isResolving
              ? 'FIRING...'
              : canFight
                ? `FIGHT — ${player.gun!.name} (${player.gun!.ammo} ammo)`
                : 'NO GUN / NO AMMO'}
          </button>
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
    </div>
  )
}
