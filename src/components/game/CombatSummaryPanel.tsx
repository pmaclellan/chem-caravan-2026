import { useState, useEffect } from 'react'
import type { CombatState } from '../../types/game'
import { useGameStore } from '../../store/gameStore'
import { CHEMS } from '../../data/chems'

const KEYFRAMES = `
  @keyframes stampIn {
    0%   { opacity: 0; transform: scale(1.18) rotate(-1deg); filter: blur(2px); }
    60%  { opacity: 1; transform: scale(0.97) rotate(0deg); filter: blur(0); }
    100% { opacity: 1; transform: scale(1) rotate(0deg); }
  }
  @keyframes sweepLine {
    from { transform: scaleX(0); }
    to   { transform: scaleX(1); }
  }
  @keyframes slideInRow {
    from { opacity: 0; transform: translateX(-14px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes riseIn {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes ambientGlow {
    0%, 100% { box-shadow: 0 0 4px var(--pip-blue), inset 0 0 6px rgba(42,90,138,0.06); }
    50%       { box-shadow: 0 0 14px var(--pip-blue), inset 0 0 12px rgba(42,90,138,0.12); }
  }
  @keyframes btnReady {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.72; }
  }
  @keyframes escapedIn {
    from { opacity: 0; transform: translateY(-4px); }
    to   { opacity: 1; transform: translateY(0); }
  }
`

function useCountUp(target: number, duration = 800, startDelay = 0) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (target === 0) return
    let raf: number
    const timeout = setTimeout(() => {
      const t0 = performance.now()
      const step = (now: number) => {
        const p = Math.min((now - t0) / duration, 1)
        setVal(Math.round(target * (1 - Math.pow(1 - p, 3))))
        if (p < 1) raf = requestAnimationFrame(step)
      }
      raf = requestAnimationFrame(step)
    }, startDelay)
    return () => { clearTimeout(timeout); cancelAnimationFrame(raf) }
  }, [target, duration, startDelay])
  return val
}

interface StatRowProps {
  label: string
  value: number
  colorClass: string
  delay: number
  format?: (n: number) => string
}

function StatRow({ label, value, colorClass, delay, format }: StatRowProps) {
  const counted = useCountUp(value, 750, delay)
  const display = format ? format(counted) : String(counted)

  return (
    <div
      className="flex items-baseline justify-between py-2.5 border-b border-pip-border-dim"
      style={{
        animation: `slideInRow 0.35s ease ${delay}ms both`,
      }}
    >
      <span className="pip-label text-xs tracking-widest opacity-80">{label}</span>
      <span className={`font-display text-2xl tabular-nums ${colorClass}`}>{display}</span>
    </div>
  )
}

interface Props { combat: CombatState }

export default function CombatSummaryPanel({ combat }: Props) {
  const { dismissCombatSummary } = useGameStore()

  const won         = combat.phase === 'won'
  const fled        = combat.phase === 'fled'
  const killedCount = combat.enemies.filter(e => e.dead).length
  const totalCount  = combat.enemies.length
  const chemEntries = Object.entries(combat.enemyLoot).filter(([, qty]) => qty > 0)
  const xpGained    = combat.xpGained ?? 0

  const xpCounted = useCountUp(xpGained, 950, 880)

  return (
    <>
      <style>{KEYFRAMES}</style>

      {/* ── Title ─────────────────────────────────────────────── */}
      <div
        className={`font-display tracking-widest mb-0.5 ${
          won ? 'text-pip-amber text-4xl' : 'text-pip-green text-3xl'
        }`}
        style={{ animation: won ? 'stampIn 0.45s cubic-bezier(0.22,1,0.36,1) both' : 'escapedIn 0.35s ease both' }}
      >
        {won ? 'VICTORY' : 'ESCAPED'}
      </div>

      {/* Animated rule */}
      <div
        className="h-px bg-pip-amber mb-4 mt-1"
        style={{ transformOrigin: 'left', animation: 'sweepLine 0.55s cubic-bezier(0.22,1,0.36,1) 0.1s both' }}
      />

      {/* ── Stats ─────────────────────────────────────────────── */}
      {won && (
        <>
          <StatRow
            label="DAMAGE DEALT"
            value={combat.totalDamageDealt}
            colorClass="text-pip-green"
            delay={180}
          />
          <StatRow
            label="DAMAGE TAKEN"
            value={combat.totalDamageTaken}
            colorClass="text-pip-red"
            delay={320}
          />
          <StatRow
            label="ENEMIES KILLED"
            value={killedCount}
            colorClass="text-pip-green"
            delay={460}
            format={n => `${n} / ${totalCount}`}
          />
          <StatRow
            label="CAPS LOOTED"
            value={combat.capsLooted}
            colorClass="text-pip-amber"
            delay={600}
            format={n => `${n} ¤`}
          />
        </>
      )}

      {fled && (
        <div style={{ animation: 'escapedIn 0.4s ease 0.2s both', opacity: 0 }}>
          <div className="flex items-baseline justify-between py-2.5 border-b border-pip-border-dim">
            <span className="pip-label text-xs tracking-widest opacity-80">DAMAGE TAKEN</span>
            <span className="font-display text-2xl text-pip-red">{combat.totalDamageTaken}</span>
          </div>
          <div className="text-pip-green-dim text-xs mt-2">You escaped — no loot collected.</div>
        </div>
      )}

      {/* ── XP box ────────────────────────────────────────────── */}
      {won && xpGained > 0 && (
        <div
          className="border border-pip-blue rounded mt-4 px-4 py-3 flex items-baseline justify-between"
          style={{
            animation: 'riseIn 0.4s ease 820ms both, ambientGlow 2.4s ease-in-out 1.3s infinite',
          }}
        >
          <div>
            <div className="pip-label text-xs tracking-widest mb-0.5">XP EARNED</div>
            <div className="text-pip-green-dim text-xs opacity-70">this combat</div>
          </div>
          <span className="font-display text-3xl text-pip-blue tabular-nums">+{xpCounted}</span>
        </div>
      )}

      {/* ── Loot ──────────────────────────────────────────────── */}
      {won && (
        <div style={{ animation: 'riseIn 0.35s ease 1060ms both', opacity: 0 }}>
          {chemEntries.length > 0 ? (
            <div className="mt-3">
              <div className="pip-label text-xs tracking-widest mb-2">FOUND ON BODIES</div>
              <div className="flex flex-wrap gap-1.5">
                {chemEntries.map(([chemId, qty]) => (
                  <div
                    key={chemId}
                    className="border border-pip-border rounded px-2.5 py-1 text-xs flex gap-1.5 items-center"
                  >
                    <span className="text-pip-green font-mono">{CHEMS[chemId]?.name ?? chemId}</span>
                    <span className="text-pip-amber font-display">×{qty}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-pip-green-dim text-xs mt-3 opacity-70">No chems found on the bodies.</div>
          )}
        </div>
      )}

      {/* ── Continue ──────────────────────────────────────────── */}
      <button
        className="pip-btn-amber w-full mt-5"
        style={{ animation: 'riseIn 0.35s ease 1200ms both, btnReady 2s ease-in-out 1.6s infinite', opacity: 0 }}
        onClick={dismissCombatSummary}
      >
        CONTINUE
      </button>
    </>
  )
}
