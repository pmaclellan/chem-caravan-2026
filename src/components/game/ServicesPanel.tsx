import { useState } from 'react'
import type { PlayerState } from '../../types/game'
import { SETTLEMENTS } from '../../data/settlements'
import { GUNS, GUN_IDS } from '../../data/guns'
import { CONFIG } from '../../data/config'
const AMMO_PRICE = 5
import { useGameStore } from '../../store/gameStore'

interface Props { player: PlayerState }

type Tab = 'doctor' | 'bank' | 'loanshark' | 'gunshop' | 'guards' | 'brahmin'

export default function ServicesPanel({ player }: Props) {
  const settlement = SETTLEMENTS[player.location]
  const [activeTab, setActiveTab] = useState<Tab | null>(null)
  const [amount, setAmount] = useState(100)
  const [ammoQty, setAmmoQty] = useState(10)
  const store = useGameStore()

  const tabs: { key: Tab; label: string; available: boolean }[] = (
    [
      { key: 'doctor',    label: 'DOCTOR',   available: settlement.hasDoctor },
      { key: 'bank',      label: 'BANK',     available: settlement.hasBank },
      { key: 'loanshark', label: 'LOANS',    available: settlement.hasLoanshark },
      { key: 'gunshop',   label: 'GUNS',     available: settlement.hasGunShop },
      { key: 'guards',    label: 'GUARDS',   available: settlement.hasGuards },
      { key: 'brahmin',   label: 'BRAHMIN',  available: settlement.hasBrahminMarket },
    ] as { key: Tab; label: string; available: boolean }[]
  ).filter(t => t.available)

  if (tabs.length === 0) {
    return <div className="text-pip-green-dim text-sm">No services available here.</div>
  }

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

      {activeTab === 'bank' && (
        <div className="border border-pip-border p-3 rounded space-y-3">
          <div className="pip-label">BANK — caps safe from robbery</div>
          <div className="text-xs text-pip-green-dim">On hand: {player.caps} ¤ · In bank: {player.bank} ¤</div>
          <div className="flex items-center gap-2">
            <input type="number" min={1} value={amount} onChange={e => setAmount(Math.max(1, parseInt(e.target.value) || 1))} className="pip-input w-24" />
            <button className="pip-btn" disabled={player.caps < amount} onClick={() => store.deposit(amount)}>DEPOSIT</button>
            <button className="pip-btn" disabled={player.bank < amount} onClick={() => store.withdraw(amount)}>WITHDRAW</button>
          </div>
          {player.debt > 0 && (
            <div>
              <div className="pip-label mt-2">Repay Debt — current: {player.debt} ¤</div>
              <div className="flex gap-2 mt-1">
                <button className="pip-btn" disabled={player.caps < Math.min(amount, player.debt)} onClick={() => store.payDebt(amount)}>
                  PAY {Math.min(amount, player.debt)} ¤
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'loanshark' && (
        <div className="border border-pip-border p-3 rounded space-y-3">
          <div className="pip-label">LOANSHARK — 10% interest per turn</div>
          <div className="text-xs text-pip-red">Current debt: {player.debt} ¤</div>
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
      )}

      {activeTab === 'gunshop' && (
        <div className="border border-pip-border p-3 rounded space-y-3">
          <div className="pip-label">GUN SHOP</div>
          {GUN_IDS.map(gunId => {
            const gun = GUNS[gunId]
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
              <div className="pip-label">AMMO — {AMMO_PRICE} ¤/round</div>
              <div className="flex items-center gap-2 mt-1">
                <input type="number" min={1} value={ammoQty} onChange={e => setAmmoQty(Math.max(1, parseInt(e.target.value) || 1))} className="pip-input w-16" />
                <button className="pip-btn" disabled={player.caps < ammoQty * 5} onClick={() => store.purchaseAmmo(ammoQty)}>
                  BUY {ammoQty} ROUNDS ({ammoQty * 5} ¤)
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'guards' && (
        <div className="border border-pip-border p-3 rounded space-y-2">
          <div className="pip-label">HIRE GUARDS — {CONFIG.GUARD_COST} ¤ each</div>
          <div className="text-xs text-pip-green-dim">Current guards: {player.guards} · Each guard absorbs {CONFIG.GUARD_HEALTH} HP in combat and improves escape chance.</div>
          <div className="flex gap-2 mt-2">
            {[1, 2, 3].map(n => (
              <button
                key={n}
                className="pip-btn"
                disabled={player.caps < n * CONFIG.GUARD_COST}
                onClick={() => store.hireguards(n)}
              >
                HIRE {n} ({n * CONFIG.GUARD_COST} ¤)
              </button>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'brahmin' && (
        <div className="border border-pip-border p-3 rounded space-y-2">
          <div className="pip-label">BRAHMIN MARKET — {CONFIG.BRAHMIN_COST} ¤ each</div>
          <div className="text-xs text-pip-green-dim">Current: {player.brahmin} brahmin · +10 inventory capacity each</div>
          <div className="flex gap-2 mt-2">
            {[1, 2].map(n => (
              <button
                key={n}
                className="pip-btn"
                disabled={player.caps < n * CONFIG.BRAHMIN_COST}
                onClick={() => store.purchaseBrahmin(n)}
              >
                BUY {n} ({n * CONFIG.BRAHMIN_COST} ¤)
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
