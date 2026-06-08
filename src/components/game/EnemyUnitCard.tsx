import type { EnemyUnit } from '../../types/game'
import { FlashOverlay } from '../ui/FlashOverlay'
import { ENEMY_SVGS, ENEMY_FALLBACK_SVG } from './enemySvgs'

interface Props {
  unit: EnemyUnit
  flashKey: number
}

export default function EnemyUnitCard({ unit, flashKey }: Props) {
  const hpPct = unit.maxHealth > 0
    ? Math.max(0, Math.round((unit.health / unit.maxHealth) * 100))
    : 0
  const svgContent = ENEMY_SVGS[unit.typeId] ?? ENEMY_FALLBACK_SVG

  return (
    <div
      className="flex flex-col items-center gap-1 min-w-0"
      style={{
        filter: unit.dead ? 'grayscale(1)' : 'none',
        opacity: unit.dead ? 0.4 : 1,
        transition: 'opacity 300ms, filter 300ms',
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
  )
}
