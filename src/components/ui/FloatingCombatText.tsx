/**
 * Absolutely-positioned "damage number" popup inside a `position: relative` container,
 * sibling to FlashOverlay. No movement — appears quickly, holds, then fades. Mounting a new
 * element (via key increment) restarts the animation cleanly. For a rapid burst, the caller
 * is expected to pass an accumulating running total per event (not per-shot damage), so the
 * number counts up (-20, -40, -60) and the final total is what sticks and fades out.
 */

export interface FloatLine {
  text: string
  color: string   // CSS color/var, e.g. 'var(--pip-red)'
}

const FLOAT_CSS = `
  @keyframes pip-float-combat-text {
    0%   { opacity: 0; }
    10%  { opacity: 1; }
    70%  { opacity: 1; }
    100% { opacity: 0; }
  }
`

interface Props {
  flashKey: number
  lines: FloatLine[]
  duration?: number   // ms, default 1275 (850 * 1.5 — preview-only slowdown, doesn't touch combat step timing yet)
  placement?: 'default' | 'below'   // 'below' for tightly-packed rows (Caravan) where the default
                                     // up-and-right offset overlaps the next card
}

const PLACEMENT_STYLE: Record<'default' | 'below', { top: string; left: string; transform: string }> = {
  default: { top: 'calc(8% - 10px)', left: 'calc(50% + 40px)', transform: 'translateX(-50%)' },
  below:   { top: '100%',            left: '50%',              transform: 'translateX(-50%)' },
}

export function FloatingCombatText({ flashKey, lines, duration = 1275, placement = 'default' }: Props) {
  if (flashKey === 0 || lines.length === 0) return null
  return (
    <>
      <style>{FLOAT_CSS}</style>
      <div
        key={flashKey}
        style={{
          position:      'absolute',
          ...PLACEMENT_STYLE[placement],
          pointerEvents: 'none',
          userSelect:    'none',
          whiteSpace:    'nowrap',
          animation:     `pip-float-combat-text ${duration}ms linear forwards`,
          zIndex:        6,
        }}
      >
        {lines.map((line, i) => (
          <div
            key={i}
            className="font-display font-bold text-center leading-tight"
            style={{ fontSize: '0.7rem', color: line.color }}
          >
            {line.text}
          </div>
        ))}
      </div>
    </>
  )
}
