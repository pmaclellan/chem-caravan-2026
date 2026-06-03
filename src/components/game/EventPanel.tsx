import { useState } from 'react'
import type { TravelEvent, PlayerState } from '../../types/game'
import { CHEMS } from '../../data/chems'
import { useGameStore } from '../../store/gameStore'
import { calculateCapacity, totalInventoryItems } from '../../engine/travel'
import { priceColor } from '../../utils/priceColor'

interface Props { event: TravelEvent; player: PlayerState }

export default function EventPanel({ event, player }: Props) {
  const resolveEvent    = useGameStore(s => s.resolveEvent)
  const buyFromMerchant = useGameStore(s => s.buyFromMerchant)
  const sellToMerchant  = useGameStore(s => s.sellToMerchant)
  const [merchantQty, setMerchantQty] = useState<Record<string, number>>({})

  const runChance = Math.round(
    Math.min(0.9, Math.max(0.1, 0.40 + player.guards * 0.10 - player.brahmin * 0.05)) * 100
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="text-pip-red font-display text-2xl border-b border-pip-border pb-2">
        !! {event.title} !!
      </div>

      <div className="border border-pip-border p-4 rounded bg-pip-border-dim">
        <p className="text-pip-green text-sm">{event.description}</p>
      </div>

      {event.type === 'raider_ambush' && (
        <div className="flex gap-3">
          <button className="pip-btn-danger flex-1" onClick={() => resolveEvent('fight')}>
            FIGHT
          </button>
          <button className="pip-btn-amber flex-1" onClick={() => resolveEvent('run')}>
            RUN ({runChance}% chance)
          </button>
        </div>
      )}

      {event.type === 'chem_stash' && (() => {
        const { chemId, qty } = event.payload as { chemId: string; qty: number }
        return (
          <div className="flex flex-col gap-2">
            <div className="text-pip-amber font-display text-lg">
              Found: {qty}× {CHEMS[chemId]?.name ?? chemId}
            </div>
            <button className="pip-btn" onClick={() => resolveEvent('take')}>TAKE THE CHEMS</button>
          </div>
        )
      })()}

      {event.type === 'brahmin_lost' && (
        <div className="flex flex-col gap-2">
          <div className="text-pip-red text-sm">One of your brahmin bolted into the wastes. Inventory space reduced.</div>
          <button className="pip-btn" onClick={() => resolveEvent('continue')}>KEEP MOVING</button>
        </div>
      )}

      {event.type === 'debt_collector' && (
        <div className="flex flex-col gap-2">
          <div className="text-pip-red text-sm">The Triggermen are collecting. There's no reasoning with them.</div>
          <button className="pip-btn-danger" onClick={() => resolveEvent('endure')}>TAKE THE BEATING</button>
        </div>
      )}

      {event.type === 'brotherhood_checkpoint' && (() => {
        const { toll } = event.payload as { toll: number }
        return (
          <div className="flex flex-col gap-3">
            <div className="text-pip-green-dim text-sm">
              The Brotherhood demands {toll} caps to pass. You can pay or turn back.
            </div>
            <div className="flex gap-3">
              <button
                className="pip-btn flex-1"
                disabled={player.caps < toll}
                onClick={() => resolveEvent('pay')}
              >
                PAY TOLL ({toll} ¤)
              </button>
              <button className="pip-btn-amber flex-1" onClick={() => resolveEvent('refuse')}>
                TURN BACK
              </button>
            </div>
          </div>
        )
      })()}

      {event.type === 'wandering_merchant' && (() => {
        const payload = event.payload as {
          prices: Record<string, number>
          stock?:  Record<string, number>   // fence has stock to sell
          demand?: Record<string, number>   // buyer has demand to fill
          isFence: boolean
        }
        const { prices, isFence } = payload
        const space = calculateCapacity(player.brahmin) - totalInventoryItems(player.inventory)

        return (
          <div className="flex flex-col gap-3">
            <div className="text-pip-green-dim text-xs">
              {isFence
                ? "Prices are suspiciously low. No receipt. No questions asked."
                : "They're paying above market. Desperate people pay well."}
            </div>

            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-pip-green-dim text-xs uppercase tracking-widest border-b border-pip-border">
                  <th className="text-left py-1 pr-3">Chem</th>
                  <th className="text-right py-1 pr-3">{isFence ? 'Price' : 'Offering'}</th>
                  <th className="text-right py-1 pr-3">{isFence ? 'Stock' : 'Owned'}</th>
                  <th className="py-1 pl-1"></th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(prices).map(([chemId, price]) => {
                  const chem   = CHEMS[chemId]
                  const q      = merchantQty[chemId] ?? 1
                  const pStyle = chem ? priceColor(price, chem.basePrice, chem.priceVariance) : {}

                  if (isFence) {
                    const inStock = payload.stock?.[chemId] ?? 0
                    const canBuy  = player.caps >= price * q && inStock >= q && space >= q
                    return (
                      <tr key={chemId} className="border-b border-pip-border-dim">
                        <td className="py-1.5 pr-3 font-display text-pip-green">{chem?.name ?? chemId}</td>
                        <td className="py-1.5 pr-3 text-right font-display" style={pStyle}>{price} ¤</td>
                        <td className="py-1.5 pr-3 text-right text-pip-green-dim">{inStock}</td>
                        <td className="py-1.5 pl-1">
                          <div className="flex items-center gap-1">
                            <button className="pip-btn text-xs px-1 py-0 leading-4" tabIndex={-1}
                              onClick={() => setMerchantQty(p => ({ ...p, [chemId]: Math.max(1, q - 1) }))}>−</button>
                            <span className="text-pip-green font-display text-sm w-5 text-center select-none">{q}</span>
                            <button className="pip-btn text-xs px-1 py-0 leading-4" tabIndex={-1}
                              onClick={() => setMerchantQty(p => ({ ...p, [chemId]: q + 1 }))}>+</button>
                            <button className="pip-btn-amber text-xs px-2 py-0.5 ml-1"
                              disabled={!canBuy}
                              onClick={() => buyFromMerchant(chemId, q)}>BUY</button>
                          </div>
                        </td>
                      </tr>
                    )
                  } else {
                    const remaining = payload.demand?.[chemId] ?? 0
                    const owned     = player.inventory[chemId]?.quantity ?? 0
                    const canSell   = owned >= q && remaining >= q
                    return (
                      <tr key={chemId} className="border-b border-pip-border-dim">
                        <td className="py-1.5 pr-3 font-display text-pip-green">{chem?.name ?? chemId}</td>
                        <td className="py-1.5 pr-3 text-right font-display" style={pStyle}>{price} ¤</td>
                        <td className="py-1.5 pr-3 text-right text-pip-green-dim">
                          {owned > 0 ? `${owned} owned` : '—'}
                        </td>
                        <td className="py-1.5 pl-1">
                          {owned > 0 && remaining > 0 ? (
                            <div className="flex items-center gap-1">
                              <button className="pip-btn text-xs px-1 py-0 leading-4" tabIndex={-1}
                                onClick={() => setMerchantQty(p => ({ ...p, [chemId]: Math.max(1, q - 1) }))}>−</button>
                              <span className="text-pip-green font-display text-sm w-5 text-center select-none">{q}</span>
                              <button className="pip-btn text-xs px-1 py-0 leading-4" tabIndex={-1}
                                onClick={() => setMerchantQty(p => ({ ...p, [chemId]: q + 1 }))}>+</button>
                              <button className="pip-btn text-xs px-2 py-0.5 ml-1"
                                disabled={!canSell}
                                onClick={() => sellToMerchant(chemId, q)}>SELL</button>
                            </div>
                          ) : (
                            <span className="text-pip-green-dim text-xs italic">
                              {remaining === 0 ? 'satisfied' : 'not in pack'}
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  }
                })}
              </tbody>
            </table>

            <button className="pip-btn self-start" onClick={() => resolveEvent('continue')}>
              {isFence ? 'PASS MERCHANT' : 'MOVE ON'}
            </button>
          </div>
        )
      })()}
    </div>
  )
}
