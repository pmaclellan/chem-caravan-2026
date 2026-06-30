import { useEffect, useState } from 'react'
import type { Settlement } from '../../data/modes'

const KEYFRAMES = `
  @keyframes sdOverlay {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes sdPanelUp {
    from { opacity: 0; transform: translateY(28px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes sdNameIn {
    0%   { opacity: 0; transform: translateX(-16px) skewX(-4deg); }
    60%  { opacity: 1; transform: translateX(2px) skewX(0.5deg); }
    100% { opacity: 1; transform: translateX(0) skewX(0); }
  }
  @keyframes sdFadeIn {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes sdRule {
    from { transform: scaleX(0); opacity: 0; }
    to   { transform: scaleX(1); opacity: 1; }
  }
  @keyframes sdXpGlow {
    0%, 100% { box-shadow: 0 0 6px var(--pip-blue), inset 0 0 6px rgba(42,90,138,0.06); }
    50%       { box-shadow: 0 0 18px var(--pip-blue), inset 0 0 14px rgba(42,90,138,0.14); }
  }
`

function useCountUp(target: number, duration = 700, startDelay = 0) {
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

function deriveTips(s: Settlement): string[] {
  const tips: string[] = []
  if (s.priceModifier !== undefined) {
    if (s.priceModifier < 1)
      tips.push(`${Math.round((1 - s.priceModifier) * 100)}% cheaper chems than average`)
    else if (s.priceModifier > 1)
      tips.push(`${Math.round((s.priceModifier - 1) * 100)}% pricier chems — buy elsewhere`)
  }
  if (s.stockMultiplier !== undefined) {
    if (s.stockMultiplier > 1)
      tips.push(`Up to ${Math.round(s.stockMultiplier * 100)}% larger stock — good for bulk buying`)
    else if (s.stockMultiplier < 1)
      tips.push('Limited stock — selection may be sparse')
  }
  if (s.availabilityBonus !== undefined && s.availabilityBonus > 0)
    tips.push('Higher chem availability — more variety in stock')
  return tips
}

interface Props {
  settlement: Settlement
  xpGained: number
  onDismiss: () => void
}

export default function SettlementDiscoverySplash({ settlement, xpGained, onDismiss }: Props) {
  const xpCounted = useCountUp(xpGained, 700, 650)
  const tips = deriveTips(settlement)

  return (
    <div
      className="fixed inset-0 z-40 flex items-end sm:items-center justify-center"
      style={{ animation: 'sdOverlay 0.35s ease both' }}
      onClick={onDismiss}
    >
      <style>{KEYFRAMES}</style>

      {/* Settlement image as full-bleed backdrop */}
      {settlement.imageUrl && (
        <img
          src={settlement.imageUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          style={{ opacity: 0.38, filter: 'blur(1px) saturate(0.7)' }}
        />
      )}

      {/* Gradient overlay — heavier at bottom where panel sits */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(to bottom, color-mix(in srgb, var(--pip-bg) 30%, transparent) 0%, color-mix(in srgb, var(--pip-bg) 10%, transparent) 35%, color-mix(in srgb, var(--pip-bg) 82%, transparent) 75%, var(--pip-bg) 100%)',
        }}
      />

      {/* Panel */}
      <div
        className="relative w-full max-w-sm mx-4 mb-6 sm:mb-0 rounded border"
        style={{
          borderColor: 'var(--pip-border)',
          backgroundColor: 'color-mix(in srgb, var(--pip-bg-light) 88%, transparent)',
          animation: 'sdPanelUp 0.45s cubic-bezier(0.22,1,0.36,1) 0.1s both',
          opacity: 0,
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 pt-4 pb-5 space-y-3">

          {/* "NEW LOCATION" badge */}
          <div
            className="flex items-center gap-2"
            style={{ animation: 'sdFadeIn 0.35s ease 0.2s both', opacity: 0 }}
          >
            <div
              className="text-pip-amber font-display text-xs tracking-[0.25em] px-2 py-0.5 rounded"
              style={{ border: '1px solid var(--pip-amber)', backgroundColor: 'color-mix(in srgb, var(--pip-amber) 10%, transparent)' }}
            >
              NEW LOCATION
            </div>
            <div className="h-px flex-1" style={{ backgroundColor: 'var(--pip-border-dim)' }} />
          </div>

          {/* Settlement name */}
          <div
            className="font-display text-pip-green leading-none"
            style={{
              fontSize: 'clamp(1.7rem, 7vw, 2.4rem)',
              animation: 'sdNameIn 0.5s cubic-bezier(0.22,1,0.36,1) 0.25s both',
              opacity: 0,
            }}
          >
            {settlement.name.toUpperCase()}
          </div>

          {/* Faction */}
          <div
            className="text-pip-green-dim text-xs font-mono tracking-widest -mt-1"
            style={{ animation: 'sdFadeIn 0.35s ease 0.38s both', opacity: 0 }}
          >
            {settlement.faction}
          </div>

          {/* Rule */}
          <div
            className="h-px"
            style={{
              background: 'linear-gradient(90deg, var(--pip-border), transparent)',
              transformOrigin: 'left',
              animation: 'sdRule 0.5s cubic-bezier(0.22,1,0.36,1) 0.4s both',
              opacity: 0,
            }}
          />

          {/* Description */}
          <div
            className="text-pip-green text-sm leading-relaxed"
            style={{ animation: 'sdFadeIn 0.35s ease 0.48s both', opacity: 0 }}
          >
            {settlement.description}
          </div>

          {/* Mechanic tips */}
          {tips.length > 0 && (
            <div
              className="space-y-1"
              style={{ animation: 'sdFadeIn 0.35s ease 0.58s both', opacity: 0 }}
            >
              {tips.map((tip, i) => (
                <div key={i} className="flex gap-2 items-start text-xs">
                  <span className="text-pip-amber mt-0.5 flex-shrink-0">◈</span>
                  <span className="text-pip-green-dim">{tip}</span>
                </div>
              ))}
            </div>
          )}

          {/* XP reward */}
          <div
            className="flex items-center justify-between border rounded px-3 py-2.5 mt-1"
            style={{
              borderColor: 'var(--pip-blue)',
              backgroundColor: 'color-mix(in srgb, var(--pip-bg-light) 40%, transparent)',
              animation: 'sdFadeIn 0.35s ease 0.68s both, sdXpGlow 2.5s ease-in-out 1.2s infinite',
              opacity: 0,
            }}
          >
            <div>
              <div className="pip-label text-xs tracking-widest">DISCOVERY BONUS</div>
              <div className="text-pip-green-dim text-xs opacity-60">first visit</div>
            </div>
            <span className="font-display text-pip-blue tabular-nums" style={{ fontSize: '1.8rem', lineHeight: 1 }}>
              +{xpCounted} XP
            </span>
          </div>

          {/* Dismiss hint */}
          <div
            className="text-center text-pip-green-dim text-xs opacity-50"
            style={{ animation: 'sdFadeIn 0.35s ease 0.85s both', opacity: 0 }}
          >
            tap to continue
          </div>
        </div>
      </div>
    </div>
  )
}
