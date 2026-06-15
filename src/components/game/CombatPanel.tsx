import type { CombatState, PlayerState } from '../../types/game'
import { useGameStore } from '../../store/gameStore'
import { GAME_MODES } from '../../data/modes'
import { useValueFlash } from '../../hooks/useValueFlash'
import { useMapFlash } from '../../hooks/useMapFlash'
import { FlashText } from '../ui/FlashText'
import { FlashOverlay } from '../ui/FlashOverlay'
import EnemyUnitCard from './EnemyUnitCard'

interface Props { player: PlayerState; combat: CombatState }

export default function CombatPanel({ player, combat }: Props) {
  const { fight, run } = useGameStore()
  const mode = useGameStore(s => s.gameState?.mode ?? 'commonwealth')
  const mc   = GAME_MODES[mode]

  const aliveEnemies = combat.enemies.filter(e => !e.dead)
  const canFight     = !!player.gun && player.gun.ammo > 0
  const isResolved   = combat.phase === 'won' || combat.phase === 'fled' || combat.phase === 'lost'
  const runChancePct = Math.round(Math.min(0.9, Math.max(0.1,
    0.40 + player.guards * 0.10 - player.brahmin * 0.05
  )) * 100)
  const playerHpPct = Math.max(0, Math.round((player.health / player.maxHealth) * 100))
  const paGuards     = player.powerArmorGuards ?? 0

  // Per-enemy HP flash (fires when health decreases)
  const enemyHpMap = Object.fromEntries(combat.enemies.map(e => [e.id, e.health]))
  const enemyFlashes = useMapFlash(enemyHpMap)

  const { flashKey: hpFlash }     = useValueFlash(player.health)
  const { flashKey: guardsFlash } = useValueFlash(player.guards)
  const { flashKey: paFlash }     = useValueFlash(paGuards)
  const { flashKey: brahminFlash }= useValueFlash(player.brahmin)
  const { flashKey: ammoFlash, direction: ammoDir } = useValueFlash(player.gun?.ammo ?? 0)
  const { flashKey: apFlash }     = useValueFlash(player.armor?.armorPoints ?? 0)

  const logRef = (el: HTMLDivElement | null) => {
    if (el) el.scrollTop = el.scrollHeight
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="text-pip-red font-display text-3xl border-b border-pip-red pb-2">
        !! COMBAT !!
      </div>

      {/* Enemy unit row */}
      <div>
        <div className="pip-label mb-2">
          Enemies — {aliveEnemies.length} alive · {combat.capsPool} ¤ on them
        </div>
        <div className="flex gap-3 flex-wrap">
          {combat.enemies.map(unit => (
            <EnemyUnitCard
              key={unit.id}
              unit={unit}
              flashKey={enemyFlashes[unit.id]?.key ?? 0}
            />
          ))}
        </div>
      </div>

      {/* Player status */}
      <div className="border border-pip-border rounded p-3">
        <div className="pip-label mb-1">You</div>
        <div className="h-2.5 bg-pip-border-dim rounded overflow-hidden mb-1">
          <div
            className="h-full bg-pip-green transition-all duration-300"
            style={{ width: `${playerHpPct}%` }}
          />
        </div>
        {player.armor && (() => {
          const apPct = Math.max(0, Math.round((player.armor.armorPoints / player.armor.maxArmorPoints) * 100))
          return (
            <div className="h-2 bg-pip-border-dim rounded overflow-hidden mb-2">
              <div className="h-full bg-pip-blue transition-all duration-300" style={{ width: `${apPct}%` }} />
            </div>
          )
        })()}
        {!player.armor && <div className="mb-2" />}
        <div className="text-xs text-pip-green-dim flex gap-3 flex-wrap">
          <FlashText flashKey={hpFlash} variant="red">{player.health} HP</FlashText>
          {player.armor && (
            <FlashText flashKey={apFlash} variant="amber">
              <span className="text-pip-blue">{player.armor.armorPoints} AP</span>
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
          {player.brahmin > 0 && (
            <span>{player.brahmin} brahmin</span>
          )}
        </div>
      </div>

      {/* Protectors */}
      {(player.guards > 0 || paGuards > 0 || player.brahmin > 0) && (
        <div className="border border-pip-border rounded p-3">
          <div className="pip-label mb-2">Protectors</div>
          <div className="flex gap-2 flex-wrap">
            {Array.from({ length: player.guards }).map((_, i) => (
              <div key={`g-${i}`} className="flex flex-col items-center gap-1" style={{ width: '3rem' }}>
                <div className="relative w-10 h-10 border rounded flex items-center justify-center" style={{ borderColor: 'var(--pip-green)' }}>
                  <FlashOverlay flashKey={guardsFlash} variant="damage" />
                  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor" style={{ color: 'var(--pip-green)' }}>
                    <path d="M20 6C20 6 19.1843 6 19.0001 6C16.2681 6 13.8871 4.93485 11.9999 3C10.1128 4.93478 7.73199 6 5.00009 6C4.81589 6 4.00009 6 4.00009 6C4.00009 6 4 8 4 9.16611C4 14.8596 7.3994 19.6436 12 21C16.6006 19.6436 20 14.8596 20 9.16611C20 8 20 6 20 6Z" />
                  </svg>
                </div>
                <div className="h-1 rounded w-full" style={{ backgroundColor: 'var(--pip-green)' }} />
                <div className="text-center" style={{ fontSize: '0.6rem', color: 'var(--pip-green)', opacity: 0.7 }}>GUARD</div>
              </div>
            ))}
            {Array.from({ length: paGuards }).map((_, i) => (
              <div key={`pa-${i}`} className="flex flex-col items-center gap-1" style={{ width: '3rem' }}>
                <div className="relative w-10 h-10 border rounded flex items-center justify-center" style={{ borderColor: 'var(--pip-blue)' }}>
                  <FlashOverlay flashKey={paFlash} variant="damage" />
                  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor" style={{ color: 'var(--pip-blue)' }}>
                    <path d="M20 6C20 6 19.1843 6 19.0001 6C16.2681 6 13.8871 4.93485 11.9999 3C10.1128 4.93478 7.73199 6 5.00009 6C4.81589 6 4.00009 6 4.00009 6C4.00009 6 4 8 4 9.16611C4 14.8596 7.3994 19.6436 12 21C16.6006 19.6436 20 14.8596 20 9.16611C20 8 20 6 20 6Z" />
                  </svg>
                </div>
                <div className="h-1 rounded w-full" style={{ backgroundColor: 'var(--pip-blue)' }} />
                <div className="text-center" style={{ fontSize: '0.6rem', color: 'var(--pip-blue)', opacity: 0.7 }}>PA</div>
              </div>
            ))}
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
            {player.guards > 0 && <span style={{ color: 'var(--pip-green)' }}>Guard: absorbs {mc.guardHealth} HP ea.</span>}
            {paGuards > 0 && <span style={{ color: 'var(--pip-blue)' }}>PA: absorbs {mc.powerArmorGuardHealth} HP ea.</span>}
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
            {canFight
              ? `FIGHT — ${player.gun!.name} (${player.gun!.ammo} ammo)`
              : 'NO GUN / NO AMMO'}
          </button>
          <button className="pip-btn-amber flex-1" onClick={run}>
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
