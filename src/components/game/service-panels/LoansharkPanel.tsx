import { useState } from 'react'
import type { PlayerState } from '../../../types/game'
import { GAME_MODES } from '../../../data/modes'
import { useGameStore } from '../../../store/gameStore'

export function LoansharkPanel({ player }: { player: PlayerState }) {
  const mode = useGameStore(s => s.gameState?.mode ?? 'commonwealth')
  const mc = GAME_MODES[mode]
  const store = useGameStore()
  const [amount, setAmount] = useState(100)
  const [rawAmount, setRawAmount] = useState('100')

  const interestPct = Math.round(mc.interestRate * 100 * 10) / 10
  const isOverGrace = player.ageOfDebt >= mc.debtGracePeriod
  const windowStartAge = player.debtWindowStartAge ?? player.ageOfDebt
  const turnsElapsed = player.ageOfDebt - windowStartAge
  const turnsLeft = Math.max(0, mc.debtWindowSize - turnsElapsed)
  const minWindowPayment = player.debtWindowMinPayment ?? Math.ceil(player.debt * mc.debtMinPaymentRate)
  const netPaidThisCycle = Math.max(0, (player.debtPaidThisCycle ?? 0) - (player.debtBorrowedThisCycle ?? 0))
  const windowPaid = (player.debtWindowCapsPaid ?? 0) + netPaidThisCycle
  const stillOwed = Math.max(0, minWindowPayment - windowPaid)
  const windowOverdue = turnsElapsed >= mc.debtWindowSize
  const windowSatisfied = windowPaid >= minWindowPayment

  const resolveAmount = () => {
    const n = Math.max(1, parseInt(rawAmount, 10) || 1)
    setAmount(n)
    setRawAmount(String(n))
    return n
  }

  const setPreset = (n: number) => { setAmount(n); setRawAmount(String(n)) }

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

      <div className="flex items-center gap-1 flex-wrap">
        <span className="pip-label text-pip-green-dim" style={{ fontSize: '0.6rem' }}>QUICK:</span>
        {[100, 500, 1000].map(n => (
          <button
            key={n}
            onClick={() => setPreset(n)}
            className="font-mono border rounded transition-colors"
            style={{
              fontSize: '0.7rem', padding: '1px 7px',
              borderColor: amount === n ? 'var(--pip-green)' : 'var(--pip-border)',
              color:       amount === n ? 'var(--pip-bg)'    : 'var(--pip-green-dim)',
              backgroundColor: amount === n ? 'var(--pip-green)' : 'transparent',
            }}
          >
            {n}
          </button>
        ))}
        {player.debt > 0 && (
          <button
            onClick={() => setPreset(player.debt)}
            className="font-mono border rounded transition-colors"
            style={{
              fontSize: '0.7rem', padding: '1px 7px',
              borderColor: amount === player.debt ? 'var(--pip-amber)' : 'var(--pip-border)',
              color:       amount === player.debt ? 'var(--pip-bg)'    : 'var(--pip-amber)',
              backgroundColor: amount === player.debt ? 'var(--pip-amber)' : 'transparent',
            }}
          >
            ALL
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <input
          type="text"
          inputMode="numeric"
          className="pip-input w-24"
          value={rawAmount}
          onChange={e => { const v = e.target.value.replace(/[^0-9]/g, ''); setRawAmount(v); const n = parseInt(v, 10); if (n > 0) setAmount(n) }}
          onBlur={resolveAmount}
          onKeyDown={e => { if (e.key === 'Enter') resolveAmount() }}
          placeholder="100"
        />
        <button className="pip-btn-danger" onClick={() => store.borrow(resolveAmount())}>
          BORROW ({amount} ¤)
        </button>
        {player.debt > 0 && (
          <button
            className="pip-btn"
            disabled={player.caps < Math.min(amount, player.debt)}
            onClick={() => store.payDebt(resolveAmount())}
          >
            REPAY {Math.min(amount, player.debt)} ¤
          </button>
        )}
      </div>
    </div>
  )
}
