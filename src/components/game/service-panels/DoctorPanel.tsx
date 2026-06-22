import type { PlayerState } from '../../../types/game'
import { GAME_MODES } from '../../../data/modes'
import { useGameStore } from '../../../store/gameStore'

export function DoctorPanel({ player }: { player: PlayerState }) {
  const mode = useGameStore(s => s.gameState?.mode ?? 'commonwealth')
  const mc = GAME_MODES[mode]
  const settlement = mc.settlements[player.location]
  const store = useGameStore()
  const antivenomOwned = player.inventory['antivenom']?.quantity ?? 0

  return (
    <div className="border border-pip-border p-3 rounded space-y-2">
      <div className="pip-label">DOCTOR — {settlement.doctorCost} ¤ to fully heal</div>
      <div className="text-xs text-pip-green-dim">Current HP: {player.health} / {player.maxHealth}</div>
      <button
        className="pip-btn w-full"
        disabled={player.health >= player.maxHealth || player.caps < settlement.doctorCost}
        onClick={() => store.heal()}
      >
        HEAL ({settlement.doctorCost} ¤)
      </button>
      {player.mount && (() => {
        const mountHealCost = settlement.doctorCost * 2
        return (
          <button
            className="pip-btn w-full"
            disabled={player.mount!.health >= player.mount!.maxHealth || player.caps < mountHealCost}
            onClick={() => store.healMount()}
          >
            HEAL MOUNT — {player.mount!.name} ({player.mount!.health}/{player.mount!.maxHealth} HP) · {mountHealCost} ¤
          </button>
        )
      })()}
      <div className="border-t border-pip-border pt-2 mt-1 space-y-1">
        <div className="pip-label">ANTIVENOM — 200 ¤{antivenomOwned > 0 ? ` (have ${antivenomOwned})` : ''}</div>
        <div className="text-xs text-pip-green-dim">Cures cazador and radscorpion venom.</div>
        <button
          className="pip-btn w-full"
          disabled={player.caps < 200}
          onClick={() => store.buyAntivenom()}
        >
          BUY ANTIVENOM (200 ¤)
        </button>
      </div>
    </div>
  )
}
