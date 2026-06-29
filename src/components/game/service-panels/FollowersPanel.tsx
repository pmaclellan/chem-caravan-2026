import type { PlayerState } from '../../../types/game'
import { GAME_MODES } from '../../../data/modes'
import { useGameStore } from '../../../store/gameStore'
import { totalGuardSalary, inventoryBaseValue } from '../../../engine/economy'

export function FollowersPanel({ player }: { player: PlayerState }) {
  const mode = useGameStore(s => s.gameState?.mode ?? 'commonwealth')
  const mc   = useGameStore(s => s.gameState ? GAME_MODES[s.gameState.mode] : GAME_MODES['commonwealth'])
  const store = useGameStore()

  const salary      = totalGuardSalary(player, mc)
  const turnsCovered = salary > 0 ? Math.floor(player.caps / salary) : Infinity
  const collateral  = inventoryBaseValue(player.inventory)
  const totalCover  = player.caps + collateral

  // Warning levels
  const salaryDanger  = salary > 0 && turnsCovered < 2 && totalCover < salary * 2
  const salaryWarning = salary > 0 && turnsCovered < 4 && !salaryDanger

  const hasGuards = player.guards > 0 || (player.powerArmorGuards ?? 0) > 0

  return (
    <div className="border border-pip-border p-3 rounded space-y-4">

      {/* ── Payroll summary ──────────────────────────────────────────────── */}
      {hasGuards && (
        <div className={`rounded px-3 py-2 border ${
          salaryDanger  ? 'border-pip-red bg-pip-red/5' :
          salaryWarning ? 'border-pip-amber bg-pip-amber/5' :
          'border-pip-border-dim bg-pip-border-dim/30'
        }`}>
          <div className="flex items-baseline justify-between">
            <span className="pip-label text-[10px]">PAYROLL</span>
            <span className={`font-display text-lg ${
              salaryDanger ? 'text-pip-red' : salaryWarning ? 'text-pip-amber' : 'text-pip-green'
            }`}>
              {salary} ¤/turn
            </span>
          </div>
          <div className="flex items-baseline justify-between mt-0.5">
            <span className="text-[10px] font-mono text-pip-green-dim">
              {turnsCovered === Infinity ? 'No guards' : (
                turnsCovered > 0
                  ? `Caps cover ~${turnsCovered} turn${turnsCovered !== 1 ? 's' : ''}`
                  : 'Caps exhausted'
              )}
            </span>
            {salary > 0 && collateral > 0 && (
              <span className="text-[10px] font-mono text-pip-green-dim">
                Pack worth {collateral.toLocaleString()} ¤
              </span>
            )}
          </div>
          {salaryDanger && (
            <div className="mt-1.5 text-[10px] font-mono text-pip-red leading-tight">
              ⚠ Guards will desert if you can't cover wages — sell chems or dismiss some now.
            </div>
          )}
          {salaryWarning && !salaryDanger && (
            <div className="mt-1.5 text-[10px] font-mono text-pip-amber leading-tight">
              Low on salary funds. Your pack provides collateral while it holds value.
            </div>
          )}
        </div>
      )}

      {/* ── Regular guards ───────────────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <div className="pip-label">GUARDS</div>
          <div className="text-[10px] font-mono text-pip-green-dim">
            {mc.guardCost} ¤ hire · {mc.guardSalaryPerTurn} ¤/turn
          </div>
        </div>
        <div className="text-xs text-pip-green-dim">
          {player.guards} / {mc.maxGuards} · Absorbs {mc.guardHealth} HP · improves escape odds
        </div>
        <div className="flex gap-2 flex-wrap">
          {[1, 2, 3].map(n => (
            <button
              key={n}
              className="pip-btn text-xs"
              disabled={player.guards >= mc.maxGuards || player.caps < n * mc.guardCost}
              onClick={() => store.hireguards(n)}
            >
              HIRE {n} ({(n * mc.guardCost).toLocaleString()} ¤)
            </button>
          ))}
        </div>
        {player.guards >= mc.maxGuards && (
          <div className="text-xs text-pip-green-dim">Guard roster is full.</div>
        )}
      </div>

      {/* ── Power Armor guards ───────────────────────────────────────────── */}
      <div className="border-t border-pip-border-dim pt-3 space-y-2">
        <div className="flex items-baseline justify-between">
          <div className="pip-label">POWER ARMOR GUARDS</div>
          <div className="text-[10px] font-mono text-pip-green-dim">
            {mc.powerArmorGuardCost} ¤ hire · {mc.powerArmorGuardSalaryPerTurn} ¤/turn
          </div>
        </div>
        <div className="text-xs text-pip-green-dim">
          {player.powerArmorGuards ?? 0} / {mc.maxPowerArmorGuards} · Absorbs {mc.powerArmorGuardHealth} HP — elite protection
        </div>
        <div className="flex gap-2 flex-wrap">
          {[1, 2].map(n => (
            <button
              key={n}
              className="pip-btn-amber text-xs"
              disabled={(player.powerArmorGuards ?? 0) >= mc.maxPowerArmorGuards || player.caps < n * mc.powerArmorGuardCost}
              onClick={() => store.purchasePowerArmorGuard(n)}
            >
              HIRE {n} ({(n * mc.powerArmorGuardCost).toLocaleString()} ¤)
            </button>
          ))}
        </div>
        {(player.powerArmorGuards ?? 0) >= mc.maxPowerArmorGuards && (
          <div className="text-xs text-pip-green-dim">Power armor roster is full.</div>
        )}
      </div>

      {/* ── Brahmin ──────────────────────────────────────────────────────── */}
      <div className="border-t border-pip-border-dim pt-3 space-y-2">
        <div className="pip-label">BRAHMIN — {mc.brahminCost} ¤ each</div>
        <div className="text-xs text-pip-green-dim">
          {player.brahmin} / {mc.maxBrahmin} · +{mc.capacityPerBrahmin} inventory capacity each
        </div>
        <div className="flex gap-2">
          {[1, 2].map(n => (
            <button
              key={n}
              className="pip-btn text-xs"
              disabled={player.brahmin >= mc.maxBrahmin || player.caps < n * mc.brahminCost}
              onClick={() => store.purchaseBrahmin(n)}
            >
              BUY {n} ({(n * mc.brahminCost).toLocaleString()} ¤)
            </button>
          ))}
        </div>
        {player.brahmin >= mc.maxBrahmin && (
          <div className="text-xs text-pip-green-dim">Brahmin pen is full.</div>
        )}
      </div>
    </div>
  )
}
