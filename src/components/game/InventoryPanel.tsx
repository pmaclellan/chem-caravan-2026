import { useEffect, useRef, useState } from 'react'
import type { PlayerState, SettlementMarket } from '../../types/game'
import { CHEMS } from '../../data/chems'
import { calculateCapacity, totalInventoryItems } from '../../engine/travel'

interface Props {
  player: PlayerState
  market: SettlementMarket
}

interface FlashState {
  key: number
  dir: 'buy' | 'sell'
}

// Colors for the flash overlay — chosen for the Pip-Boy terminal palette
const FLASH_BUY_COLOR  = 'rgba(57, 255, 20, 0.16)'
const FLASH_SELL_COLOR = 'rgba(255, 51, 51, 0.18)'

export default function InventoryPanel({ player, market }: Props) {
  const capacity = calculateCapacity(player.brahmin)
  const used = totalInventoryItems(player.inventory)
  const entries = Object.entries(player.inventory).filter(([, v]) => v.quantity > 0)

  const [flashes, setFlashes] = useState<Record<string, FlashState>>({})
  const prevInventoryRef = useRef(player.inventory)

  useEffect(() => {
    const prev = prevInventoryRef.current
    const curr = player.inventory

    const allIds = new Set([...Object.keys(prev), ...Object.keys(curr)])
    const changes: Record<string, 'buy' | 'sell'> = {}

    for (const id of allIds) {
      const prevQty = prev[id]?.quantity ?? 0
      const currQty = curr[id]?.quantity ?? 0
      if (currQty > prevQty) changes[id] = 'buy'
      else if (currQty < prevQty) changes[id] = 'sell'
    }

    if (Object.keys(changes).length > 0) {
      setFlashes(f => {
        const next = { ...f }
        for (const [id, dir] of Object.entries(changes)) {
          next[id] = { key: (f[id]?.key ?? 0) + 1, dir }
        }
        return next
      })
    }

    prevInventoryRef.current = curr
  }, [player.inventory])

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
            const flash = flashes[chemId]

            return (
              <div key={chemId} className="border border-pip-border-dim p-2 rounded flex gap-2 relative overflow-hidden">

                {/* Flash overlay — key increment restarts animation cleanly on each transaction */}
                {flash && (
                  <div
                    key={`${chemId}-${flash.key}`}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      pointerEvents: 'none',
                      borderRadius: 'inherit',
                      backgroundColor: flash.dir === 'buy' ? FLASH_BUY_COLOR : FLASH_SELL_COLOR,
                      animation: 'pip-flash-overlay 380ms ease-out forwards',
                    }}
                  />
                )}

                {chem?.imageUrl && (
                  <img src={chem.imageUrl} alt={chem.name} className="w-8 h-8 object-contain flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
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
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
