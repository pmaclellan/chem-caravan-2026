import { useState } from 'react'
import type { PlayerState } from '../../types/game'
import { GAME_MODES } from '../../data/modes'
import { useGameStore } from '../../store/gameStore'
import { TAMING_TOOLS, TAMING_TOOL_IDS, SADDLE_PRICE } from '../../data/mounts'

interface Props { player: PlayerState }

type Tab = 'doctor' | 'loanshark' | 'armory' | 'followers'

export default function ServicesPanel({ player }: Props) {
  const mode = useGameStore(s => s.gameState?.mode ?? 'commonwealth')
  const mc = GAME_MODES[mode]
  const settlement = mc.settlements[player.location]
  const [activeTab, setActiveTab] = useState<Tab | null>(null)
  const [amount, setAmount] = useState(100)
  const [ammoQty, setAmmoQty] = useState(10)
  const store = useGameStore()

  const tabs: { key: Tab; icon: string; label: string; available: boolean }[] = (
    [
      { key: 'doctor',    icon: '/assets/icons/bandage-svgrepo-com.svg',          label: 'DOCTOR',    available: settlement.hasDoctor },
      { key: 'loanshark', icon: '/assets/icons/briefcase-dollar-svgrepo-com.svg', label: 'LOANS',     available: settlement.hasLoanshark },
      { key: 'armory',    icon: '/assets/icons/crosshair-svgrepo-com.svg',        label: 'ARMORY',    available: settlement.hasArmory },
      { key: 'followers', icon: '/assets/icons/followers-svgrepo-com.svg',        label: 'FOLLOWERS', available: settlement.hasFollowers },
    ] as { key: Tab; icon: string; label: string; available: boolean }[]
  ).filter(t => t.available)

  if (tabs.length === 0) {
    return <div className="text-pip-green-dim text-sm">No services available here.</div>
  }

  const interestPct = Math.round(mc.interestRate * 100 * 10) / 10

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {tabs.map(tab => (
          <button
            key={tab.key}
            className={activeTab === tab.key ? 'pip-btn bg-pip-green text-pip-bg flex items-center gap-1.5' : 'pip-btn flex items-center gap-1.5'}
            onClick={() => setActiveTab(activeTab === tab.key ? null : tab.key)}
          >
            <img src={tab.icon} alt="" style={{ height: '1.25em', width: '1.25em', display: 'block', opacity: 0.75 }} />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'doctor' && (
        <div className="border border-pip-border p-3 rounded space-y-2">
          <div className="pip-label">DOCTOR — {settlement.doctorCost} ¤ to fully heal</div>
          <div className="text-xs text-pip-green-dim">Current HP: {player.health} / {player.maxHealth}</div>
          <button
            className="pip-btn w-full"
            disabled={player.health >= player.maxHealth || player.caps < settlement.doctorCost}
            onClick={() => store.heal()}
          >
            HEAL ({settlement.doctorCost} ¤)
          </button>
          {player.mount && (() => {
            const mountHealCost = settlement.doctorCost * 2
            return (
              <button
                className="pip-btn w-full"
                disabled={player.mount.health >= player.mount.maxHealth || player.caps < mountHealCost}
                onClick={() => store.healMount()}
              >
                HEAL MOUNT — {player.mount.name} ({player.mount.health}/{player.mount.maxHealth} HP) · {mountHealCost} ¤
              </button>
            )
          })()}
        </div>
      )}

      {activeTab === 'loanshark' && (() => {
        const isOverGrace = player.ageOfDebt >= mc.debtGracePeriod
        const windowStartAge   = player.debtWindowStartAge ?? player.ageOfDebt
        const turnsElapsed     = player.ageOfDebt - windowStartAge
        const turnsLeft        = Math.max(0, mc.debtWindowSize - turnsElapsed)
        const minWindowPayment = Math.ceil(player.debt * mc.debtMinPaymentRate)
        const windowPaid       = player.debtWindowCapsPaid ?? 0
        const stillOwed        = Math.max(0, minWindowPayment - windowPaid)
        const windowOverdue    = turnsElapsed >= mc.debtWindowSize
        const windowSatisfied  = windowPaid >= minWindowPayment

        return (
          <div className="border border-pip-border p-3 rounded space-y-3">
            <div className="pip-label">LOANSHARK — {interestPct}% interest per turn</div>
            <div className="text-xs text-pip-red">Current debt: {player.debt} ¤</div>

            {player.debt > 0 && isOverGrace && (
              <div className={`text-xs rounded p-2 border ${windowOverdue && !windowSatisfied ? 'border-pip-red text-pip-red' : 'border-pip-border text-pip-green-dim'}`}>
                {windowSatisfied
                  ? `Paid up this window. Next payment due in ${turnsLeft} turn${turnsLeft !== 1 ? 's' : ''}.`
                  : windowOverdue
                    ? `OVERDUE — pay ${stillOwed} ¤ now to keep them off your back.`
                    : `Pay ${stillOwed} ¤ within ${turnsLeft} turn${turnsLeft !== 1 ? 's' : ''} to stay safe.`}
                {!windowSatisfied && windowPaid > 0 && (
                  <span className="text-pip-green-dim"> ({windowPaid} ¤ paid so far this window)</span>
                )}
              </div>
            )}

            <div className="flex items-center gap-2">
              <input type="number" min={100} step={100} value={amount} onChange={e => setAmount(Math.max(100, parseInt(e.target.value) || 100))} className="pip-input w-24" />
              <button className="pip-btn-danger" onClick={() => store.borrow(amount)}>BORROW ({amount} ¤)</button>
            </div>
            {player.debt > 0 && (
              <div className="flex gap-2 mt-1">
                <button className="pip-btn" disabled={player.caps < Math.min(amount, player.debt)} onClick={() => store.payDebt(amount)}>
                  REPAY {Math.min(amount, player.debt)} ¤
                </button>
              </div>
            )}
          </div>
        )
      })()}

      {activeTab === 'armory' && (
        <div className="border border-pip-border p-3 rounded space-y-3">
          <div className="pip-label">ARMORY</div>

          {/* Guns */}
          {mc.gunIds.map(gunId => {
            const gun = mc.guns[gunId]
            const owned = player.gun?.id === gunId
            return (
              <div key={gunId} className="flex justify-between items-center">
                <div>
                  <div className="text-pip-green text-sm">{gun.name}</div>
                  <div className="text-xs text-pip-green-dim">Acc {Math.round(gun.accuracy * 100)}% · {gun.damage} dmg</div>
                </div>
                <button
                  className={owned ? 'pip-btn text-xs' : 'pip-btn-amber text-xs'}
                  disabled={owned || player.caps < gun.price}
                  onClick={() => store.purchaseGun(gunId)}
                >
                  {owned ? 'EQUIPPED' : `${gun.price} ¤`}
                </button>
              </div>
            )
          })}

          {/* Ammo */}
          {player.gun && (
            <div className="border-t border-pip-border pt-2">
              <div className="flex items-baseline justify-between">
                <div className="pip-label">AMMO — {mc.ammoPrice} ¤/round</div>
                <div className="text-xs text-pip-green-dim">{player.gun.ammo} rounds loaded</div>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <input type="number" min={1} value={ammoQty} onChange={e => setAmmoQty(Math.max(1, parseInt(e.target.value) || 1))} className="pip-input w-16" />
                <button className="pip-btn" disabled={player.caps < ammoQty * mc.ammoPrice} onClick={() => store.purchaseAmmo(ammoQty)}>
                  BUY {ammoQty} ROUNDS ({ammoQty * mc.ammoPrice} ¤)
                </button>
              </div>
            </div>
          )}

          {/* Armor */}
          <div className="border-t border-pip-border pt-2 space-y-2">
            <div className="pip-label">ARMOR</div>
            {mc.armorIds.map(armorId => {
              const armor = mc.armors[armorId]
              const equipped = player.armor?.id === armorId
              return (
                <div key={armorId} className="flex justify-between items-center">
                  <div>
                    <div className="text-pip-green text-sm">{armor.name}</div>
                    <div className="text-xs text-pip-green-dim">{armor.armorPoints} AP · {armor.repairCostPerAP} ¤/AP repair</div>
                  </div>
                  <button
                    className={equipped ? 'pip-btn text-xs' : 'pip-btn-amber text-xs'}
                    disabled={equipped || player.caps < armor.price}
                    onClick={() => store.purchaseArmor(armorId)}
                  >
                    {equipped ? 'EQUIPPED' : `${armor.price} ¤`}
                  </button>
                </div>
              )
            })}

            {/* Repair */}
            {player.armor && player.armor.armorPoints < player.armor.maxArmorPoints && (() => {
              const missingAP = player.armor.maxArmorPoints - player.armor.armorPoints
              const repairCost = missingAP * player.armor.repairCostPerAP
              return (
                <div className="border border-pip-blue rounded p-2 space-y-1">
                  <div className="text-xs text-pip-blue">
                    {player.armor.name}: {player.armor.armorPoints} / {player.armor.maxArmorPoints} AP
                  </div>
                  <button
                    className="pip-btn w-full text-xs"
                    disabled={player.caps < repairCost}
                    onClick={() => store.repairArmor()}
                  >
                    REPAIR ({repairCost} ¤)
                  </button>
                </div>
              )
            })()}

            {/* Taming gear */}
            <div className="border-t border-pip-border pt-3 space-y-3">
              <div className="pip-label">TAMING GEAR</div>
              <div className="text-xs text-pip-green-dim">
                Corner a creature in combat (≤30% HP) to attempt taming. Requires saddle + taming tool.
              </div>

              {/* Saddle */}
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-pip-green text-sm">Leather Saddle</div>
                  <div className="text-xs text-pip-green-dim">Required to ride — permanent</div>
                </div>
                <button
                  className={player.hasSaddle ? 'pip-btn text-xs' : 'pip-btn-amber text-xs'}
                  disabled={player.hasSaddle || player.caps < SADDLE_PRICE}
                  onClick={() => store.purchaseSaddle()}
                >
                  {player.hasSaddle ? 'OWNED' : `${SADDLE_PRICE} ¤`}
                </button>
              </div>

              {/* Taming tools */}
              {TAMING_TOOL_IDS.map(toolId => {
                const tool    = TAMING_TOOLS[toolId]
                const equipped = player.tamingTool?.id === toolId
                const windowPct = Math.round(tool.greenWindowFraction * 100)
                const speedLabel = tool.cursorSpeedMultiplier > 1 ? 'fast' : tool.cursorSpeedMultiplier < 1 ? 'slow' : 'normal'
                return (
                  <div key={toolId} className="flex justify-between items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-pip-green text-sm">{tool.name}</div>
                      <div className="text-xs text-pip-green-dim truncate">
                        {windowPct}% window · {speedLabel} cursor
                      </div>
                    </div>
                    <button
                      className={equipped ? 'pip-btn text-xs flex-shrink-0' : 'pip-btn-amber text-xs flex-shrink-0'}
                      disabled={equipped || player.caps < tool.price}
                      onClick={() => store.purchaseTamingTool(toolId)}
                    >
                      {equipped ? 'EQUIPPED' : `${tool.price} ¤`}
                    </button>
                  </div>
                )
              })}

              {/* Current mount status */}
              {player.mount && (
                <div className="border border-pip-amber rounded p-2 space-y-0.5">
                  <div className="text-xs text-pip-amber font-display">MOUNT: {player.mount.name}</div>
                  <div className="text-xs text-pip-green-dim">
                    {player.mount.health}/{player.mount.maxHealth} HP · DMG {player.mount.damage[0]}–{player.mount.damage[1]} · {Math.round(player.mount.accuracy * 100)}% acc
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'followers' && (
        <div className="border border-pip-border p-3 rounded space-y-4">
          <div className="space-y-2">
            <div className="pip-label">GUARDS — {mc.guardCost} ¤ each</div>
            <div className="text-xs text-pip-green-dim">
              {player.guards} / {mc.maxGuards} · Each absorbs {mc.guardHealth} HP in combat and improves escape chance.
            </div>
            <div className="flex gap-2 mt-1 flex-wrap">
              {[1, 2, 3].map(n => {
                const atCap = player.guards >= mc.maxGuards
                return (
                  <button
                    key={n}
                    className="pip-btn"
                    disabled={atCap || player.caps < n * mc.guardCost}
                    onClick={() => store.hireguards(n)}
                  >
                    HIRE {n} ({n * mc.guardCost} ¤)
                  </button>
                )
              })}
            </div>
            {player.guards >= mc.maxGuards && (
              <div className="text-xs text-pip-green-dim">Guard roster is full.</div>
            )}
          </div>

          <div className="border-t border-pip-border-dim pt-3 space-y-2">
            <div className="pip-label">POWER ARMOR GUARDS — {mc.powerArmorGuardCost} ¤ each</div>
            <div className="text-xs text-pip-green-dim">
              {player.powerArmorGuards ?? 0} / {mc.maxPowerArmorGuards} · Each absorbs {mc.powerArmorGuardHealth} HP — fires as a regular guard.
            </div>
            <div className="flex gap-2 mt-1 flex-wrap">
              {[1, 2].map(n => {
                const atCap = (player.powerArmorGuards ?? 0) >= mc.maxPowerArmorGuards
                return (
                  <button
                    key={n}
                    className="pip-btn-amber"
                    disabled={atCap || player.caps < n * mc.powerArmorGuardCost}
                    onClick={() => store.purchasePowerArmorGuard(n)}
                  >
                    HIRE {n} ({n * mc.powerArmorGuardCost} ¤)
                  </button>
                )
              })}
            </div>
            {(player.powerArmorGuards ?? 0) >= mc.maxPowerArmorGuards && (
              <div className="text-xs text-pip-green-dim">Power armor roster is full.</div>
            )}
          </div>

          <div className="border-t border-pip-border-dim pt-3 space-y-2">
            <div className="pip-label">BRAHMIN — {mc.brahminCost} ¤ each</div>
            <div className="text-xs text-pip-green-dim">
              {player.brahmin} / {mc.maxBrahmin} · +{mc.capacityPerBrahmin} inventory capacity each
            </div>
            <div className="flex gap-2 mt-1">
              {[1, 2].map(n => {
                const atCap = player.brahmin >= mc.maxBrahmin
                return (
                  <button
                    key={n}
                    className="pip-btn"
                    disabled={atCap || player.caps < n * mc.brahminCost}
                    onClick={() => store.purchaseBrahmin(n)}
                  >
                    BUY {n} ({n * mc.brahminCost} ¤)
                  </button>
                )
              })}
            </div>
            {player.brahmin >= mc.maxBrahmin && (
              <div className="text-xs text-pip-green-dim">Brahmin pen is full.</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
