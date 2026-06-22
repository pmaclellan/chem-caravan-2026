import type { PlayerState } from '../../../types/game'
import { GAME_MODES } from '../../../data/modes'
import { useGameStore } from '../../../store/gameStore'

export function FollowersPanel({ player }: { player: PlayerState }) {
  const mode = useGameStore(s => s.gameState?.mode ?? 'commonwealth')
  const mc = GAME_MODES[mode]
  const store = useGameStore()

  return (
    <div className="border border-pip-border p-3 rounded space-y-4">
      <div className="space-y-2">
        <div className="pip-label">GUARDS — {mc.guardCost} ¤ each</div>
        <div className="text-xs text-pip-green-dim">
          {player.guards} / {mc.maxGuards} · Each absorbs {mc.guardHealth} HP in combat and improves escape chance.
        </div>
        <div className="flex gap-2 mt-1 flex-wrap">
          {[1, 2, 3].map(n => {
            const atCap = player.guards >= mc.maxGuards
            return (
              <button
                key={n}
                className="pip-btn"
                disabled={atCap || player.caps < n * mc.guardCost}
                onClick={() => store.hireguards(n)}
              >
                HIRE {n} ({n * mc.guardCost} ¤)
              </button>
            )
          })}
        </div>
        {player.guards >= mc.maxGuards && (
          <div className="text-xs text-pip-green-dim">Guard roster is full.</div>
        )}
      </div>

      <div className="border-t border-pip-border-dim pt-3 space-y-2">
        <div className="pip-label">POWER ARMOR GUARDS — {mc.powerArmorGuardCost} ¤ each</div>
        <div className="text-xs text-pip-green-dim">
          {player.powerArmorGuards ?? 0} / {mc.maxPowerArmorGuards} · Each absorbs {mc.powerArmorGuardHealth} HP — fires as a regular guard.
        </div>
        <div className="flex gap-2 mt-1 flex-wrap">
          {[1, 2].map(n => {
            const atCap = (player.powerArmorGuards ?? 0) >= mc.maxPowerArmorGuards
            return (
              <button
                key={n}
                className="pip-btn-amber"
                disabled={atCap || player.caps < n * mc.powerArmorGuardCost}
                onClick={() => store.purchasePowerArmorGuard(n)}
              >
                HIRE {n} ({n * mc.powerArmorGuardCost} ¤)
              </button>
            )
          })}
        </div>
        {(player.powerArmorGuards ?? 0) >= mc.maxPowerArmorGuards && (
          <div className="text-xs text-pip-green-dim">Power armor roster is full.</div>
        )}
      </div>

      <div className="border-t border-pip-border-dim pt-3 space-y-2">
        <div className="pip-label">BRAHMIN — {mc.brahminCost} ¤ each</div>
        <div className="text-xs text-pip-green-dim">
          {player.brahmin} / {mc.maxBrahmin} · +{mc.capacityPerBrahmin} inventory capacity each
        </div>
        <div className="flex gap-2 mt-1">
          {[1, 2].map(n => {
            const atCap = player.brahmin >= mc.maxBrahmin
            return (
              <button
                key={n}
                className="pip-btn"
                disabled={atCap || player.caps < n * mc.brahminCost}
                onClick={() => store.purchaseBrahmin(n)}
              >
                BUY {n} ({n * mc.brahminCost} ¤)
              </button>
            )
          })}
        </div>
        {player.brahmin >= mc.maxBrahmin && (
          <div className="text-xs text-pip-green-dim">Brahmin pen is full.</div>
        )}
      </div>
    </div>
  )
}
