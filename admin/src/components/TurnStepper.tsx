import { useMemo, useState } from 'react'
import type { CombatReplay, GameState } from '@main/types/game'
import { useArrowKeyStep } from '../hooks/useArrowKeyStep'

interface Props {
  gameState: GameState
  onViewCombat: (replay: CombatReplay) => void
}

const LOG_COLOR: Record<string, string> = {
  info: 'text-pip-green',
  danger: 'text-pip-red',
  profit: 'text-pip-amber',
  system: 'text-pip-blue',
}

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0)
}

export default function TurnStepper({ gameState, onViewCombat }: Props) {
  const turns = useMemo(() => {
    const set = new Set<number>()
    for (const e of gameState.log) set.add(e.turn)
    for (const h of gameState.history) set.add(h.turn)
    return Array.from(set).sort((a, b) => a - b)
  }, [gameState])

  const [turnIndex, setTurnIndex] = useState(0)
  const clampedIndex = Math.min(turnIndex, Math.max(0, turns.length - 1))
  const currentTurn = turns[clampedIndex]

  useArrowKeyStep(
    () => setTurnIndex(i => Math.max(0, i - 1)),
    () => setTurnIndex(i => Math.min(turns.length - 1, i + 1)),
    turns.length > 0,
  )

  if (turns.length === 0) return <div className="text-sm text-pip-green-dim">No turns recorded for this run.</div>

  const entries = gameState.log.filter(e => e.turn === currentTurn)
  const snapshot = gameState.history.find(h => h.turn === currentTurn)
  const prevSnapshot = gameState.history.find(h => h.turn === currentTurn - 1)
  const replays = gameState.combatReplays.filter(r => r.turn === currentTurn)
  const hasDangerLog = entries.some(e => e.type === 'danger')

  const capsDelta = snapshot && prevSnapshot ? snapshot.caps - prevSnapshot.caps : null
  const debtDelta = snapshot && prevSnapshot ? snapshot.debt - prevSnapshot.debt : null
  const ammoTotal = snapshot ? sum(Object.values(snapshot.ownedGunAmmo)) : null
  const gunCount = snapshot ? Object.keys(snapshot.ownedGunAmmo).length : null

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between mb-2">
        <button className="pip-btn text-xs py-1 px-3" disabled={clampedIndex === 0} onClick={() => setTurnIndex(i => Math.max(0, i - 1))}>← PREV</button>
        <div className="font-display text-lg text-pip-amber">TURN {currentTurn} <span className="text-pip-green-dim text-xs font-mono">({clampedIndex + 1} / {turns.length})</span></div>
        <button className="pip-btn text-xs py-1 px-3" disabled={clampedIndex === turns.length - 1} onClick={() => setTurnIndex(i => Math.min(turns.length - 1, i + 1))}>NEXT →</button>
      </div>
      <div className="text-[10px] font-mono text-pip-green-dim text-center mb-3">Use ← / → arrow keys to step through turns</div>

      {snapshot && (
        <div className="grid grid-cols-4 gap-2 mb-3 text-xs font-mono">
          <div className="border border-pip-border rounded px-2 py-1">
            <div className="text-pip-green-dim text-[10px]">CAPS</div>
            <div className="text-pip-amber">{snapshot.caps.toLocaleString()}{capsDelta !== null && capsDelta !== 0 && (
              <span className={capsDelta > 0 ? 'text-pip-green' : 'text-pip-red'}> ({capsDelta > 0 ? '+' : ''}{capsDelta})</span>
            )}</div>
          </div>
          <div className="border border-pip-border rounded px-2 py-1">
            <div className="text-pip-green-dim text-[10px]">DEBT</div>
            <div className="text-pip-red">{snapshot.debt.toLocaleString()}{debtDelta !== null && debtDelta !== 0 && (
              <span className={debtDelta < 0 ? 'text-pip-green' : 'text-pip-red'}> ({debtDelta > 0 ? '+' : ''}{debtDelta})</span>
            )}</div>
          </div>
          <div className="border border-pip-border rounded px-2 py-1">
            <div className="text-pip-green-dim text-[10px]">GUNS / AMMO</div>
            <div className="text-pip-green">{gunCount} guns · {ammoTotal} rds</div>
          </div>
          <div className="border border-pip-border rounded px-2 py-1">
            <div className="text-pip-green-dim text-[10px]">LOCATION</div>
            <div className="text-pip-green truncate">{snapshot.location}</div>
          </div>
        </div>
      )}
      {!snapshot && (
        <div className="text-[10px] font-mono text-pip-amber mb-3">No numeric snapshot for this turn (run predates per-turn tracking).</div>
      )}

      {replays.length > 0 && (
        <div className="flex gap-2 mb-3 flex-wrap">
          {replays.map(r => (
            <button key={r.id} className="pip-btn-amber text-xs py-1 px-3 rounded" onClick={() => onViewCombat(r)}>
              VIEW COMBAT REPLAY — WAVE {r.waveNumber} ({r.outcome}, {r.steps.length} steps)
            </button>
          ))}
        </div>
      )}
      {replays.length === 0 && hasDangerLog && (
        <div className="text-[10px] font-mono text-pip-amber mb-3">Combat happened this turn but predates structured replay capture — see log below.</div>
      )}

      <div className="flex-1 overflow-y-auto min-h-0 border border-pip-border rounded p-2 text-xs font-mono space-y-1">
        {entries.map((e, i) => (
          <div key={i} className={LOG_COLOR[e.type] ?? 'text-pip-green'}>&gt; {e.message}</div>
        ))}
        {entries.length === 0 && <div className="text-pip-green-dim">No log entries for this turn.</div>}
      </div>
    </div>
  )
}
