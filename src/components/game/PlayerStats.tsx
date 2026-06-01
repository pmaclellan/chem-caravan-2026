import type { PlayerState } from '../../types/game'
import { useValueFlash } from '../../hooks/useValueFlash'
import { FlashText } from '../ui/FlashText'

interface Props { player: PlayerState; turn: number; maxTurns: number }

export default function PlayerStats({ player, turn, maxTurns }: Props) {
  const hpPct = Math.max(0, Math.round((player.health / player.maxHealth) * 100))
  const hpColor = hpPct > 60 ? 'bg-pip-green' : hpPct > 30 ? 'bg-pip-amber' : 'bg-pip-red'
  const debtColor = player.debt > 0
    ? (player.ageOfDebt >= 10 ? 'text-pip-red' : player.ageOfDebt >= 5 ? 'text-pip-amber' : 'text-pip-green')
    : 'text-pip-green-dim'

  const { flashKey: capsFlash, direction: capsDir } = useValueFlash(player.caps)
  const capsVariant = capsDir === 'up' ? 'green' : 'amber'

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

      <div>
        <div className="pip-label">Turn</div>
        <div className="pip-value">{turn} <span className="text-pip-green-dim text-sm">/ {maxTurns}</span></div>
      </div>

      <div className="border-t border-pip-border pt-2">
        <div className="pip-label">Caps on Hand</div>
        <div className="pip-value">
          <FlashText flashKey={capsFlash} variant={capsVariant} className="text-pip-amber">
            {player.caps.toLocaleString()} ¤
          </FlashText>
        </div>
      </div>

      {player.bank > 0 && (
        <div>
          <div className="pip-label">In Bank</div>
          <div className="text-pip-green font-display text-lg">{player.bank.toLocaleString()} ¤</div>
        </div>
      )}

      <div>
        <div className="pip-label">Debt</div>
        <div className={`font-display text-lg ${debtColor}`}>
          {player.debt > 0 ? `${player.debt.toLocaleString()} ¤` : 'CLEAR'}
        </div>
        {player.debt > 0 && player.ageOfDebt > 0 && (
          <div className="text-xs text-pip-green-dim">Age: {player.ageOfDebt} turn{player.ageOfDebt !== 1 ? 's' : ''}</div>
        )}
      </div>

      <div className="border-t border-pip-border pt-2 flex flex-col gap-1">
        <div className="flex justify-between">
          <span className="pip-label">Guards</span>
          <span className="text-pip-green font-display">{player.guards}</span>
        </div>
        <div className="flex justify-between">
          <span className="pip-label">Brahmin</span>
          <span className="text-pip-green font-display">{player.brahmin}</span>
        </div>
        <div className="flex justify-between">
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

      <div className="border-t border-pip-border pt-2">
        <div className="pip-label">Location</div>
        <div className="text-pip-green text-sm">{player.location.replace(/_/g, ' ').toUpperCase()}</div>
      </div>
    </div>
  )
}
