import type { CombatState, PlayerState } from '../../types/game'
import { useGameStore } from '../../store/gameStore'

interface Props { player: PlayerState; combat: CombatState }

export default function CombatPanel({ player, combat }: Props) {
  const { fight, run } = useGameStore()
  const raiderHpPct = Math.max(0, Math.round((combat.raiderHealth / (combat.raiderCount * 40)) * 100))
  const playerHpPct = Math.max(0, Math.round((player.health / player.maxHealth) * 100))

  const canFight = !!player.gun && player.gun.ammo >= player.gun.ammoPerShot
  const isResolved = combat.phase === 'won' || combat.phase === 'fled' || combat.phase === 'lost'

  return (
    <div className="flex flex-col gap-4">
      <div className="text-pip-red font-display text-3xl border-b border-pip-red pb-2">
        !! COMBAT !!
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="pip-label">Raiders ({combat.raiderCount} alive)</div>
          <div className="h-3 bg-pip-border-dim rounded overflow-hidden mt-1">
            <div className="h-full bg-pip-red transition-all duration-300" style={{ width: `${raiderHpPct}%` }} />
          </div>
          <div className="text-xs text-pip-green-dim mt-1">~{combat.raiderHealth} HP · {combat.raiderCaps} ¤ on them</div>
        </div>
        <div>
          <div className="pip-label">You</div>
          <div className="h-3 bg-pip-border-dim rounded overflow-hidden mt-1">
            <div className="h-full bg-pip-green transition-all duration-300" style={{ width: `${playerHpPct}%` }} />
          </div>
          <div className="text-xs text-pip-green-dim mt-1">{player.health} HP · {player.guards} guards</div>
        </div>
      </div>

      <div className="border border-pip-border p-3 rounded bg-pip-border-dim min-h-[100px] text-xs font-mono space-y-1 overflow-y-auto max-h-32">
        {combat.log.map((line, i) => (
          <div key={i} className={line.includes('Hit') || line.includes('defeated') ? 'text-pip-amber' : line.includes('killed') || line.includes('hit you') ? 'text-pip-red' : 'text-pip-green'}>{line}</div>
        ))}
      </div>

      {!isResolved && (
        <div className="flex gap-3">
          <button
            className="pip-btn-danger flex-1"
            disabled={!canFight}
            onClick={fight}
          >
            {canFight ? `FIGHT (${player.gun!.name}, ${player.gun!.ammo} ammo)` : 'NO GUN / NO AMMO'}
          </button>
          <button className="pip-btn-amber flex-1" onClick={run}>
            RUN ({Math.round(Math.min(0.9, Math.max(0.1, 0.40 + player.guards * 0.10 - player.brahmin * 0.05)) * 100)}% chance)
          </button>
        </div>
      )}

      {isResolved && (
        <div className={`font-display text-2xl text-center ${combat.phase === 'won' ? 'text-pip-amber' : combat.phase === 'fled' ? 'text-pip-green' : 'text-pip-red'}`}>
          {combat.phase === 'won' ? 'VICTORY' : combat.phase === 'fled' ? 'ESCAPED' : 'DEFEATED'}
        </div>
      )}
    </div>
  )
}
