import { useState } from 'react'
import type { TravelEvent, PlayerState } from '../../types/game'
import { CHEMS } from '../../data/chems'

import { useGameStore } from '../../store/gameStore'
import { GAME_MODES } from '../../data/modes'
import { calculateCapacity, totalInventoryItems } from '../../engine/travel'
import { priceColor } from '../../utils/priceColor'
import InventorySwapModal from '../ui/InventorySwapModal'

interface Props { event: TravelEvent; player: PlayerState }

export default function EventPanel({ event, player }: Props) {
  const resolveEvent         = useGameStore(s => s.resolveEvent)
  const resolveChemStashSwap = useGameStore(s => s.resolveChemStashSwap)
  const equipGun             = useGameStore(s => s.equipGun)
  const buyFromMerchant      = useGameStore(s => s.buyFromMerchant)
  const sellToMerchant       = useGameStore(s => s.sellToMerchant)
  const mode                 = useGameStore(s => s.gameState?.mode ?? 'commonwealth')
  const [merchantQty, setMerchantQty] = useState<Record<string, number>>({})

  const collectorFaction =
    mode === 'capital_wasteland' ? 'Talon Company' :
    mode === 'mojave_wasteland'  ? 'Legion Assassins' :
    'Triggermen'

  const aliveGuardCount = player.guards.filter(g => !g.dead).length
  const runChance = Math.round(
    Math.min(0.9, Math.max(0.1, 0.40 + aliveGuardCount * 0.10 - player.brahmin * 0.05)) * 100
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="text-pip-red font-display text-2xl border-b border-pip-border pb-2">
        !! {event.title} !!
      </div>

      <div className="border border-pip-border p-4 rounded bg-pip-border-dim">
        <p className="text-pip-green text-sm">{event.description}</p>
      </div>

      {event.type === 'raider_ambush' && (() => {
        const { count, enemyName, isSecondEncounter, forfeitCaps, forfeitChems } = (event.payload ?? {}) as {
          enemyTypeId?: string; count?: number; enemyName?: string
          isSecondEncounter?: boolean; forfeitCaps?: number; forfeitChems?: Record<string, number>
        }
        const fightLabel = count != null && enemyName
          ? `FIGHT — ${count} ${count === 1 ? enemyName : `${enemyName}s`}`
          : `FIGHT (${count ?? '?'} ${count === 1 ? 'enemy' : 'enemies'})`
        const hasForfeit = isSecondEncounter && ((forfeitCaps ?? 0) > 0 || Object.keys(forfeitChems ?? {}).length > 0)
        const chemCount = Object.values(forfeitChems ?? {}).reduce((s, n) => s + n, 0)
        const forfeitDesc = [
          (forfeitCaps ?? 0) > 0 ? `${forfeitCaps} ¤` : '',
          chemCount > 0 ? `${chemCount} chem${chemCount > 1 ? 's' : ''}` : '',
        ].filter(Boolean).join(' and ')
        const ownedGunIds = Object.keys(player.ownedGuns ?? {})
        const mc = GAME_MODES[mode]
        const hasPA = player.armor?.id === 'power_armor'
        return (
          <div className="flex flex-col gap-3">
            {hasForfeit && (
              <div className="border border-pip-red rounded px-3 py-2 text-xs text-pip-red">
                Running forfeits first wave loot: {forfeitDesc}
              </div>
            )}
            {ownedGunIds.length > 1 && (
              <div>
                <div className="pip-label text-xs mb-1">WEAPON</div>
                <div className="flex flex-wrap gap-1.5">
                  {ownedGunIds.map(gid => {
                    const def       = mc.guns[gid]
                    const state     = player.gun?.id === gid ? player.gun : player.ownedGuns[gid]
                    const equipped  = player.gun?.id === gid
                    const paLocked  = !!def?.requiresPowerArmor && !hasPA
                    if (!def || !state) return null
                    return (
                      <button
                        key={gid}
                        disabled={equipped || paLocked}
                        onClick={() => equipGun(gid)}
                        className={`text-xs px-2 py-1 rounded border font-mono ${
                          equipped
                            ? 'border-pip-green text-pip-green bg-pip-border-dim cursor-default'
                            : paLocked
                              ? 'border-pip-border text-pip-green-dim opacity-50 cursor-not-allowed'
                              : 'border-pip-amber text-pip-amber hover:bg-pip-border-dim'
                        }`}
                      >
                        {def.name} ({state.ammo} rds){paLocked ? ' [PA]' : ''}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
            <div className="flex gap-3">
              <button className="pip-btn-danger flex-1" onClick={() => resolveEvent('fight')}>
                {fightLabel}
              </button>
              <button className="pip-btn-amber flex-1" onClick={() => resolveEvent('run')}>
                RUN ({runChance}% chance)
              </button>
            </div>
          </div>
        )
      })()}

      {event.type === 'chem_stash' && (() => {
        const { chemId, qty } = event.payload as { chemId: string; qty: number }
        const capacity = calculateCapacity(player.brahmin)
        const current  = totalInventoryItems(player.inventory)
        const isFull   = current + qty > capacity
        if (isFull) {
          return (
            <InventorySwapModal
              player={player}
              incomingItems={{ [chemId]: qty }}
              onConfirm={(dropped, taken) => resolveChemStashSwap(dropped, taken)}
              onSkip={() => resolveEvent('take')}
              title="PACK FULL"
            />
          )
        }
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

      {event.type === 'debt_collector' && (() => {
        const { warnings = 0, isKill = false } = (event.payload ?? {}) as { warnings?: number; isKill?: boolean }
        const threatLine = isKill
          ? "You've run out of chances. They're not here to warn you."
          : warnings === 0
            ? "Make your payments at the next loanshark. Don't make them come back."
            : "One more miss and they finish the job."
        return (
          <div className="flex flex-col gap-2">
            <div className="text-pip-red text-sm">The {collectorFaction} are collecting. There's no reasoning with them.</div>
            <div className="text-pip-green-dim text-xs italic">{threatLine}</div>
            <button className="pip-btn-danger" onClick={() => resolveEvent('endure')}>{isKill ? 'FACE YOUR FATE' : 'TAKE THE BEATING'}</button>
          </div>
        )
      })()}

      {event.type === 'brotherhood_checkpoint' && (() => {
        const { toll } = event.payload as { toll: number; enemyTypeId?: string }
        const hasFightingChance = !!player.gun && aliveGuardCount >= 2
        return (
          <div className="flex flex-col gap-3">
            <div className="text-pip-green-dim text-sm">
              They demand {toll} caps to pass. Pay the toll, turn back (costs a turn), or fight your way through.
            </div>
            {!hasFightingChance && (
              <div className="text-pip-red text-xs italic">
                Fighting them without a weapon and guards would be suicide.
              </div>
            )}
            <div className="flex gap-3 flex-wrap">
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
              <button className="pip-btn-danger flex-1" onClick={() => resolveEvent('fight')}>
                FIGHT ({aliveGuardCount} guards{player.gun ? `, ${player.gun.name}` : ', no gun'})
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
        const capacity = calculateCapacity(player.brahmin)
        const used     = totalInventoryItems(player.inventory)
        const space    = capacity - used

        return (
          <div className="flex flex-col gap-3">
            <div className="flex gap-4 text-xs border border-pip-border-dim rounded px-3 py-1.5">
              <span className="text-pip-green-dim">Caps: <span className="text-pip-amber font-display">{player.caps.toLocaleString()} ¤</span></span>
              <span className="text-pip-green-dim">Pack: <span className="text-pip-green font-display">{used}/{capacity}</span></span>
            </div>
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
                    const maxBuy  = Math.min(inStock, space)
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
                              onClick={() => setMerchantQty(p => ({ ...p, [chemId]: Math.min(q + 1, maxBuy) }))}>+</button>
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
                    const maxSell  = Math.min(owned, remaining)
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
                                onClick={() => setMerchantQty(p => ({ ...p, [chemId]: Math.min(q + 1, maxSell) }))}>+</button>
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
              MOVE ON
            </button>
          </div>
        )
      })()}
    </div>
  )
}
