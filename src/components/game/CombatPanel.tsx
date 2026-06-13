import type { CombatState, PlayerState } from '../../types/game'
import { useGameStore } from '../../store/gameStore'
import { useValueFlash } from '../../hooks/useValueFlash'
import { useMapFlash } from '../../hooks/useMapFlash'
import { FlashText } from '../ui/FlashText'
import EnemyUnitCard from './EnemyUnitCard'

interface Props { player: PlayerState; combat: CombatState }

export default function CombatPanel({ player, combat }: Props) {
  const { fight, run } = useGameStore()

  const aliveEnemies = combat.enemies.filter(e => !e.dead)
  const canFight     = !!player.gun && player.gun.ammo > 0
  const isResolved   = combat.phase === 'won' || combat.phase === 'fled' || combat.phase === 'lost'
  const runChancePct = Math.round(Math.min(0.9, Math.max(0.1,
    0.40 + player.guards * 0.10 - player.brahmin * 0.05
  )) * 100)
  const playerHpPct = Math.max(0, Math.round((player.health / player.maxHealth) * 100))

  // Per-enemy HP flash (fires when health decreases)
  const enemyHpMap = Object.fromEntries(combat.enemies.map(e => [e.id, e.health]))
  const enemyFlashes = useMapFlash(enemyHpMap)

  const { flashKey: hpFlash }     = useValueFlash(player.health)
  const { flashKey: guardsFlash } = useValueFlash(player.guards)
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
