import { useState, useEffect } from 'react'

const KEYFRAMES = `
  @keyframes dfOverlay {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes dfStamp {
    0%   { opacity: 0; transform: scale(1.4) rotate(-3deg); letter-spacing: 0.6em; filter: blur(6px); }
    55%  { opacity: 1; transform: scale(0.97) rotate(0.5deg); letter-spacing: 0.18em; filter: blur(0); }
    100% { opacity: 1; transform: scale(1) rotate(0deg); letter-spacing: 0.2em; }
  }
  @keyframes dfRule {
    from { transform: scaleX(0); opacity: 0; }
    to   { transform: scaleX(1); opacity: 1; }
  }
  @keyframes dfRise {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes dfXpGlow {
    0%, 100% { box-shadow: 0 0 8px var(--pip-blue), inset 0 0 10px rgba(42,90,138,0.07); }
    50%       { box-shadow: 0 0 28px var(--pip-blue), inset 0 0 22px rgba(42,90,138,0.16); }
  }
  @keyframes dfBtnPulse {
    0%, 100% { opacity: 1; box-shadow: none; }
    50%       { opacity: 0.8; box-shadow: 0 0 12px var(--pip-amber); }
  }
  @keyframes dfScanline {
    0%   { background-position: 0 0; }
    100% { background-position: 0 8px; }
  }
  @keyframes dfChains {
    0%   { opacity: 0; transform: scale(0.7) rotate(8deg); }
    40%  { opacity: 1; transform: scale(1.08) rotate(-1deg); }
    70%  { transform: scale(0.98) rotate(0.5deg); }
    100% { opacity: 1; transform: scale(1) rotate(0deg); }
  }
  @keyframes dfSubtitle {
    from { opacity: 0; letter-spacing: 0.5em; }
    to   { opacity: 1; letter-spacing: 0.35em; }
  }
`

function useCountUp(target: number, duration = 1400, startDelay = 0) {
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

interface Props {
  xpGained: number
  onDismiss: () => void
}

export default function DebtFreedomModal({ xpGained, onDismiss }: Props) {
  const xpCounted = useCountUp(xpGained, 1400, 900)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ animation: 'dfOverlay 0.4s ease both' }}
      onClick={onDismiss}
    >
      <style>{KEYFRAMES}</style>

      {/* Deep backdrop */}
      <div className="absolute inset-0" style={{ backgroundColor: 'color-mix(in srgb, var(--pip-bg) 96%, transparent)' }} />

      {/* Subtle scanlines */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.035) 3px, rgba(0,0,0,0.035) 4px)',
        }}
      />

      {/* Vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.55) 100%)' }}
      />

      <div className="relative w-full max-w-xs text-center" onClick={e => e.stopPropagation()}>

        {/* Broken shackle SVG */}
        <div
          className="flex justify-center mb-4"
          style={{ animation: 'dfChains 0.65s cubic-bezier(0.22,1,0.36,1) 0.1s both', opacity: 0 }}
        >
          <svg viewBox="0 0 64 64" width="52" height="52" fill="none" stroke="currentColor"
            style={{ color: 'var(--pip-amber)', strokeWidth: 2.5, strokeLinecap: 'round', strokeLinejoin: 'round' }}>
            {/* Left chain link */}
            <rect x="4" y="22" width="18" height="11" rx="5.5" />
            {/* Right chain link (broken apart) */}
            <rect x="42" y="31" width="18" height="11" rx="5.5" />
            {/* Break marks in middle */}
            <line x1="24" y1="25" x2="28" y2="20" strokeDasharray="3 2" />
            <line x1="36" y1="39" x2="40" y2="34" strokeDasharray="3 2" />
            {/* Spark lines */}
            <line x1="30" y1="24" x2="32" y2="18" />
            <line x1="34" y1="40" x2="32" y2="46" />
            <line x1="26" y1="32" x2="20" y2="34" />
            <line x1="38" y1="32" x2="44" y2="30" />
          </svg>
        </div>

        {/* DEBT CLEARED stamp */}
        <div
          className="font-display text-pip-blue leading-none mb-1"
          style={{
            fontSize: 'clamp(2rem, 9vw, 3rem)',
            animation: 'dfStamp 0.6s cubic-bezier(0.22,1,0.36,1) 0.28s both',
            opacity: 0,
            letterSpacing: '0.2em',
          }}
        >
          DEBT CLEARED
        </div>

        {/* Rule */}
        <div
          className="h-px my-3"
          style={{
            background: 'linear-gradient(90deg, transparent, var(--pip-amber), transparent)',
            transformOrigin: 'center',
            animation: 'dfRule 0.55s cubic-bezier(0.22,1,0.36,1) 0.55s both',
            opacity: 0,
          }}
        />

        {/* Subtitle */}
        <div
          className="font-display text-pip-green text-xs mb-5"
          style={{ animation: 'dfSubtitle 0.5s ease 0.72s both', opacity: 0, letterSpacing: '0.35em' }}
        >
          FINANCIAL FREEDOM
        </div>

        {/* XP counter */}
        <div
          className="rounded border px-5 py-4 flex items-center justify-between mb-5"
          style={{
            borderColor: 'var(--pip-blue)',
            backgroundColor: 'color-mix(in srgb, var(--pip-bg-light) 55%, transparent)',
            animation: 'dfRise 0.4s ease 0.88s both, dfXpGlow 2.8s ease-in-out 1.35s infinite',
            opacity: 0,
          }}
        >
          <div className="text-left">
            <div className="pip-label text-xs tracking-widest">XP EARNED</div>
            <div className="text-pip-green-dim text-xs opacity-60 mt-0.5">Free and Clear achievement</div>
          </div>
          <span
            className="font-display tabular-nums text-pip-blue"
            style={{ fontSize: '2.6rem', lineHeight: 1 }}
          >
            +{xpCounted.toLocaleString()}
          </span>
        </div>

        {/* Flavour */}
        <div
          className="text-pip-green text-xs font-mono leading-relaxed mb-5 px-1 italic"
          style={{ animation: 'dfRise 0.4s ease 1.05s both', opacity: 0 }}
        >
          The weight of debt lifts from your pack.
        </div>

        {/* Button */}
        <button
          className="w-full font-display tracking-widest text-sm"
          style={{
            background: 'var(--pip-amber)',
            color: 'var(--pip-bg-light)',
            border: 'none',
            borderRadius: '2px',
            padding: '11px 0',
            cursor: 'pointer',
            boxShadow: '0 0 10px color-mix(in srgb, var(--pip-amber) 35%, transparent)',
            animation: 'dfRise 0.4s ease 1.2s both, dfBtnPulse 2.2s ease-in-out 1.7s infinite',
            opacity: 0,
          }}
          onClick={onDismiss}
        >
          BACK TO THE ROAD
        </button>
      </div>
    </div>
  )
}
