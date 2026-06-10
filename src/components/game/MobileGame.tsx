import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGameStore } from '../../store/gameStore'
import { GAME_MODES } from '../../data/modes'
import { CHEMS, CHEM_IDS } from '../../data/chems'
import { applyMarketEvents } from '../../engine/market'
import { getAdjacentRoads, getRoadDestination, calculateCapacity, totalInventoryItems } from '../../engine/travel'
import { priceColor } from '../../utils/priceColor'
import { useValueFlash } from '../../hooks/useValueFlash'
import { useMapFlash } from '../../hooks/useMapFlash'
import { FlashText } from '../ui/FlashText'
import { FlashOverlay } from '../ui/FlashOverlay'
import CombatPanel from './CombatPanel'
import CombatSummaryPanel from './CombatSummaryPanel'
import EventPanel from './EventPanel'
import TravelSplash from './TravelSplash'
import SettlementMap from './SettlementMap'

type MobileTab = 'stats' | 'market' | 'travel' | 'pack' | 'log'

const PANEL_STYLE = { backgroundColor: 'color-mix(in srgb, var(--pip-bg-light) 93%, transparent)' }

function DangerBars({ level }: { level: number }) {
  const bars = Math.round(level * 5)
  return (
    <span className="inline-flex gap-0.5 align-middle">
      {[1,2,3,4,5].map(i => (
        <span
          key={i}
          className={`inline-block w-1.5 h-3 rounded-sm ${
            i <= bars
              ? bars >= 3 ? 'bg-pip-red' : bars >= 2 ? 'bg-pip-amber' : 'bg-pip-green'
              : 'bg-pip-border'
          }`}
        />
      ))}
    </span>
  )
}

export default function MobileGame() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<MobileTab>('market')
  const [marketQty, setMarketQty] = useState<Record<string, number>>({})
  const [serviceOpen, setServiceOpen] = useState<string | null>(null)
  const [bankAmount, setBankAmount] = useState(100)
  const [ammoQty, setAmmoQty] = useState(10)

  const store = useGameStore()
  const { gameState, buy, sell, travelTo, toast } = store

  // Derive stable primitives before effects so deps are never undefined
  const phase    = gameState?.phase ?? null
  const location = gameState?.player.location ?? null

  // All hooks must be called unconditionally at the top level
  // These are used in the tab render functions below via closure
  const { flashKey: capsFlash, direction: capsDir } = useValueFlash(gameState?.player.caps ?? 0)
  const inventoryQuantities = Object.fromEntries(
    Object.entries(gameState?.player.inventory ?? {}).map(([id, e]) => [id, e.quantity])
  )
  const inventoryFlashes = useMapFlash(inventoryQuantities)

  // Switch to market whenever we arrive at a new settlement
  useEffect(() => {
    if (phase === 'settlement') setTab('market')
  }, [phase, location])

  // Reset any open service panel when we move to a different settlement
  useEffect(() => {
    setServiceOpen(null)
  }, [location])

  if (!gameState) return null

  const mc = GAME_MODES[gameState.mode]
  const { player, world, pendingEvent, pendingQuote, pendingDestination, combat, log } = gameState
  const settlement = mc.settlements[player.location]
  const rawMarket = world.settlements[player.location]
  const market = rawMarket
    ? applyMarketEvents(rawMarket, world.activeMarketEvents, player.location)
    : { prices: {}, stock: {}, lastRefreshed: 0 }

  const isActionBlocked = phase === 'event' || phase === 'combat' || phase === 'combat_summary' || phase === 'traveling'

  const capacity = calculateCapacity(player.brahmin)
  const used = totalInventoryItems(player.inventory)
  const space = capacity - used
  const availableChems = CHEM_IDS.filter(id => market.prices[id])
  const roads = getAdjacentRoads(mc, player.location)

  // ── Stats render function ──────────────────────────────────────────────

  function renderStats() {
    const hpPct = Math.max(0, Math.round((player.health / player.maxHealth) * 100))
    const hpColor = hpPct > 60 ? 'bg-pip-green' : hpPct > 30 ? 'bg-pip-amber' : 'bg-pip-red'
    const debtColor = player.debt > 0
      ? (player.ageOfDebt >= 10 ? 'text-pip-red' : player.ageOfDebt >= 5 ? 'text-pip-amber' : 'text-pip-green')
      : 'text-pip-green-dim'

    const servicesTabs = [
      { key: 'doctor',    label: 'DOCTOR',  avail: settlement.hasDoctor },
      { key: 'bank',      label: 'BANK',    avail: settlement.hasBank },
      { key: 'loanshark', label: 'LOANS',   avail: settlement.hasLoanshark },
      { key: 'gunshop',   label: 'GUNS',    avail: settlement.hasGunShop },
      { key: 'guards',    label: 'GUARDS',  avail: settlement.hasGuards },
      { key: 'brahmin',   label: 'BRAHMIN', avail: settlement.hasBrahminMarket },
    ].filter(t => t.avail)

    return (
      <div className="px-3 py-3 space-y-3 pb-6">
        {/* Player card */}
        <div className="rounded-lg border border-pip-border p-4 space-y-3" style={PANEL_STYLE}>
          <div className="font-display text-pip-green text-2xl">{player.name.toUpperCase()}</div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="pip-label">Health</span>
              <span className="text-xs text-pip-green-dim">{player.health} / {player.maxHealth}</span>
            </div>
            <div className="h-3 bg-pip-border-dim rounded overflow-hidden">
              <div className={`h-full ${hpColor} transition-all duration-300`} style={{ width: `${hpPct}%` }} />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="pip-label">Turn</span>
              <span className="text-xs text-pip-green-dim">{world.turn} / {world.maxTurns}</span>
            </div>
            <div className="h-2 bg-pip-border-dim rounded overflow-hidden">
              <div
                className="h-full bg-pip-amber transition-all duration-300"
                style={{ width: `${(world.turn / world.maxTurns) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Finances */}
        <div className="rounded-lg border border-pip-border p-4" style={PANEL_STYLE}>
          <div className="pip-label mb-2">Finances</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="pip-label">Caps on hand</div>
              <div className="font-display text-pip-amber text-xl">
                <FlashText flashKey={capsFlash} variant={capsDir === 'up' ? 'green' : 'amber'} className="text-pip-amber">
                  {player.caps.toLocaleString()} ¤
                </FlashText>
              </div>
            </div>
            <div>
              <div className="pip-label">In bank</div>
              <div className="font-display text-pip-green text-xl">{player.bank.toLocaleString()} ¤</div>
            </div>
            <div>
              <div className="pip-label">Debt</div>
              <div className={`font-display text-xl ${debtColor}`}>
                {player.debt > 0 ? `${player.debt.toLocaleString()} ¤` : 'CLEAR'}
              </div>
              {player.debt > 0 && player.ageOfDebt > 0 && (
                <div className="text-xs text-pip-green-dim">Age: {player.ageOfDebt}t</div>
              )}
            </div>
            <div>
              <div className="pip-label">Caravan</div>
              <div className="text-pip-green text-sm font-display">
                {player.guards} guards · {player.brahmin} brahmin
              </div>
              <div className="text-xs text-pip-green-dim">Pack {used}/{capacity}</div>
            </div>
          </div>
          {player.gun && (
            <div className="mt-3 pt-3 border-t border-pip-border-dim">
              <div className="pip-label">Weapon</div>
              <div className="text-pip-green font-display">{player.gun.name}</div>
              <div className="text-xs text-pip-green-dim">
                {player.gun.ammo} ammo · {Math.round(player.gun.accuracy * 100)}% accuracy · {player.gun.damage} dmg
              </div>
            </div>
          )}
        </div>

        {/* Services */}
        {servicesTabs.length > 0 && (
          <div className="rounded-lg border border-pip-border p-4 space-y-3" style={PANEL_STYLE}>
            <div className="pip-label">Services at {settlement.name}</div>
            <div className="flex flex-wrap gap-2">
              {servicesTabs.map(t => (
                <button
                  key={t.key}
                  className={serviceOpen === t.key
                    ? 'pip-btn bg-pip-green text-pip-bg-light text-sm px-3 py-1.5'
                    : 'pip-btn text-sm px-3 py-1.5'}
                  onClick={() => setServiceOpen(serviceOpen === t.key ? null : t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {serviceOpen === 'doctor' && (
              <div className="border border-pip-border-dim rounded p-3 space-y-2">
                <div className="pip-label">Doctor — {settlement.doctorCost} ¤ to fully heal</div>
                <div className="text-xs text-pip-green-dim">HP: {player.health} / {player.maxHealth}</div>
                <button
                  className="pip-btn w-full"
                  disabled={player.health >= player.maxHealth || player.caps < settlement.doctorCost}
                  onClick={() => store.heal()}
                >
                  HEAL ({settlement.doctorCost} ¤)
                </button>
              </div>
            )}

            {serviceOpen === 'bank' && (
              <div className="border border-pip-border-dim rounded p-3 space-y-3">
                <div className="pip-label">Bank — caps safe from robbery</div>
                <div className="text-xs text-pip-green-dim">On hand: {player.caps} ¤ · In bank: {player.bank} ¤</div>
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    type="number" min={1} value={bankAmount}
                    onChange={e => setBankAmount(Math.max(1, parseInt(e.target.value) || 1))}
                    className="pip-input w-24"
                  />
                  <button className="pip-btn text-sm" disabled={player.caps < bankAmount} onClick={() => store.deposit(bankAmount)}>DEPOSIT</button>
                  <button className="pip-btn text-sm" disabled={player.bank < bankAmount} onClick={() => store.withdraw(bankAmount)}>WITHDRAW</button>
                </div>
                {player.debt > 0 && (
                  <div>
                    <div className="pip-label mt-1">Repay debt ({player.debt} ¤)</div>
                    <button
                      className="pip-btn mt-1"
                      disabled={player.caps < Math.min(bankAmount, player.debt)}
                      onClick={() => store.payDebt(bankAmount)}
                    >
                      PAY {Math.min(bankAmount, player.debt)} ¤
                    </button>
                  </div>
                )}
              </div>
            )}

            {serviceOpen === 'loanshark' && (
              <div className="border border-pip-border-dim rounded p-3 space-y-3">
                <div className="pip-label">Loanshark — 5% interest/turn</div>
                <div className="text-xs text-pip-red">Current debt: {player.debt} ¤</div>
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    type="number" min={100} step={100} value={bankAmount}
                    onChange={e => setBankAmount(Math.max(100, parseInt(e.target.value) || 100))}
                    className="pip-input w-24"
                  />
                  <button className="pip-btn-danger text-sm" onClick={() => store.borrow(bankAmount)}>BORROW ({bankAmount} ¤)</button>
                </div>
                {player.debt > 0 && (
                  <button
                    className="pip-btn text-sm"
                    disabled={player.caps < Math.min(bankAmount, player.debt)}
                    onClick={() => store.payDebt(bankAmount)}
                  >
                    REPAY {Math.min(bankAmount, player.debt)} ¤
                  </button>
                )}
              </div>
            )}

            {serviceOpen === 'gunshop' && (
              <div className="border border-pip-border-dim rounded p-3 space-y-3">
                <div className="pip-label">Gun Shop</div>
                {mc.gunIds.map(gunId => {
                  const gun = mc.guns[gunId]
                  const owned = player.gun?.id === gunId
                  return (
                    <div key={gunId} className="flex justify-between items-center">
                      <div>
                        <div className="text-pip-green font-display">{gun.name}</div>
                        <div className="text-xs text-pip-green-dim">
                          Acc {Math.round(gun.accuracy * 100)}% · {gun.damage} dmg
                        </div>
                      </div>
                      <button
                        className={owned ? 'pip-btn text-xs px-2' : 'pip-btn-amber text-xs px-2'}
                        disabled={owned || player.caps < gun.price}
                        onClick={() => store.purchaseGun(gunId)}
                      >
                        {owned ? 'EQUIPPED' : `${gun.price} ¤`}
                      </button>
                    </div>
                  )
                })}
                {player.gun && (
                  <div className="border-t border-pip-border-dim pt-2">
                    <div className="pip-label">Ammo — {mc.ammoPrice} ¤/round</div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <input
                        type="number" min={1} value={ammoQty}
                        onChange={e => setAmmoQty(Math.max(1, parseInt(e.target.value) || 1))}
                        className="pip-input w-16"
                      />
                      <button
                        className="pip-btn text-sm"
                        disabled={player.caps < ammoQty * mc.ammoPrice}
                        onClick={() => store.purchaseAmmo(ammoQty)}
                      >
                        BUY {ammoQty} ({ammoQty * mc.ammoPrice} ¤)
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {serviceOpen === 'guards' && (
              <div className="border border-pip-border-dim rounded p-3 space-y-2">
                <div className="pip-label">Guards — {mc.guardCost} ¤ each</div>
                <div className="text-xs text-pip-green-dim">
                  {player.guards} current · each absorbs {mc.guardHealth} HP in combat
                </div>
                <div className="flex gap-2 flex-wrap">
                  {[1, 2, 3].map(n => (
                    <button
                      key={n}
                      className="pip-btn text-sm"
                      disabled={player.caps < n * mc.guardCost}
                      onClick={() => store.hireguards(n)}
                    >
                      HIRE {n} ({n * mc.guardCost} ¤)
                    </button>
                  ))}
                </div>
              </div>
            )}

            {serviceOpen === 'brahmin' && (
              <div className="border border-pip-border-dim rounded p-3 space-y-2">
                <div className="pip-label">Brahmin — {mc.brahminCost} ¤ each</div>
                <div className="text-xs text-pip-green-dim">
                  {player.brahmin} owned · +{mc.capacityPerBrahmin} pack capacity each
                </div>
                <div className="flex gap-2 flex-wrap">
                  {[1, 2].map(n => (
                    <button
                      key={n}
                      className="pip-btn text-sm"
                      disabled={player.caps < n * mc.brahminCost}
                      onClick={() => store.purchaseBrahmin(n)}
                    >
                      BUY {n} ({n * mc.brahminCost} ¤)
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {world.activeMarketEvents.length > 0 && (
          <div className="rounded-lg border border-pip-border p-3" style={PANEL_STYLE}>
            <div className="text-pip-amber text-xs font-display animate-pulse mb-1">
              {world.activeMarketEvents.length} MARKET EVENT{world.activeMarketEvents.length > 1 ? 'S' : ''} ACTIVE
            </div>
            {world.activeMarketEvents.map(ev => (
              <div key={ev.id} className="text-xs text-pip-green-dim">{ev.message}</div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ── Market render function ────────────────────────────────────────────

  function renderMarket() {
    if (availableChems.length === 0) {
      return (
        <div className="px-3 py-3">
          <div className="rounded-lg border border-pip-border p-6 text-center text-pip-green-dim text-sm" style={PANEL_STYLE}>
            No chems available here right now.
          </div>
        </div>
      )
    }

    return (
      <div className="px-3 py-3 space-y-2 pb-6">
        <div className="text-pip-bg-light text-xs px-1 opacity-75">
          {availableChems.length} chems · pack space: {space}/{capacity}
        </div>

        {availableChems.map(chemId => {
          const chem = CHEMS[chemId]
          const price = market.prices[chemId]
          const stock = market.stock[chemId] ?? 0
          const owned = player.inventory[chemId]?.quantity ?? 0
          const paidPrice = player.inventory[chemId]?.pricePaid ?? 0
          const pnlPerUnit = owned > 0 ? price - paidPrice : null
          const q = marketQty[chemId] ?? 1
          const canBuy = player.caps >= price * q && stock >= q && space >= q
          const maxQty = Math.min(Math.floor(player.caps / price), stock, space)
          const pStyle = priceColor(price, chem.basePrice, chem.priceVariance)

          const flash = inventoryFlashes[chemId]
          const flashVariant = flash?.direction === 'up' ? 'buy' : 'sell'

          return (
            <div
              key={chemId}
              className="rounded-lg border border-pip-border overflow-hidden relative"
              style={PANEL_STYLE}
            >
              <FlashOverlay flashKey={flash?.key ?? 0} variant={flashVariant} />
              {/* Line 1: icon + name + price */}
              <div className="flex items-center gap-2 px-3 pt-3 pb-1">
                {chem.imageUrl ? (
                  <img src={chem.imageUrl} alt={chem.name} className="w-8 h-8 object-contain flex-shrink-0" />
                ) : (
                  <div className="w-8 h-8 flex items-center justify-center text-pip-green-dim text-xs flex-shrink-0">?</div>
                )}
                <span className="font-display text-pip-green text-lg flex-1 leading-tight">{chem.name}</span>
                <span className="font-display text-base" style={pStyle}>{price} ¤</span>
              </div>

              {/* Line 2: stock / ownership info */}
              <div className="px-3 pb-1 text-xs text-pip-green-dim flex gap-2">
                <span>Stk {stock}</span>
                {owned > 0 && (
                  <span>
                    Own {owned}
                    {pnlPerUnit !== null && (
                      <span className={pnlPerUnit >= 0 ? 'text-pip-amber' : 'text-pip-red'}>
                        {' '}({pnlPerUnit >= 0 ? '+' : ''}{pnlPerUnit})
                      </span>
                    )}
                  </span>
                )}
              </div>

              {/* Line 3: ALL SELL [−][qty][+] BUY MAX — always right-aligned */}
              <div className="flex justify-end items-center gap-1 px-3 pb-3">
                <button className="pip-btn text-xs px-2 py-1" disabled={owned === 0} onClick={() => sell(chemId, owned)}>ALL</button>
                <button className="pip-btn text-xs px-3 py-1" disabled={owned < q} onClick={() => sell(chemId, q)}>SELL</button>
                <button
                  className="pip-btn text-xs px-2 py-1 leading-none"
                  onClick={() => setMarketQty(p => ({ ...p, [chemId]: Math.max(1, q - 1) }))}
                  tabIndex={-1}
                >−</button>
                <span className="text-pip-green font-display text-sm w-6 text-center select-none">{q}</span>
                <button
                  className="pip-btn text-xs px-2 py-1 leading-none"
                  onClick={() => setMarketQty(p => ({ ...p, [chemId]: q + 1 }))}
                  tabIndex={-1}
                >+</button>
                <button className="pip-btn-amber text-xs px-3 py-1" disabled={!canBuy} onClick={() => buy(chemId, q)}>BUY</button>
                <button className="pip-btn text-xs px-2 py-1" disabled={maxQty <= 0} onClick={() => buy(chemId, maxQty)}>MAX</button>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // ── Travel render function ─────────────────────────────────────────────

  function renderTravel() {
    return (
      <div className="px-3 py-3 pb-6 space-y-3">
        {/* Compact map — tap a node to fill destination detail below */}
        <div className="rounded-lg border border-pip-border overflow-hidden" style={PANEL_STYLE}>
          <SettlementMap player={player} mc={mc} onTravel={id => travelTo(id)} compact />
        </div>

        {/* Adjacent road list */}
        {roads.map(road => {
          const destId = getRoadDestination(road, player.location)
          const dest = mc.settlements[destId]
          const services = [
            dest.hasDoctor && 'Doctor',
            dest.hasBank && 'Bank',
            dest.hasLoanshark && 'Loans',
            dest.hasGunShop && 'Guns',
            dest.hasGuards && 'Guards',
          ].filter(Boolean).join(' · ')

          return (
            <div key={road.id} className="rounded-lg border border-pip-border overflow-hidden" style={PANEL_STYLE}>
              <div className="px-4 pt-3 pb-2">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-display text-pip-green text-xl">{dest.name}</div>
                    <div className="text-xs text-pip-green-dim">via {road.name}</div>
                  </div>
                  <DangerBars level={road.dangerLevel} />
                </div>
                <div className="text-xs text-pip-green-dim mt-1">{road.description}</div>
                {services && (
                  <div className="text-xs text-pip-green-dim mt-0.5">Services: {services}</div>
                )}
              </div>
              <button
                className="w-full pip-btn rounded-none border-0 border-t border-pip-border py-2.5 text-sm"
                onClick={() => travelTo(destId)}
              >
                TRAVEL
              </button>
            </div>
          )
        })}
      </div>
    )
  }

  // ── Pack render function ───────────────────────────────────────────────

  function renderPack() {
    const entries = Object.entries(player.inventory).filter(([, v]) => v.quantity > 0)

    return (
      <div className="px-3 py-3 space-y-2 pb-6">
        <div className="text-pip-bg-light text-xs px-1 opacity-75">
          Pack: {used}/{capacity} units
        </div>

        {entries.length === 0 ? (
          <div className="rounded-lg border border-pip-border p-6 text-center text-pip-green-dim text-sm" style={PANEL_STYLE}>
            Nothing in your pack.
          </div>
        ) : (
          entries.map(([chemId, entry]) => {
            const chem = CHEMS[chemId]
            const marketPrice = market.prices[chemId]
            const pnl = marketPrice ? (marketPrice - entry.pricePaid) * entry.quantity : null
            const pnlColor = pnl === null ? 'text-pip-green-dim' : pnl >= 0 ? 'text-pip-amber' : 'text-pip-red'
            const flash = inventoryFlashes[chemId]
            const variant = flash?.direction === 'up' ? 'buy' : 'sell'

            return (
              <div
                key={chemId}
                className="rounded-lg border border-pip-border overflow-hidden relative"
                style={PANEL_STYLE}
              >
                <FlashOverlay flashKey={flash?.key ?? 0} variant={variant} />
                <div className="flex gap-3 p-3 items-center">
                  {chem?.imageUrl && (
                    <img src={chem.imageUrl} alt={chem.name} className="w-10 h-10 object-contain flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline">
                      <span className="text-pip-green font-display text-base">{chem?.name ?? chemId}</span>
                      <span className="text-pip-green font-display ml-2">×{entry.quantity}</span>
                    </div>
                    <div className="text-xs text-pip-green-dim">Paid {entry.pricePaid} ¤/unit</div>
                    {marketPrice && (
                      <div className="text-xs flex justify-between mt-0.5">
                        <span className="text-pip-green-dim">Market {marketPrice} ¤</span>
                        <span className={pnlColor}>{pnl! >= 0 ? '+' : ''}{pnl} ¤ total</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    )
  }

  // ── Log render function ────────────────────────────────────────────────

  function renderLog() {
    const displayed = [...log].reverse().slice(0, 80)
    return (
      <div className="px-3 py-3 pb-6">
        <div className="rounded-lg border border-pip-border p-3" style={PANEL_STYLE}>
          <div className="pip-section-title text-base mb-2">Journal</div>
          <div className="space-y-1 text-xs font-mono">
            {displayed.map((entry, i) => (
              <div key={i} className={`log-${entry.type}`}>
                <span className="text-pip-green-dim">[T{String(entry.turn).padStart(2, '0')}]</span>{' '}
                {entry.message}
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ── Main render ────────────────────────────────────────────────────────

  const TABS: { id: MobileTab; label: string }[] = [
    { id: 'stats',  label: 'STATS'  },
    { id: 'market', label: 'MARKET' },
    { id: 'travel', label: 'TRAVEL' },
    { id: 'pack',   label: 'PACK'   },
    { id: 'log',    label: 'LOG'    },
  ]

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-pip-bg" data-mode={gameState.mode}>
      {/* Background settlement image — hidden during travel/combat/events */}
      {!isActionBlocked && settlement.imageUrl && (
        <img
          src={settlement.imageUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          style={{ opacity: 0.48 }}
        />
      )}

      {/* Bottom gradient */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'linear-gradient(to bottom, color-mix(in srgb, var(--pip-bg) 35%, transparent) 0%, color-mix(in srgb, var(--pip-bg) 5%, transparent) 30%, color-mix(in srgb, var(--pip-bg) 5%, transparent) 70%, color-mix(in srgb, var(--pip-bg) 70%, transparent) 100%)' }}
      />

      {/* Toast */}
      {toast && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 bg-pip-red text-pip-bg font-display text-base px-5 py-2 rounded border border-pip-red shadow-lg">
          {toast}
        </div>
      )}

      {/* Action overlays: combat / event / travel — no tab bar */}
      {isActionBlocked && (
        <div className="relative flex-1 overflow-y-auto">
          <div className="min-h-full p-4">
            <div className="rounded-lg border border-pip-border p-4" style={PANEL_STYLE}>
              {phase === 'traveling' && pendingDestination && (
                <TravelSplash quote={pendingQuote} destination={pendingDestination} />
              )}
              {phase === 'combat' && combat && (
                <CombatPanel player={player} combat={combat} />
              )}
              {phase === 'combat_summary' && combat && (
                <CombatSummaryPanel combat={combat} />
              )}
              {phase === 'event' && pendingEvent && (
                <EventPanel event={pendingEvent} player={player} />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Normal settlement view */}
      {!isActionBlocked && (
        <>
          {/* Settlement header strip */}
          <div
            className="relative flex-shrink-0 px-4 py-2.5 border-b border-pip-border flex items-center justify-between"
            style={{ backgroundColor: 'color-mix(in srgb, var(--pip-bg-light) 92%, transparent)' }}
          >
            <div>
              <span className="font-display text-pip-green text-lg leading-tight">{settlement.name}</span>
              <span className="text-pip-green-dim text-xs ml-2">{settlement.faction}</span>
            </div>
            <div className="flex items-center gap-2">
              <FlashText flashKey={capsFlash} variant={capsDir === 'up' ? 'green' : 'amber'} className="font-display text-pip-amber text-sm">
                {player.caps.toLocaleString()} ¤
              </FlashText>
              <button className="pip-btn text-xs px-2 py-1" onClick={() => navigate('/')}>MENU</button>
            </div>
          </div>

          {/* Scrollable content — padded to clear tab bar */}
          <div className="relative flex-1 overflow-y-auto" style={{ paddingBottom: '56px' }}>
            {tab === 'stats'  && renderStats()}
            {tab === 'market' && renderMarket()}
            {tab === 'travel' && renderTravel()}
            {tab === 'pack'   && renderPack()}
            {tab === 'log'    && renderLog()}
          </div>

          {/* Bottom tab bar */}
          <div
            className="absolute bottom-0 left-0 right-0 flex border-t border-pip-border"
            style={{ height: '56px', backgroundColor: 'color-mix(in srgb, var(--pip-bg) 97%, transparent)' }}
          >
            {TABS.map(t => (
              <button
                key={t.id}
                className="flex-1 flex flex-col items-center justify-center relative"
                onClick={() => setTab(t.id)}
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                <div
                  className="absolute top-0 left-2 right-2 h-0.5 transition-all duration-150"
                  style={{ backgroundColor: tab === t.id ? 'var(--pip-amber)' : 'transparent' }}
                />
                <span
                  className="font-display text-xs tracking-widest transition-colors duration-100"
                  style={{ color: tab === t.id ? 'var(--pip-bg-light)' : 'color-mix(in srgb, var(--pip-bg-light) 55%, transparent)' }}
                >
                  {t.label}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
