import { useState } from 'react'
import type { PlayerState } from '../../types/game'
import { GAME_MODES } from '../../data/modes'
import { useGameStore } from '../../store/gameStore'

interface Props { player: PlayerState }

type Tab = 'doctor' | 'loanshark' | 'gunshop' | 'followers'

export default function ServicesPanel({ player }: Props) {
  const mode = useGameStore(s => s.gameState?.mode ?? 'commonwealth')
  const mc = GAME_MODES[mode]
  const settlement = mc.settlements[player.location]
  const [activeTab, setActiveTab] = useState<Tab | null>(null)
  const [amount, setAmount] = useState(100)
  const [ammoQty, setAmmoQty] = useState(10)
  const store = useGameStore()

  const tabs: { key: Tab; label: string; available: boolean }[] = (
    [
      { key: 'doctor',    label: '🏥 DOCTOR',    available: settlement.hasDoctor },
      { key: 'loanshark', label: '💰 LOANS',     available: settlement.hasLoanshark },
      { key: 'gunshop',   label: '🔫 GUNS',      available: settlement.hasGunShop },
      { key: 'followers', label: '👥 FOLLOWERS', available: settlement.hasFollowers },
    ] as { key: Tab; label: string; available: boolean }[]
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
            className={activeTab === tab.key ? 'pip-btn bg-pip-green text-pip-bg' : 'pip-btn'}
            onClick={() => setActiveTab(activeTab === tab.key ? null : tab.key)}
          >
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

      {activeTab === 'gunshop' && (
        <div className="border border-pip-border p-3 rounded space-y-3">
          <div className="pip-label">GUN SHOP</div>
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
          {player.gun && (
            <div className="border-t border-pip-border pt-2">
              <div className="pip-label">AMMO — {mc.ammoPrice} ¤/round</div>
              <div className="flex items-center gap-2 mt-1">
                <input type="number" min={1} value={ammoQty} onChange={e => setAmmoQty(Math.max(1, parseInt(e.target.value) || 1))} className="pip-input w-16" />
                <button className="pip-btn" disabled={player.caps < ammoQty * mc.ammoPrice} onClick={() => store.purchaseAmmo(ammoQty)}>
                  BUY {ammoQty} ROUNDS ({ammoQty * mc.ammoPrice} ¤)
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'followers' && (
        <div className="border border-pip-border p-3 rounded space-y-4">
          <div className="space-y-2">
            <div className="pip-label">GUARDS — {mc.guardCost} ¤ each</div>
            <div className="text-xs text-pip-green-dim">Current: {player.guards} · Each absorbs {mc.guardHealth} HP in combat and improves escape chance.</div>
            <div className="flex gap-2 mt-1">
              {[1, 2, 3].map(n => (
                <button
                  key={n}
                  className="pip-btn"
                  disabled={player.caps < n * mc.guardCost}
                  onClick={() => store.hireguards(n)}
                >
                  HIRE {n} ({n * mc.guardCost} ¤)
                </button>
              ))}
            </div>
          </div>
          <div className="border-t border-pip-border-dim pt-3 space-y-2">
            <div className="pip-label">BRAHMIN — {mc.brahminCost} ¤ each</div>
            <div className="text-xs text-pip-green-dim">Current: {player.brahmin} · +{mc.capacityPerBrahmin} inventory capacity each</div>
            <div className="flex gap-2 mt-1">
              {[1, 2].map(n => (
                <button
                  key={n}
                  className="pip-btn"
                  disabled={player.caps < n * mc.brahminCost}
                  onClick={() => store.purchaseBrahmin(n)}
                >
                  BUY {n} ({n * mc.brahminCost} ¤)
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
