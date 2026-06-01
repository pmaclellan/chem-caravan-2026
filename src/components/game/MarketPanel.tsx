import { useState } from 'react'
import type { PlayerState, SettlementMarket } from '../../types/game'
import { CHEMS, CHEM_IDS } from '../../data/chems'
import { useGameStore } from '../../store/gameStore'
import { calculateCapacity, totalInventoryItems } from '../../engine/travel'

interface Props { player: PlayerState; market: SettlementMarket }

export default function MarketPanel({ player, market }: Props) {
  const [qty, setQty] = useState<Record<string, number>>({})
  const { buy, sell } = useGameStore()

  const capacity = calculateCapacity(player.brahmin)
  const used = totalInventoryItems(player.inventory)
  const space = capacity - used

  return (
    <div className="h-full overflow-y-auto space-y-2">
      <div className="text-pip-green-dim text-xs mb-2">
        {Object.keys(market.prices).length === 0
          ? "No chems available here right now."
          : `${Object.keys(market.prices).length} chems on the market — space: ${space} units`}
      </div>

      {CHEM_IDS.filter(id => market.prices[id]).map(chemId => {
        const chem = CHEMS[chemId]
        const price = market.prices[chemId]
        const stock = market.stock[chemId] ?? 0
        const owned = player.inventory[chemId]?.quantity ?? 0
        const paidPrice = player.inventory[chemId]?.pricePaid ?? 0
        const pnlPerUnit = price - paidPrice
        const q = qty[chemId] ?? 1

        return (
          <div key={chemId} className="border border-pip-border p-3 rounded">
            <div className="flex justify-between items-start mb-1">
              <div>
                <span className="text-pip-green font-display text-lg">{chem.name}</span>
                {owned > 0 && (
                  <span className="text-pip-green-dim text-xs ml-2">
                    (own {owned} @ {paidPrice} ¤{' '}
                    <span className={pnlPerUnit >= 0 ? 'text-pip-amber' : 'text-pip-red'}>
                      {pnlPerUnit >= 0 ? '+' : ''}{pnlPerUnit}
                    </span>)
                  </span>
                )}
              </div>
              <div className="text-right">
                <div className="text-pip-amber font-display text-xl">{price} ¤</div>
                <div className="text-pip-green-dim text-xs">stock: {stock}</div>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-2">
              <input
                type="number"
                min={1}
                max={Math.max(stock, owned)}
                value={q}
                onChange={e => setQty(prev => ({ ...prev, [chemId]: Math.max(1, parseInt(e.target.value) || 1) }))}
                className="pip-input w-16 text-center"
              />
              <button
                className="pip-btn-amber text-sm"
                disabled={player.caps < price * q || stock < q || space < q}
                onClick={() => buy(chemId, q)}
              >
                BUY ({(price * q).toLocaleString()} ¤)
              </button>
              {owned > 0 && (
                <button
                  className="pip-btn text-sm"
                  disabled={owned < q}
                  onClick={() => sell(chemId, q)}
                >
                  SELL ({(price * q).toLocaleString()} ¤)
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
