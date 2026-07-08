import type { ReactNode } from 'react'
import type { GuardUnit, PAGuardUnit } from '../../types/game'
import { FlashOverlay } from '../ui/FlashOverlay'

const GUARD_CARD_CSS = `
  @keyframes guardCardFire {
    0%   { opacity: 0; box-shadow: none; }
    20%  { opacity: 1; box-shadow: 0 0 16px var(--fire-color), inset 0 0 8px var(--fire-color); transform: scale(1.12); }
    65%  { opacity: 0.7; box-shadow: 0 0 8px var(--fire-color); transform: scale(1.04); }
    100% { opacity: 0; box-shadow: none; transform: scale(1); }
  }
  @keyframes guardCardDodge {
    0%   { transform: translateX(0);    }
    30%  { transform: translateX(10px); }
    65%  { transform: translateX(-2px); }
    85%  { transform: translateX(1px);  }
    100% { transform: translateX(0);    }
  }
`

interface Props {
  unit: GuardUnit | PAGuardUnit
  label: string             // "GUARD" or "PA"
  color: string              // CSS var, e.g. 'var(--pip-green)'
  icon: ReactNode
  fireFlashKey: number        // this unit fired at an enemy
  damageFlashKey: number      // this unit took a hit
  dodgeFlashKey: number       // this unit dodged an attack
  buff?: { text: string; color: string } | null  // active Jet/Ultrajet accuracy buff, if any
}

export default function GuardUnitCard({ unit, label, color, icon, fireFlashKey, damageFlashKey, dodgeFlashKey, buff }: Props) {
  const dead = unit.dead
  const hpPct = unit.maxHealth > 0 ? Math.max(0, Math.round((unit.health / unit.maxHealth) * 100)) : 0
  const hpColor = hpPct > 50 ? 'var(--pip-green)' : hpPct > 25 ? 'var(--pip-amber)' : 'var(--pip-red)'

  return (
    <div
      className="flex flex-col items-center gap-1"
      style={{ width: '3rem', opacity: dead ? 0.35 : 1, filter: dead ? 'grayscale(1)' : 'none', transition: 'opacity 400ms, filter 400ms' }}
    >
      {(fireFlashKey > 0 || dodgeFlashKey > 0) && <style>{GUARD_CARD_CSS}</style>}
      <div
        key={dodgeFlashKey > 0 ? `dodge-${dodgeFlashKey}` : 'still'}
        className="relative w-10 h-10 border rounded flex items-center justify-center"
        style={{
          borderColor: color,
          animation: dodgeFlashKey > 0 ? 'guardCardDodge 420ms ease-out' : 'none',
        }}
      >
        {!dead && fireFlashKey > 0 && (
          <div
            key={`fire-${fireFlashKey}`}
            style={{
              position: 'absolute', inset: 0, borderRadius: 'inherit', pointerEvents: 'none',
              animation: 'guardCardFire 400ms ease-out forwards',
              zIndex: 2,
              ...( { '--fire-color': color } as React.CSSProperties ),
            }}
          />
        )}
        <FlashOverlay flashKey={damageFlashKey} variant="damage" />
        {icon}
        {dead && (
          <span className="absolute inset-0 flex items-center justify-center text-xl" style={{ color: 'var(--pip-red)' }} title="Down">☠</span>
        )}
      </div>
      <div className="h-1 w-full rounded overflow-hidden" style={{ backgroundColor: 'var(--pip-border-dim)' }}>
        {!dead && <div className="h-full transition-all duration-500" style={{ width: `${hpPct}%`, backgroundColor: hpColor }} />}
      </div>
      {!dead && buff && (
        <div className="text-center font-mono leading-none" style={{ fontSize: '0.55rem', color: buff.color }}>
          {buff.text}
        </div>
      )}
      <div className="text-center" style={{ fontSize: '0.6rem', color, opacity: 0.7 }}>{label}</div>
    </div>
  )
}
