import type { EnemyUnit } from '../../types/game'
import { FlashOverlay } from '../ui/FlashOverlay'
import { ENEMY_SVGS, ENEMY_FALLBACK_SVG } from './enemySvgs'

const ENEMY_ANIM_CSS = `
  @keyframes enemyStagger {
    0%   { transform: translateX(0)     rotate(0deg);   }
    18%  { transform: translateX(-7px)  rotate(-3deg);  }
    40%  { transform: translateX(5px)   rotate(2deg);   }
    62%  { transform: translateX(-3px)  rotate(-1deg);  }
    82%  { transform: translateX(2px)   rotate(0.5deg); }
    100% { transform: translateX(0)     rotate(0deg);   }
  }
  @keyframes enemyDodge {
    0%   { transform: translateX(0)    rotate(0deg);   }
    25%  { transform: translateX(9px)  rotate(4deg);   }
    55%  { transform: translateX(-3px) rotate(-1deg);  }
    80%  { transform: translateX(1px)  rotate(0.5deg); }
    100% { transform: translateX(0)    rotate(0deg);   }
  }
`

interface Props {
  unit: EnemyUnit
  flashKey: number
  isHit?: boolean    // play stagger on mount when true
  isDodge?: boolean  // play dodge on mount when true
}

export default function EnemyUnitCard({ unit, flashKey, isHit, isDodge }: Props) {
  const hpPct = unit.maxHealth > 0
    ? Math.max(0, Math.round((unit.health / unit.maxHealth) * 100))
    : 0
  const svgContent = ENEMY_SVGS[unit.typeId] ?? ENEMY_FALLBACK_SVG

  const animation = isHit   ? 'enemyStagger 380ms ease-out'
                  : isDodge ? 'enemyDodge 300ms ease-out'
                  : 'none'

  return (
    <>
      {(isHit || isDodge) && <style>{ENEMY_ANIM_CSS}</style>}
      <div
        className="flex flex-col items-center gap-1 min-w-0"
        style={{
          filter: unit.dead ? 'grayscale(1)' : 'none',
          opacity: unit.dead ? 0.4 : 1,
          transition: 'opacity 300ms, filter 300ms',
          animation,
        }}
      >
        {/* Icon + flash */}
        <div className="relative w-12 h-12 flex items-center justify-center">
          <FlashOverlay flashKey={flashKey} variant="damage" duration={400} />
          <svg
            viewBox="0 0 48 48"
            className="w-10 h-10"
            style={{ color: 'var(--pip-green)' }}
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: svgContent }}
          />
          {unit.dead && (
            <span
              className="absolute inset-0 flex items-center justify-center text-2xl"
              style={{ color: 'var(--pip-red)' }}
              title="Dead"
            >
              ☠
            </span>
          )}
        </div>

        {/* HP bar */}
        <div className="w-full h-1.5 bg-pip-border-dim rounded overflow-hidden">
          {!unit.dead && (
            <div
              className="h-full bg-pip-red transition-all duration-300"
              style={{ width: `${hpPct}%` }}
            />
          )}
        </div>

        {/* Name */}
        <div className="text-pip-green-dim text-xs text-center leading-tight max-w-full truncate px-0.5">
          {unit.name}
        </div>
      </div>
    </>
  )
}
