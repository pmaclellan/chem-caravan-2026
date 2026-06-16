import { useState, useRef, useEffect, useCallback } from 'react'

const STYLES = `
  @keyframes feedbackFadeUp {
    0%   { opacity: 1; transform: translateY(0) scale(1.08); }
    65%  { opacity: 0.85; transform: translateY(-8px) scale(1.03); }
    100% { opacity: 0; transform: translateY(-18px) scale(0.92); }
  }
  @keyframes tamedAppear {
    0%   { opacity: 0; transform: scale(0.72) translateY(6px); }
    30%  { opacity: 1; transform: scale(1.2) translateY(-2px); }
    58%  { transform: scale(0.96) translateY(0); }
    100% { opacity: 1; transform: scale(1) translateY(0); }
  }
  @keyframes meterHitFlash {
    0%   { background: rgba(44,74,16,0); }
    18%  { background: rgba(44,74,16,0.48); }
    100% { background: rgba(44,74,16,0); }
  }
  @keyframes meterMissFlash {
    0%   { background: rgba(140,28,28,0); box-shadow: inset 0 0 0 0 var(--pip-red); }
    18%  { background: rgba(140,28,28,0.38); box-shadow: inset 0 0 0 2px var(--pip-red); }
    100% { background: rgba(140,28,28,0); box-shadow: inset 0 0 0 0 var(--pip-red); }
  }
  @keyframes greenZonePulse {
    0%   { background: rgba(44,74,16,0.28); }
    35%  { background: rgba(44,74,16,0.62); box-shadow: 0 0 14px rgba(44,74,16,0.55); }
    100% { background: rgba(44,74,16,0.28); box-shadow: none; }
  }
  @keyframes creatureThrob {
    0%, 100% { filter: drop-shadow(0 0 6px rgba(196,80,26,0.45)); }
    50%       { filter: drop-shadow(0 0 20px rgba(196,80,26,0.82)); }
  }
  @keyframes needleGlow {
    0%, 100% { box-shadow: 0 0 4px var(--pip-amber), 0 0 10px rgba(196,80,26,0.28); }
    50%       { box-shadow: 0 0 10px var(--pip-amber), 0 0 24px rgba(196,80,26,0.52); }
  }
  @keyframes pipPop {
    0%   { transform: scale(1); }
    38%  { transform: scale(1.65); box-shadow: 0 0 14px var(--pip-amber); }
    100% { transform: scale(1); box-shadow: none; }
  }
  @keyframes modalSlideIn {
    0%   { opacity: 0; transform: translateY(14px) scale(0.97); }
    100% { opacity: 1; transform: translateY(0) scale(1); }
  }
`

const CREATURE_SVGS: Record<string, string> = {
  yao_guai: `<circle cx="24" cy="16" r="11" fill="currentColor"/><circle cx="15" cy="8" r="5" fill="currentColor"/><circle cx="33" cy="8" r="5" fill="currentColor"/><ellipse cx="24" cy="34" rx="14" ry="12" fill="currentColor"/><rect x="8" y="28" width="8" height="14" rx="4" fill="currentColor"/><rect x="32" y="28" width="8" height="14" rx="4" fill="currentColor"/>`,
  radscorpion: `<ellipse cx="22" cy="33" rx="13" ry="9" fill="currentColor"/><ellipse cx="19" cy="21" rx="8" ry="6" fill="currentColor"/><path d="M11 19 L3 13 L4 18 L11 23 Z" fill="currentColor"/><path d="M11 23 L3 27 L4 31 L11 27 Z" fill="currentColor"/><path d="M27 19 L33 12 L35 17 L27 23 Z" fill="currentColor"/><path d="M27 23 L34 27 L33 31 L27 27 Z" fill="currentColor"/><path d="M32 30 C38 26 44 18 42 9 C40 3 35 1 32 5" stroke="currentColor" stroke-width="4" fill="none" stroke-linecap="round"/><polygon points="32,5 28,1 36,1" fill="currentColor"/>`,
  deathclaw: `<ellipse cx="27" cy="30" rx="14" ry="10" fill="currentColor"/><ellipse cx="40" cy="22" rx="7" ry="5" fill="currentColor"/><rect x="36" y="13" width="3" height="11" rx="1" fill="currentColor" transform="rotate(-20 37 18)"/><rect x="42" y="13" width="3" height="11" rx="1" fill="currentColor" transform="rotate(15 44 18)"/><rect x="13" y="37" width="5" height="10" rx="2" fill="currentColor" transform="rotate(-10 15 42)"/><rect x="31" y="38" width="5" height="10" rx="2" fill="currentColor"/><path d="M13 28 C8 30 5 35 8 40" stroke="currentColor" stroke-width="4" fill="none" stroke-linecap="round"/>`,
}

const TOOL_SVGS: Record<string, string> = {
  lasso: `
    <circle cx="16" cy="19" r="9" stroke="currentColor" stroke-width="2.5" fill="none"/>
    <circle cx="16" cy="19" r="5" stroke="currentColor" stroke-width="1.5" fill="none"/>
    <circle cx="16" cy="19" r="1.5" fill="currentColor"/>
    <path d="M16 10 L16 4" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path d="M16 4 C17 2 20 2 20 4" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/>
  `,
  tranq_gun: `
    <rect x="2" y="11" width="18" height="9" rx="2.5" fill="currentColor"/>
    <rect x="20" y="13.5" width="8" height="4" rx="1" fill="currentColor"/>
    <rect x="28" y="14.5" width="4" height="2" rx="0.5" fill="currentColor"/>
    <rect x="7" y="4" width="5" height="7" rx="2" fill="currentColor"/>
    <rect x="5" y="20" width="7" height="6" rx="1.5" fill="currentColor"/>
  `,
  mesmetron: `
    <rect x="3" y="11" width="16" height="10" rx="3" fill="currentColor"/>
    <rect x="19" y="13.5" width="8" height="5" rx="1" fill="currentColor"/>
    <rect x="8" y="4" width="7" height="7" rx="2.5" fill="currentColor"/>
    <line x1="27" y1="11" x2="31" y2="8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    <line x1="27" y1="16" x2="32" y2="16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    <line x1="27" y1="21" x2="31" y2="24" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  `,
}

const TOOL_FLAVOUR: Record<string, string> = {
  lasso:     'Stop the needle in the green zone 3 times in a row',
  tranq_gun: 'Stop the needle in the green zone 3 times in a row',
  mesmetron: 'Stop the needle in the green zone 3 times in a row',
}

interface TamingMinigameProps {
  tool: { id: string; name: string; greenWindowFraction: number; cursorSpeedMultiplier: number }
  creatureName: string
  creatureTypeId: string
  onSuccess: () => void
  onAbandon: () => void
}

const BASE_ANGULAR = 1.43  // rad/s → ~2.2s to cross the full bar at 1× speed

export default function TamingMinigame({
  tool, creatureName, creatureTypeId, onSuccess, onAbandon,
}: TamingMinigameProps) {
  // Green zone randomised once on mount; stays fixed for the whole attempt
  const [greenStart] = useState(() => {
    const half = tool.greenWindowFraction / 2
    const lo   = half + 0.05
    const hi   = 1 - half - 0.05
    const cx   = lo + Math.random() * (hi - lo)
    return cx - half
  })
  const greenEnd = greenStart + tool.greenWindowFraction

  const [cursorPos,    setCursorPos]    = useState(0.5)
  const [streak,       setStreak]       = useState(0)
  const [done,         setDone]         = useState(false)

  // Animation restart keys — increment → matching child remounts → CSS animation restarts
  const [feedbackKey,    setFeedbackKey]    = useState(0)
  const [feedbackKind,   setFeedbackKind]   = useState<'none' | 'hit' | 'miss' | 'tamed'>('none')
  const [meterFlashKey,  setMeterFlashKey]  = useState(0)
  const [meterFlashKind, setMeterFlashKind] = useState<'hit' | 'miss' | null>(null)
  const [pipPopKeys,     setPipPopKeys]     = useState([0, 0, 0])
  const [greenPulseKey,  setGreenPulseKey]  = useState(0)

  // Refs for rAF loop (avoid stale closures)
  const timeRef    = useRef(0)
  const lastTsRef  = useRef<number | null>(null)
  const pausedRef  = useRef(false)
  const doneRef    = useRef(false)
  const streakRef  = useRef(0)
  const rafRef     = useRef<number | null>(null)
  const angularRef = useRef(BASE_ANGULAR * tool.cursorSpeedMultiplier)

  useEffect(() => {
    angularRef.current = BASE_ANGULAR * tool.cursorSpeedMultiplier
  }, [tool.cursorSpeedMultiplier])

  // rAF animation loop — runs for the lifetime of the component
  useEffect(() => {
    const tick = (ts: number) => {
      if (doneRef.current) return
      if (!pausedRef.current) {
        if (lastTsRef.current !== null) {
          timeRef.current += (ts - lastTsRef.current) / 1000
        }
        // Sine gives natural ease-at-walls: pos oscillates [0, 1] smoothly
        setCursorPos(0.5 + 0.5 * Math.sin(timeRef.current * angularRef.current))
      }
      lastTsRef.current = ts
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [])

  const handleStop = useCallback(() => {
    if (pausedRef.current || doneRef.current) return
    pausedRef.current = true

    const pos = 0.5 + 0.5 * Math.sin(timeRef.current * angularRef.current)
    const hit = pos >= greenStart && pos <= greenEnd

    if (hit) {
      const ns = streakRef.current + 1
      streakRef.current = ns
      setStreak(ns)
      setPipPopKeys(prev => { const n = [...prev]; n[ns - 1]++; return n })
      setGreenPulseKey(k => k + 1)
      setMeterFlashKind('hit')
      setMeterFlashKey(k => k + 1)

      if (ns >= 3) {
        doneRef.current = true
        setDone(true)
        setFeedbackKind('tamed')
        setFeedbackKey(k => k + 1)
        setTimeout(() => onSuccess(), 1300)
      } else {
        setFeedbackKind('hit')
        setFeedbackKey(k => k + 1)
        setTimeout(() => {
          setFeedbackKind('none')
          setMeterFlashKind(null)
          pausedRef.current = false
        }, 560)
      }
    } else {
      streakRef.current = 0
      setStreak(0)
      setFeedbackKind('miss')
      setFeedbackKey(k => k + 1)
      setMeterFlashKind('miss')
      setMeterFlashKey(k => k + 1)
      // Reset cursor to centre (sin(0) = 0 → pos = 0.5)
      timeRef.current  = 0
      lastTsRef.current = null

      setTimeout(() => {
        setFeedbackKind('none')
        setMeterFlashKind(null)
        pausedRef.current = false
      }, 690)
    }
  }, [greenStart, greenEnd, onSuccess])

  const creatureSvg = CREATURE_SVGS[creatureTypeId]
  const toolSvg     = TOOL_SVGS[tool.id]

  return (
    <>
      <style>{STYLES}</style>

      {/* Full-screen overlay */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        backgroundColor: 'rgba(10, 6, 2, 0.86)',
        backdropFilter: 'blur(1px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
      }}>
        {/* Modal panel */}
        <div style={{
          width: '100%', maxWidth: '460px',
          backgroundColor: 'var(--pip-bg)',
          border: '2px solid var(--pip-border)',
          borderRadius: '3px',
          boxShadow: '0 0 48px rgba(0,0,0,0.7)',
          animation: 'modalSlideIn 220ms ease-out both',
          overflow: 'hidden',
        }}>

          {/* Title bar */}
          <div style={{
            background: 'var(--pip-border)', padding: '5px 14px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span className="font-display" style={{ color: 'var(--pip-bg-light)', fontSize: '0.7rem', letterSpacing: '0.18em' }}>
              TAMING OPERATION
            </span>
            <span className="font-mono" style={{ color: 'var(--pip-bg-light)', fontSize: '0.6rem', opacity: 0.65 }}>
              STREAK [{streak}/3]
            </span>
          </div>

          <div style={{ padding: '20px 22px 18px' }}>

            {/* Creature display */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', marginBottom: '16px' }}>
              {creatureSvg ? (
                <svg
                  viewBox="0 0 48 48" width="80" height="80"
                  style={{
                    color: done ? 'var(--pip-green)' : 'var(--pip-amber)',
                    transition: 'color 800ms ease, filter 800ms ease',
                    animation: done ? 'none' : 'creatureThrob 2.2s ease-in-out infinite',
                    filter: done ? 'drop-shadow(0 0 14px var(--pip-green))' : undefined,
                  }}
                  dangerouslySetInnerHTML={{ __html: creatureSvg }}
                />
              ) : (
                <div style={{ width: 80, height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem', color: 'var(--pip-amber)' }}>
                  ?
                </div>
              )}
              <div className="font-display" style={{ color: 'var(--pip-green)', fontSize: '1.15rem', letterSpacing: '0.05em' }}>
                {creatureName}
              </div>
              <div className="font-mono" style={{ color: 'var(--pip-green-dim)', fontSize: '0.62rem', letterSpacing: '0.13em' }}>
                {done ? '— SUBDUED —' : '— CORNERED & WEAKENED —'}
              </div>
            </div>

            {/* Feedback label — fixed height to prevent layout shifts */}
            <div style={{ height: '2.4rem', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '5px' }}>
              {feedbackKind === 'hit' && (
                <span key={`hit-${feedbackKey}`} className="font-display" style={{
                  position: 'absolute', color: 'var(--pip-green)', fontSize: '1.6rem', letterSpacing: '0.06em',
                  animation: 'feedbackFadeUp 530ms ease-out forwards',
                }}>
                  HIT
                </span>
              )}
              {feedbackKind === 'miss' && (
                <span key={`miss-${feedbackKey}`} className="font-display" style={{
                  position: 'absolute', color: 'var(--pip-red)', fontSize: '1.3rem', letterSpacing: '0.06em',
                  animation: 'feedbackFadeUp 610ms ease-out forwards',
                }}>
                  MISS
                </span>
              )}
              {feedbackKind === 'tamed' && (
                <span key={`tamed-${feedbackKey}`} className="font-display" style={{
                  position: 'absolute',
                  color: 'var(--pip-green)', fontSize: '2.2rem', letterSpacing: '0.1em',
                  animation: 'tamedAppear 900ms ease-out forwards',
                  textShadow: '0 0 28px var(--pip-green)',
                }}>
                  TAMED!
                </span>
              )}
            </div>

            {/* Tool label row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              {toolSvg && (
                <svg viewBox="0 0 32 32" width="26" height="26"
                  style={{ color: 'var(--pip-green)', flexShrink: 0 }}
                  dangerouslySetInnerHTML={{ __html: toolSvg }}
                />
              )}
              <div>
                <div className="pip-label" style={{ fontSize: '0.57rem', lineHeight: 1 }}>ACTIVE TOOL</div>
                <div className="font-display" style={{ color: 'var(--pip-green)', fontSize: '0.82rem' }}>{tool.name}</div>
              </div>
              <div style={{ flex: 1 }} />
              <div className="font-mono" style={{ color: 'var(--pip-green-dim)', fontSize: '0.6rem', textAlign: 'right', lineHeight: 1.45 }}>
                STOP NEEDLE<br />IN GREEN ZONE
              </div>
            </div>

            {/* Meter rail */}
            <div style={{
              position: 'relative', height: '38px',
              backgroundColor: 'rgba(15,10,2,0.65)',
              border: '1px solid var(--pip-border)',
              borderRadius: '2px',
              overflow: 'hidden',
              marginBottom: '10px',
            }}>
              {/* Tick marks */}
              {[10, 20, 30, 40, 50, 60, 70, 80, 90].map(pct => (
                <div key={pct} style={{
                  position: 'absolute', left: `${pct}%`, top: 0, bottom: 0,
                  width: '1px', backgroundColor: 'rgba(138,96,32,0.22)',
                }} />
              ))}

              {/* Green zone — remounts on pulse to restart CSS animation */}
              <div
                key={`gz-${greenPulseKey}`}
                style={{
                  position: 'absolute',
                  left: `${greenStart * 100}%`,
                  width: `${tool.greenWindowFraction * 100}%`,
                  top: 0, bottom: 0,
                  backgroundColor: 'rgba(44,74,16,0.28)',
                  borderLeft: '1px solid rgba(44,74,16,0.65)',
                  borderRight: '1px solid rgba(44,74,16,0.65)',
                  animation: greenPulseKey > 0 ? 'greenZonePulse 520ms ease-out' : 'none',
                }}
              />

              {/* Hit/miss flash overlay — remounts on each flash */}
              {meterFlashKind && (
                <div
                  key={`mf-${meterFlashKey}`}
                  style={{
                    position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 4,
                    animation: meterFlashKind === 'hit'
                      ? 'meterHitFlash 500ms ease-out forwards'
                      : 'meterMissFlash 660ms ease-out forwards',
                  }}
                />
              )}

              {/* Bouncing needle */}
              {!done && (
                <div style={{
                  position: 'absolute',
                  left: `${cursorPos * 100}%`,
                  top: '3px', bottom: '3px',
                  width: '3px',
                  backgroundColor: 'var(--pip-amber)',
                  borderRadius: '1px',
                  transform: 'translateX(-50%)',
                  zIndex: 5,
                  animation: 'needleGlow 950ms ease-in-out infinite',
                }} />
              )}
            </div>

            {/* Streak pip indicators */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '14px', marginBottom: '16px' }}>
              {[0, 1, 2].map(i => {
                const filled = i < streak
                return (
                  <div
                    key={`pip-${i}-${pipPopKeys[i]}`}
                    style={{
                      width: '18px', height: '18px',
                      borderRadius: '50%',
                      border: `2px solid ${filled ? 'var(--pip-amber)' : 'var(--pip-border)'}`,
                      backgroundColor: filled ? 'var(--pip-amber)' : 'transparent',
                      transition: 'background-color 160ms, border-color 160ms',
                      animation: pipPopKeys[i] > 0 ? 'pipPop 330ms ease-out' : 'none',
                    }}
                  />
                )
              })}
            </div>

            {/* Flavour instruction */}
            <div className="font-mono" style={{
              color: 'var(--pip-green-dim)', fontSize: '0.6rem', textAlign: 'center',
              marginBottom: '14px', letterSpacing: '0.04em',
            }}>
              {TOOL_FLAVOUR[tool.id] ?? 'Stop the needle in the green zone 3 times in a row'}
            </div>

            {/* Action buttons */}
            {!done && (
              <>
                <button
                  className="pip-btn-amber"
                  onClick={handleStop}
                  style={{ width: '100%', fontSize: '1.55rem', padding: '10px 0', letterSpacing: '0.22em', marginBottom: '10px' }}
                >
                  STOP
                </button>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    className="pip-btn-danger"
                    onClick={onAbandon}
                    style={{ fontSize: '0.7rem', padding: '4px 10px', letterSpacing: '0.05em' }}
                  >
                    ABANDON
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
