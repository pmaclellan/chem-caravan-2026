import type { CombatState } from '../../types/game'
import { useGameStore } from '../../store/gameStore'
import { CHEMS } from '../../data/chems'

interface Props { combat: CombatState }

export default function CombatSummaryPanel({ combat }: Props) {
  const { dismissCombatSummary } = useGameStore()

  const won = combat.phase === 'won'
  const fled = combat.phase === 'fled'
  const raidersKilled = combat.raidersStartCount - combat.raiderCount
  const chemEntries = Object.entries(combat.raiderChems).filter(([, qty]) => qty > 0)

  return (
    <div className="flex flex-col gap-4">
      <div className={`font-display text-3xl border-b pb-2 ${
        won ? 'text-pip-amber border-pip-amber' : 'text-pip-green border-pip-green'
      }`}>
        {won ? 'VICTORY' : 'ESCAPED'}
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="pip-panel p-3 space-y-1">
          <div className="pip-label text-xs">DAMAGE DEALT</div>
          <div className="font-display text-2xl text-pip-amber">{combat.totalDamageDealt}</div>
        </div>
        <div className="pip-panel p-3 space-y-1">
          <div className="pip-label text-xs">DAMAGE TAKEN</div>
          <div className="font-display text-2xl text-pip-red">{combat.totalDamageTaken}</div>
        </div>
        <div className="pip-panel p-3 space-y-1">
          <div className="pip-label text-xs">RAIDERS KILLED</div>
          <div className="font-display text-2xl text-pip-green">
            {raidersKilled} / {combat.raidersStartCount}
          </div>
        </div>
        <div className="pip-panel p-3 space-y-1">
          <div className="pip-label text-xs">CAPS LOOTED</div>
          <div className={`font-display text-2xl ${won ? 'text-pip-amber' : 'text-pip-green-dim'}`}>
            {won ? `${combat.capsLooted} ¤` : '— ¤'}
          </div>
        </div>
      </div>

      {won && chemEntries.length > 0 && (
        <div className="pip-panel p-3">
          <div className="pip-label text-xs mb-2">CHEMS FOUND ON BODIES</div>
          <div className="space-y-1">
            {chemEntries.map(([chemId, qty]) => (
              <div key={chemId} className="flex justify-between text-sm">
                <span className="text-pip-green">{CHEMS[chemId]?.name ?? chemId}</span>
                <span className="text-pip-amber font-mono">×{qty}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {won && chemEntries.length === 0 && (
        <div className="text-pip-green-dim text-xs">No chems found on the bodies.</div>
      )}

      {fled && (
        <div className="text-pip-green-dim text-xs">You escaped — no loot.</div>
      )}

      <button className="pip-btn-amber w-full" onClick={dismissCombatSummary}>
        CONTINUE
      </button>
    </div>
  )
}
