import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGameStore } from '../../store/gameStore'
import { GAME_MODES } from '../../data/modes'
import { CHEMS, CHEM_IDS } from '../../data/chems'
import { applyMarketEvents, RECOVERY_TURNS_TO_FULL } from '../../engine/market'
import { getAdjacentRoads, getRoadDestination, calculateCapacity, totalInventoryItems } from '../../engine/travel'
import { inventoryBaseValue, totalGuardSalary } from '../../engine/economy'
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
import DebtFreedomModal from './DebtFreedomModal'
import SettlementDiscoverySplash from './SettlementDiscoverySplash'
import AchievementToast from './AchievementToast'
import AchievementsGrid from './AchievementsGrid'
import RunStatsView from './RunStatsView'
import { CapsIcon } from '../ui/CapsIcon'
import { DoctorPanel } from './service-panels/DoctorPanel'
import { LoansharkPanel } from './service-panels/LoansharkPanel'
import { ArmoryPanel } from './service-panels/ArmoryPanel'
import { FollowersPanel } from './service-panels/FollowersPanel'
import { VERSION_STRING, DEPLOY_CONTEXT } from '../../version'

type MobileTab = 'player' | 'market' | 'travel' | 'settlement' | 'dossier'

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

  const store = useGameStore()
  const { gameState, buy, sell, travelTo, toast, dismissDebtFreedom, dismissDiscovery } = store

  const phase    = gameState?.phase ?? null
  const location = gameState?.player.location ?? null

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
  const { player, world, pendingEvent, pendingQuote, pendingDestination, combat, log, gameType } = gameState
  const settlement = mc.settlements[player.location]
  const rawMarket = world.settlements[player.location]
  const market = rawMarket
    ? applyMarketEvents(rawMarket, world.activeMarketEvents, player.location)
    : { prices: {}, stock: {}, lastRefreshed: 0, depletion: {} }

  const isActionBlocked = phase === 'event' || phase === 'combat' || phase === 'combat_summary' || phase === 'traveling'

  const capacity = calculateCapacity(player.brahmin)
  const used = totalInventoryItems(player.inventory)
  const space = capacity - used
  const availableChems = CHEM_IDS.filter(id => market.prices[id])
  const roads = getAdjacentRoads(mc, player.location)

  // ── Player tab ─────────────────────────────────────────────────────────

  function renderPlayer() {
    const hpPct = Math.max(0, Math.round((player.health / player.maxHealth) * 100))
    const hpColor = hpPct > 60 ? 'bg-pip-green' : hpPct > 30 ? 'bg-pip-amber' : 'bg-pip-red'
    const debtColor = player.debt > 0
      ? (player.ageOfDebt >= 10 ? 'text-pip-red' : player.ageOfDebt >= 5 ? 'text-pip-amber' : 'text-pip-green')
      : 'text-pip-green-dim'

    const packEntries = Object.entries(player.inventory).filter(([, v]) => v.quantity > 0)

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

          {player.armor && (() => {
            const apPct = Math.max(0, Math.round((player.armor.armorPoints / player.armor.maxArmorPoints) * 100))
            return (
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="pip-label">Armor</span>
                  <span className="text-xs text-pip-blue">{player.armor.armorPoints} / {player.armor.maxArmorPoints} AP</span>
                </div>
                <div className="h-3 bg-pip-border-dim rounded overflow-hidden">
                  <div className="h-full bg-pip-blue transition-all duration-300" style={{ width: `${apPct}%` }} />
                </div>
              </div>
            )
          })()}

          {player.mount && (() => {
            const mountHpPct = Math.max(0, Math.round((player.mount.health / player.mount.maxHealth) * 100))
            const mountHpColor = mountHpPct > 60 ? 'bg-pip-green' : mountHpPct > 30 ? 'bg-pip-amber' : 'bg-pip-red'
            return (
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="pip-label">Mount — {player.mount.name}</span>
                  <span className="text-xs text-pip-amber">{player.mount.health} / {player.mount.maxHealth} HP</span>
                </div>
                <div className="h-3 bg-pip-border-dim rounded overflow-hidden">
                  <div className={`h-full ${mountHpColor} transition-all duration-300`} style={{ width: `${mountHpPct}%` }} />
                </div>
              </div>
            )
          })()}

          {player.conditions?.some(c => c.type === 'radscorpion_venom') && (
            <div className="border border-red-500 px-2 py-1.5 rounded text-xs space-y-1.5">
              <div className="text-red-400 font-bold">SCORPION VENOM — -5 HP per travel turn</div>
              {(player.inventory['antivenom']?.quantity ?? 0) > 0 ? (
                <button className="pip-btn w-full text-xs py-0.5" onClick={() => store.useAntivenom()}>
                  USE ANTIVENOM (have {player.inventory['antivenom']!.quantity})
                </button>
              ) : (
                <div className="text-pip-green-dim">Buy antivenom at a doctor to cure.</div>
              )}
            </div>
          )}
          {player.conditions?.some(c => c.type === 'cazador_venom') && (
            <div className="border border-red-500 px-2 py-1.5 rounded text-xs space-y-1.5">
              <div className="text-red-400 font-bold">CAZADOR VENOM — -10 HP per travel turn</div>
              {(player.inventory['antivenom']?.quantity ?? 0) > 0 ? (
                <button className="pip-btn w-full text-xs py-0.5" onClick={() => store.useAntivenom()}>
                  USE ANTIVENOM (have {player.inventory['antivenom']!.quantity})
                </button>
              ) : (
                <div className="text-pip-green-dim">Buy antivenom at a doctor to cure.</div>
              )}
            </div>
          )}

          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="pip-label">Turn</span>
              <span className="text-xs text-pip-green-dim">
                {world.turn}{world.maxTurns !== null ? ` / ${world.maxTurns}` : ' ∞'}
              </span>
            </div>
            {world.maxTurns !== null && (
              <div className="h-2 bg-pip-border-dim rounded overflow-hidden">
                <div
                  className="h-full bg-pip-amber transition-all duration-300"
                  style={{ width: `${(world.turn / world.maxTurns) * 100}%` }}
                />
              </div>
            )}
          </div>

          <div className="flex justify-between items-center">
            <span className="pip-label">XP</span>
            <span className="font-display text-pip-blue">{(player.xp ?? 0).toLocaleString()}</span>
          </div>
        </div>

        {/* Finances */}
        <div className="rounded-lg border border-pip-border p-4" style={PANEL_STYLE}>
          <div className="pip-label mb-2">Finances</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="pip-label">Caps on hand</div>
              <div className="font-display text-pip-blue text-xl">
                <FlashText flashKey={capsFlash} variant={capsDir === 'up' ? 'green' : 'amber'} className="text-pip-blue">
                  {player.caps.toLocaleString()} <CapsIcon size={16} />
                </FlashText>
              </div>
            </div>
            <div>
              <div className="pip-label">Debt</div>
              <div className={`font-display text-xl ${debtColor}`}>
                {player.debt > 0 ? <>{player.debt.toLocaleString()} <CapsIcon size={16} /></> : 'CLEAR'}
              </div>
              {player.debt > 0 && player.ageOfDebt > 0 && (
                <div className="text-xs text-pip-green-dim">Age: {player.ageOfDebt}t</div>
              )}
            </div>
            <div className="col-span-2">
              <div className="pip-label">Followers</div>
              <div className="text-pip-green text-sm font-display">
                {player.guards.filter(g => !g.dead).length} guards{player.paGuards.filter(g => !g.dead).length > 0 ? ` · ${player.paGuards.filter(g => !g.dead).length} PA` : ''} · {player.brahmin} brahmin
              </div>
              {(() => {
                const mc = GAME_MODES[gameState!.mode]
                const salary = totalGuardSalary(player, mc)
                const turnsCovered = salary > 0 ? Math.floor(player.caps / salary) : 0
                if (salary === 0) return null
                const salaryColor = turnsCovered < 2 ? 'text-pip-red' : turnsCovered < 4 ? 'text-pip-amber' : 'text-pip-green-dim'
                return (
                  <div className="mt-1.5">
                    <div className="pip-label text-[10px]">Payroll</div>
                    <div className={`font-display text-base ${salaryColor}`}>
                      {salary} ¤/turn
                      <span className={`font-mono text-xs ml-2 ${salaryColor}`}>~{turnsCovered}t covered</span>
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>
          {Object.keys(player.ownedGuns ?? {}).length > 0 && (
            <div className="mt-3 pt-3 border-t border-pip-border-dim space-y-1.5">
              <div className="pip-label">Weapons</div>
              {Object.values(player.ownedGuns).map(g => {
                const equipped = player.gun?.id === g.id
                const ammo = equipped ? player.gun!.ammo : g.ammo
                return (
                  <div key={g.id} className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-pip-green text-sm font-display">{g.name}</div>
                      <div className="text-xs text-pip-green-dim">{ammo} rds · {Math.round(g.accuracy * 100)}% acc · {g.damage} dmg</div>
                    </div>
                    {equipped ? (
                      <span className="text-xs text-pip-green-dim">EQUIPPED</span>
                    ) : phase === 'settlement' ? (
                      <button className="pip-btn text-xs py-0.5" onClick={() => store.equipGun(g.id)}>EQUIP</button>
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Retire — free play only */}
        {gameType === 'free_play' && (
          <div className="rounded-lg border border-pip-border p-4" style={PANEL_STYLE}>
            <div className="pip-label mb-2">End Run</div>
            <button className="pip-btn-amber w-full" onClick={() => store.retire()}>RETIRE</button>
          </div>
        )}

        {/* Pack inventory */}
        <div className="rounded-lg border border-pip-border p-4 space-y-2" style={PANEL_STYLE}>
          <div className="flex items-baseline justify-between mb-1">
            <div className={`pip-label ${used >= capacity ? 'text-pip-red' : ''}`}>
              Pack —{' '}
              <span className={used >= capacity ? 'text-pip-red' : ''}>{used}/{capacity}</span>
              {' '}units
            </div>
            {(() => {
              const packValue = inventoryBaseValue(player.inventory)
              return packValue > 0 ? (
                <span className="text-xs text-pip-blue flex items-center gap-0.5">
                  Pack value <span className="ml-0.5">{packValue.toLocaleString()}</span> <CapsIcon size={11} />
                </span>
              ) : null
            })()}
          </div>

          {packEntries.length === 0 ? (
            <div className="text-pip-green-dim text-sm">Nothing in your pack.</div>
          ) : (
            packEntries.map(([chemId, entry]) => {
              const chem = CHEMS[chemId]
              const marketPrice = market.prices[chemId]
              const pnl = marketPrice ? (marketPrice - entry.pricePaid) * entry.quantity : null
              const pnlColor = pnl === null ? 'text-pip-green-dim' : pnl >= 0 ? 'text-pip-amber' : 'text-pip-red'
              const flash = inventoryFlashes[chemId]
              const variant = flash?.direction === 'up' ? 'buy' : 'sell'

              return (
                <div
                  key={chemId}
                  className="rounded border border-pip-border-dim overflow-hidden relative"
                >
                  <FlashOverlay flashKey={flash?.key ?? 0} variant={variant} />
                  <div className="flex gap-3 p-2 items-center">
                    {chem?.imageUrl && (
                      <img src={chem.imageUrl} alt={chem.name} className="w-8 h-8 object-contain flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline">
                        <span className="text-pip-green font-display text-sm">{chem?.name ?? chemId}</span>
                        <span className="text-pip-green font-display ml-2">×{entry.quantity}</span>
                      </div>
                      <div className="text-xs text-pip-green-dim">Paid {entry.pricePaid} ¤/unit</div>
                      {marketPrice && (
                        <div className="text-xs flex justify-between mt-0.5">
                          <span className="text-pip-green-dim">Market {marketPrice} ¤</span>
                          <span className={pnlColor}>{pnl! >= 0 ? '+' : ''}{pnl} ¤</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Build stamp — confirms a fresh deploy without checking Netlify's dashboard */}
        <div className="text-center text-[10px] font-mono text-pip-green-dim opacity-50" title={`Deploy context: ${DEPLOY_CONTEXT}`}>
          {VERSION_STRING}
        </div>
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
          const depletion = market.depletion?.[chemId] ?? 0
          const recoverTurns = depletion > 0 ? Math.ceil(depletion / (chem.maxStock / RECOVERY_TURNS_TO_FULL)) : 0
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
              style={{ backgroundColor: 'color-mix(in srgb, var(--pip-bg-light) 98%, transparent)' }}
            >
              <FlashOverlay flashKey={flash?.key ?? 0} variant={flashVariant} />
              <div className="flex items-center gap-2 px-3 pt-3 pb-1">
                {chem.imageUrl ? (
                  <img src={chem.imageUrl} alt={chem.name} className="w-8 h-8 object-contain flex-shrink-0" />
                ) : (
                  <div className="w-8 h-8 flex items-center justify-center text-pip-green-dim text-xs flex-shrink-0">?</div>
                )}
                <span className="font-display text-pip-green text-lg flex-1 leading-tight">{chem.name}</span>
                <span className="font-display text-base" style={pStyle}>{price} <CapsIcon size={13} /></span>
              </div>

              <div className="px-3 pb-1 text-xs text-pip-green-dim flex gap-2">
                <span>Stk {stock}{recoverTurns > 0 && <span className="text-pip-amber opacity-70"> (recovering ~{recoverTurns}t)</span>}</span>
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
        <div className="rounded-lg border border-pip-border overflow-hidden" style={PANEL_STYLE}>
          <SettlementMap player={player} mc={mc} onTravel={id => travelTo(id)} compact />
        </div>

        {roads.map(road => {
          const destId = getRoadDestination(road, player.location)
          const dest = mc.settlements[destId]
          const services = [
            dest.hasDoctor && 'Doctor',
            dest.hasLoanshark && 'Loans',
            dest.hasArmory && 'Armory',
            dest.hasFollowers && 'Followers',
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

  // ── Settlement render function ─────────────────────────────────────────

  function renderSettlement() {
    const servicesTabs = [
      { key: 'doctor',    icon: '/assets/icons/bandage-svgrepo-com.svg',          label: 'DOCTOR',    avail: settlement.hasDoctor },
      { key: 'loanshark', icon: '/assets/icons/briefcase-dollar-svgrepo-com.svg', label: 'LOANS',     avail: settlement.hasLoanshark },
      { key: 'armory',    icon: '/assets/icons/crosshair-svgrepo-com.svg',        label: 'ARMORY',    avail: settlement.hasArmory },
      { key: 'followers', icon: '/assets/icons/followers-svgrepo-com.svg',        label: 'FOLLOWERS', avail: settlement.hasFollowers },
    ].filter(t => t.avail)

    return (
      <div className="px-3 py-3 space-y-3 pb-6">
        {servicesTabs.length > 0 && (
          <div className="rounded-lg border border-pip-border p-4 space-y-3" style={PANEL_STYLE}>
            <div className="pip-label">Services at {settlement.name}</div>
            <div className="flex flex-wrap gap-2">
              {servicesTabs.map(t => (
                <button
                  key={t.key}
                  className={serviceOpen === t.key
                    ? 'pip-btn bg-pip-green text-pip-bg-light text-sm px-3 py-1.5 flex items-center gap-1.5'
                    : 'pip-btn text-sm px-3 py-1.5 flex items-center gap-1.5'}
                  onClick={() => setServiceOpen(serviceOpen === t.key ? null : t.key)}
                >
                  <img src={t.icon} alt="" width={14} height={14} style={{ opacity: 0.75 }} />
                  {t.label}
                </button>
              ))}
            </div>

            {serviceOpen === 'doctor' && <DoctorPanel player={player} />}

            {serviceOpen === 'loanshark' && <LoansharkPanel player={player} />}

            {serviceOpen === 'armory' && <ArmoryPanel player={player} />}

            {serviceOpen === 'followers' && <FollowersPanel player={player} />}
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

        {servicesTabs.length === 0 && world.activeMarketEvents.length === 0 && (
          <div className="rounded-lg border border-pip-border p-6 text-center text-pip-green-dim text-sm" style={PANEL_STYLE}>
            No services available here.
          </div>
        )}
      </div>
    )
  }

  // ── Dossier render function ───────────────────────────────────────────

  function renderDossier() {
    const displayed = [...log].reverse().slice(0, 80)
    return (
      <div className="px-3 py-3 pb-6 space-y-4">
        {/* Achievements */}
        <div className="rounded-lg border border-pip-border p-3" style={PANEL_STYLE}>
          <AchievementsGrid
            earnedAchievements={gameState!.earnedAchievements}
            mode={gameState!.mode}
          />
        </div>

        {/* Stats */}
        <div className="rounded-lg border border-pip-border p-3" style={PANEL_STYLE}>
          <div className="pip-section-title text-base mb-2">Run Stats</div>
          <RunStatsView stats={gameState!.stats} mc={mc} />
        </div>

        {/* Journal */}
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
    { id: 'player',     label: 'PLAYER'     },
    { id: 'market',     label: 'MARKET'     },
    { id: 'travel',     label: 'TRAVEL'     },
    { id: 'settlement', label: 'SETTLEMENT' },
    { id: 'dossier',    label: 'DOSSIER'    },
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
              <FlashText flashKey={capsFlash} variant={capsDir === 'up' ? 'green' : 'amber'} className="font-display text-pip-blue text-sm">
                {player.caps.toLocaleString()} <CapsIcon size={13} />
              </FlashText>
              <button className="pip-btn text-xs px-2 py-1" onClick={() => navigate('/')}>MENU</button>
            </div>
          </div>

          {/* Scrollable content — padded to clear tab bar */}
          <div className="relative flex-1 overflow-y-auto" style={{ paddingBottom: '56px' }}>
            {tab === 'player'     && renderPlayer()}
            {tab === 'market'     && renderMarket()}
            {tab === 'travel'     && renderTravel()}
            {tab === 'settlement' && renderSettlement()}
            {tab === 'dossier'    && renderDossier()}
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
                  className="font-display tracking-wide transition-colors duration-100"
                  style={{
                    fontSize: '0.68rem',
                    color: tab === t.id ? 'var(--pip-bg-light)' : 'color-mix(in srgb, var(--pip-bg-light) 72%, transparent)',
                  }}
                >
                  {t.label}
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Achievement toast */}
      <AchievementToast onOpenDossier={() => setTab('dossier')} />

      {/* Celebration overlays */}
      {gameState.pendingDebtFreedom != null && (
        <DebtFreedomModal xpGained={gameState.pendingDebtFreedom} onDismiss={dismissDebtFreedom} />
      )}
      {gameState.pendingDiscovery && (
        <SettlementDiscoverySplash
          settlement={mc.settlements[gameState.pendingDiscovery.settlementId]}
          xpGained={gameState.pendingDiscovery.xpGained}
          onDismiss={dismissDiscovery}
        />
      )}
    </div>
  )
}
