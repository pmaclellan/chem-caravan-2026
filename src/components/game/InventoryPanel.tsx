import type { PlayerState, SettlementMarket } from '../../types/game'
import { CHEMS } from '../../data/chems'
import { calculateCapacity, totalInventoryItems } from '../../engine/travel'

interface Props {
  player: PlayerState
  market: SettlementMarket
}

export default function InventoryPanel({ player, market }: Props) {
  const capacity = calculateCapacity(player.brahmin)
  const used = totalInventoryItems(player.inventory)
  const entries = Object.entries(player.inventory).filter(([, v]) => v.quantity > 0)

  return (
    <div className="pip-panel flex flex-col gap-2 h-full">
      <div className="pip-section-title text-lg">
        INVENTORY
        <span className="text-pip-green-dim text-sm ml-2">{used}/{capacity}</span>
      </div>

      {entries.length === 0 ? (
        <div className="text-pip-green-dim text-xs">Nothing in your pack.</div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
          {entries.map(([chemId, entry]) => {
            const chem = CHEMS[chemId]
            const marketPrice = market.prices[chemId]
            const pnl = marketPrice ? (marketPrice - entry.pricePaid) * entry.quantity : null
            const pnlColor = pnl === null ? 'text-pip-green-dim' : pnl >= 0 ? 'text-pip-amber' : 'text-pip-red'

            return (
              <div key={chemId} className="border border-pip-border-dim p-2 rounded">
                <div className="flex justify-between">
                  <span className="text-pip-green text-sm">{chem?.name ?? chemId}</span>
                  <span className="text-pip-green font-display">×{entry.quantity}</span>
                </div>
                <div className="text-xs text-pip-green-dim">
                  Paid: {entry.pricePaid} ¤/unit
                </div>
                {marketPrice && (
                  <div className="text-xs flex justify-between">
                    <span className="text-pip-green-dim">Market: {marketPrice} ¤</span>
                    <span className={pnlColor}>{pnl! >= 0 ? '+' : ''}{pnl} ¤</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
