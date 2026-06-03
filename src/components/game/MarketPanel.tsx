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
  const available = CHEM_IDS.filter(id => market.prices[id])

  if (available.length === 0) {
    return <div className="text-pip-green-dim text-xs">No chems available here right now.</div>
  }

  return (
    <div className="flex flex-col">
      <div className="text-pip-green-dim text-xs mb-1">
        {available.length} chems · space: {space} units
      </div>

      <div>
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 bg-pip-bg-light z-10">
            <tr className="text-pip-green-dim text-xs uppercase tracking-widest border-b border-pip-border">
              <th className="text-left py-1 pr-2 w-6"></th>
              <th className="text-left py-1 pr-2">Chem</th>
              <th className="text-right py-1 pr-2">Price</th>
              <th className="text-right py-1 pr-2">Stock</th>
              <th className="text-right py-1 pr-2">Own</th>
              <th className="text-right py-1 pr-2">P/L</th>
              <th className="text-right py-1 pr-2">Qty</th>
              <th className="py-1 pl-1"></th>
            </tr>
          </thead>
          <tbody>
            {available.map(chemId => {
              const chem = CHEMS[chemId]
              const price = market.prices[chemId]
              const stock = market.stock[chemId] ?? 0
              const owned = player.inventory[chemId]?.quantity ?? 0
              const paidPrice = player.inventory[chemId]?.pricePaid ?? 0
              const pnlPerUnit = owned > 0 ? price - paidPrice : null
              const q = qty[chemId] ?? 1
              const canBuy = player.caps >= price * q && stock >= q && space >= q
              const canSell = owned >= q

              return (
                <tr key={chemId} className="border-b border-pip-border-dim hover:bg-pip-border-dim transition-colors">
                  <td className="py-1 pr-1">
                    {chem.imageUrl ? (
                      <img src={chem.imageUrl} alt={chem.name} className="w-6 h-6 object-contain" />
                    ) : (
                      <div className="w-6 h-6 text-center text-pip-green-dim text-xs leading-6">?</div>
                    )}
                  </td>
                  <td className="py-1 pr-2">
                    <span className="text-pip-green font-display text-base">{chem.name}</span>
                  </td>
                  <td className="py-1 pr-2 text-right text-pip-amber font-display">{price}</td>
                  <td className="py-1 pr-2 text-right text-pip-green-dim">{stock}</td>
                  <td className="py-1 pr-2 text-right text-pip-green-dim">{owned > 0 ? owned : '—'}</td>
                  <td className="py-1 pr-2 text-right">
                    {pnlPerUnit !== null ? (
                      <span className={pnlPerUnit >= 0 ? 'text-pip-amber' : 'text-pip-red'}>
                        {pnlPerUnit >= 0 ? '+' : ''}{pnlPerUnit}
                      </span>
                    ) : <span className="text-pip-green-dim">—</span>}
                  </td>
                  {/* [−] qty [+] stepper */}
                  <td className="py-1 pr-1">
                    <div className="flex items-center gap-0.5">
                      <button
                        className="pip-btn text-xs px-1.5 py-0 leading-4"
                        onClick={() => setQty(prev => ({ ...prev, [chemId]: Math.max(1, q - 1) }))}
                        tabIndex={-1}
                      >−</button>
                      <span className="text-pip-green font-display text-sm w-5 text-center select-none">{q}</span>
                      <button
                        className="pip-btn text-xs px-1.5 py-0 leading-4"
                        onClick={() => setQty(prev => ({ ...prev, [chemId]: q + 1 }))}
                        tabIndex={-1}
                      >+</button>
                    </div>
                  </td>
                  <td className="py-1 pl-1">
                    <div className="flex gap-1">
                      <button
                        className="pip-btn-amber text-xs px-2 py-0.5"
                        disabled={!canBuy}
                        onClick={() => buy(chemId, q)}
                      >
                        BUY
                      </button>
                      {owned > 0 && (
                        <button
                          className="pip-btn text-xs px-2 py-0.5"
                          disabled={!canSell}
                          onClick={() => sell(chemId, q)}
                        >
                          SELL
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
