/**
 * Absolutely-positioned "damage number" popup inside a `position: relative` container,
 * sibling to FlashOverlay. Mounting a new element (via key increment) restarts the CSS
 * animation cleanly. Rendered above the icon, drifts up, fades out.
 */

export interface FloatLine {
  text: string
  color: string   // CSS color/var, e.g. 'var(--pip-red)'
}

const FLOAT_CSS = `
  @keyframes pip-float-combat-text {
    0%   { transform: translate(-50%, 4px);   opacity: 0; }
    12%  { opacity: 1; }
    100% { transform: translate(-50%, -16px); opacity: 0; }
  }
`

interface Props {
  flashKey: number
  lines: FloatLine[]
  duration?: number   // ms, default 850
}

export function FloatingCombatText({ flashKey, lines, duration = 850 }: Props) {
  if (flashKey === 0 || lines.length === 0) return null
  return (
    <>
      <style>{FLOAT_CSS}</style>
      <div
        key={flashKey}
        style={{
          position:      'absolute',
          top:           '8%',
          left:          '50%',
          pointerEvents: 'none',
          userSelect:    'none',
          whiteSpace:    'nowrap',
          animation:     `pip-float-combat-text ${duration}ms ease-out forwards`,
          zIndex:        6,
        }}
      >
        {lines.map((line, i) => (
          <div
            key={i}
            className="font-display font-bold text-center leading-tight"
            style={{ fontSize: '0.7rem', color: line.color, textShadow: '0 1px 2px rgba(0,0,0,0.7)' }}
          >
            {line.text}
          </div>
        ))}
      </div>
    </>
  )
}
