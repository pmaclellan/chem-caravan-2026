import type { PlayerState } from '../../types/game'
import { useGameStore } from '../../store/gameStore'
import { GAME_MODES } from '../../data/modes'
import { totalGuardSalary, inventoryBaseValue } from '../../engine/economy'
import { useValueFlash } from '../../hooks/useValueFlash'
import { FlashText } from '../ui/FlashText'
import { CapsIcon } from '../ui/CapsIcon'

interface Props {
  player: PlayerState
  turn: number
  maxTurns: number | null
}

export default function PlayerStats({ player, turn, maxTurns }: Props) {
  const mode   = useGameStore(s => s.gameState?.mode ?? 'commonwealth')
  const mc     = GAME_MODES[mode]
  const salary = totalGuardSalary(player, mc)
  const hpPct  = Math.max(0, Math.round((player.health / player.maxHealth) * 100))
  const hpColor = hpPct > 60 ? 'bg-pip-green' : hpPct > 30 ? 'bg-pip-amber' : 'bg-pip-red'
  const debtColor = player.debt > 0
    ? (player.ageOfDebt >= 10 ? 'text-pip-red' : player.ageOfDebt >= 5 ? 'text-pip-amber' : 'text-pip-green')
    : 'text-pip-green-dim'

  const { flashKey: capsFlash, direction: capsDir } = useValueFlash(player.caps)
  const capsVariant = capsDir === 'up' ? 'green' : 'amber'

  const packValue = inventoryBaseValue(player.inventory)

  return (
    <div className="pip-panel flex flex-col gap-3 h-full">
      <div className="pip-section-title">{player.name.toUpperCase()}</div>

      <div>
        <div className="pip-label">Health</div>
        <div className="text-xs text-pip-green-dim mb-1">{player.health} / {player.maxHealth} HP</div>
        <div className="h-3 bg-pip-border-dim rounded overflow-hidden">
          <div className={`h-full ${hpColor} transition-all duration-300`} style={{ width: `${hpPct}%` }} />
        </div>
      </div>

      {player.armor && (() => {
        const apPct = Math.max(0, Math.round((player.armor.armorPoints / player.armor.maxArmorPoints) * 100))
        return (
          <div>
            <div className="pip-label">Armor</div>
            <div className="text-xs text-pip-blue mb-1">{player.armor.armorPoints} / {player.armor.maxArmorPoints} AP</div>
            <div className="h-3 bg-pip-border-dim rounded overflow-hidden">
              <div className="h-full bg-pip-blue transition-all duration-300" style={{ width: `${apPct}%` }} />
            </div>
          </div>
        )
      })()}

      <div>
        <div className="pip-label">Turn</div>
        <div className="pip-value">
          {turn}
          {maxTurns !== null
            ? <span className="text-pip-green-dim text-sm"> / {maxTurns}</span>
            : <span className="text-pip-amber text-sm"> ∞</span>}
        </div>
      </div>

      <div>
        <div className="pip-label">XP</div>
        <div className="font-display text-lg text-pip-blue">{(player.xp ?? 0).toLocaleString()}</div>
      </div>

      <div className="border-t border-pip-border pt-2">
        <div className="pip-label">Caps on Hand</div>
        <div className="pip-value flex items-center gap-1.5">
          <FlashText flashKey={capsFlash} variant={capsVariant} className="text-pip-amber flex items-center gap-1.5">
            {player.caps.toLocaleString()} <CapsIcon size={16} />
          </FlashText>
        </div>
        {packValue > 0 && (
          <div className="text-xs text-pip-green-dim mt-0.5">
            Pack value: <span className="text-pip-amber">{packValue.toLocaleString()} ¤</span>
          </div>
        )}
      </div>

      <div>
        <div className="pip-label">Debt</div>
        <div className={`font-display text-lg ${debtColor}`}>
          {player.debt > 0 ? `${player.debt.toLocaleString()} ¤` : 'CLEAR'}
        </div>
        {player.debt > 0 && player.ageOfDebt > 0 && (
          <div className="text-xs text-pip-green-dim">Age: {player.ageOfDebt} turn{player.ageOfDebt !== 1 ? 's' : ''}</div>
        )}
      </div>

      <div className="border-t border-pip-border pt-2 flex flex-col gap-2">
        <div className="flex justify-between items-center">
          <span className="pip-label">Guards</span>
          <span className="text-pip-green font-display">
            {player.guards}{(player.powerArmorGuards ?? 0) > 0 ? ` · ${player.powerArmorGuards} PA` : ''}
          </span>
        </div>
        {salary > 0 && (
          <div className="flex justify-between items-center">
            <span className="pip-label text-pip-green-dim">Payroll</span>
            <span className={`font-mono text-xs flex items-center gap-1 ${
              player.caps < salary * 2 ? 'text-pip-amber' : 'text-pip-green-dim'
            }`}>
              <CapsIcon size={11} /> {salary} / turn
            </span>
          </div>
        )}
        <div className="flex justify-between items-center">
          <span className="pip-label">Brahmin</span>
          <span className="text-pip-green font-display">{player.brahmin}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="pip-label">Capacity</span>
          <span className="text-pip-green font-display">{20 + player.brahmin * 10}</span>
        </div>
      </div>

      {player.gun && (
        <div className="border-t border-pip-border pt-2">
          <div className="pip-label">Weapon</div>
          <div className="text-pip-green text-sm">{player.gun.name}</div>
          <div className="text-xs text-pip-green-dim">
            Ammo: {player.gun.ammo} | Acc: {Math.round(player.gun.accuracy * 100)}%
          </div>
        </div>
      )}

      {player.armor && (
        <div className="border-t border-pip-border pt-2">
          <div className="pip-label">Armor</div>
          <div className="text-pip-blue text-sm">{player.armor.name}</div>
          <div className="text-xs text-pip-green-dim">
            {player.armor.armorPoints} / {player.armor.maxArmorPoints} AP
          </div>
        </div>
      )}

      <div className="border-t border-pip-border pt-2">
        <div className="pip-label">Location</div>
        <div className="text-pip-green text-sm">{player.location.replace(/_/g, ' ').toUpperCase()}</div>
      </div>
    </div>
  )
}
