import { FlashOverlay } from '../ui/FlashOverlay'
import { FloatingCombatText, type FloatLine } from '../ui/FloatingCombatText'
import { ENEMY_SVGS, MOUNT_ICONS } from './enemySvgs'

// Self-contained like PlayerCaravanCard/GuardUnitCard — only injected when actually needed.
const MOUNT_CARD_CSS = `
  @keyframes mountCardFire {
    0%   { opacity: 0; box-shadow: none; }
    20%  { opacity: 1; box-shadow: 0 0 18px var(--pip-amber), inset 0 0 10px rgba(196,80,26,0.45); transform: scale(1.14); }
    65%  { opacity: 0.7; box-shadow: 0 0 10px var(--pip-amber); transform: scale(1.05); }
    100% { opacity: 0; box-shadow: none; transform: scale(1); }
  }
  @keyframes mountCardDodge {
    0%   { transform: translateX(0);    }
    30%  { transform: translateX(10px); }
    65%  { transform: translateX(-2px); }
    85%  { transform: translateX(1px);  }
    100% { transform: translateX(0);    }
  }
`

interface Props {
  creatureTypeId: string
  health: number
  maxHealth: number
  dead: boolean
  fireFlashKey?: number
  damageFlashKey?: number
  dodgeFlashKey?: number
  floatKey?: number     // "-X HP" / "MISS" popup
  floatLines?: FloatLine[]
}

// The tamed mount's mini-card in the Caravan row — used both live (CombatPanel)
// and as a static post-combat snapshot (CombatSummaryPanel).
export default function MountCaravanCard({ creatureTypeId, health, maxHealth, dead, fireFlashKey = 0, damageFlashKey = 0, dodgeFlashKey = 0, floatKey = 0, floatLines = [] }: Props) {
  const hpPct = maxHealth > 0 ? Math.max(0, Math.round((health / maxHealth) * 100)) : 0
  const hpColor = hpPct > 50 ? 'var(--pip-green)' : hpPct > 25 ? 'var(--pip-amber)' : 'var(--pip-red)'
  const mountIconFile = MOUNT_ICONS[creatureTypeId]
  const mountSvg = ENEMY_SVGS[creatureTypeId] ?? ''

  return (
    <div
      className="flex flex-col items-center gap-1"
      style={{ width: '3rem', opacity: dead ? 0.35 : 1, filter: dead ? 'grayscale(1)' : 'none', transition: 'opacity 400ms, filter 400ms' }}
    >
      {(fireFlashKey > 0 || dodgeFlashKey > 0) && <style>{MOUNT_CARD_CSS}</style>}
      <div
        key={dodgeFlashKey > 0 ? `dodge-${dodgeFlashKey}` : 'still'}
        className="relative w-10 h-10 border rounded flex items-center justify-center"
        style={{ borderColor: 'var(--pip-amber)', animation: dodgeFlashKey > 0 ? 'mountCardDodge 420ms ease-out' : 'none' }}
      >
        {!dead && fireFlashKey > 0 && (
          <div
            key={`fire-${fireFlashKey}`}
            style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', pointerEvents: 'none', animation: 'mountCardFire 420ms ease-out forwards', zIndex: 2 }}
          />
        )}
        <FlashOverlay flashKey={damageFlashKey} variant="damage" />
        <FloatingCombatText flashKey={floatKey} lines={floatLines} />
        {mountIconFile ? (
          <img src={mountIconFile} alt="" className="w-7 h-7" style={{ opacity: 0.85 }} />
        ) : (
          <svg viewBox="0 0 48 48" className="w-7 h-7" style={{ color: 'var(--pip-amber)' }}
            dangerouslySetInnerHTML={{ __html: mountSvg }}
          />
        )}
      </div>
      <div className="h-1 w-full rounded overflow-hidden" style={{ backgroundColor: 'var(--pip-border-dim)' }}>
        <div className="h-full transition-all duration-500" style={{ width: `${hpPct}%`, backgroundColor: hpColor }} />
      </div>
      <div className="text-center" style={{ fontSize: '0.6rem', color: 'var(--pip-amber)', opacity: 0.7 }}>MOUNT</div>
    </div>
  )
}
