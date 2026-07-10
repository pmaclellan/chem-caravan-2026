import type { ReactNode } from 'react'
import type { GuardUnit, PAGuardUnit } from '../../types/game'
import { FlashOverlay } from '../ui/FlashOverlay'
import BuffBadge from './BuffBadge'
import type { BuffInfo } from './buffInfo'

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
  @keyframes guardCardSelectablePulse {
    0%, 100% { box-shadow: 0 0 0 2px var(--select-color); }
    50%      { box-shadow: 0 0 6px 2px var(--select-color); }
  }
`

interface Props {
  unit: GuardUnit | PAGuardUnit
  label: string             // class name, e.g. "STANDARD", "MEDIC" ("PA" for power armor)
  color: string              // CSS var, e.g. 'var(--pip-green)'
  icon: ReactNode
  fireFlashKey: number        // this unit fired at an enemy
  damageFlashKey: number      // this unit took a hit
  dodgeFlashKey: number       // this unit dodged an attack
  buff?: BuffInfo | null      // active Jet/Ultrajet accuracy buff, if any
  reloadRoundsRemaining?: number  // sniper cooldown — rounds left before next shot, 0/undefined = ready
  armorPoints?: number         // PA guards only — current armor, absorbs damage before health
  maxArmorPoints?: number      // PA guards only
  selectable?: boolean         // true while a chem is armed and this unit is a valid target
  selectColor?: string         // ring color while selectable — the armed chem's color
  onSelect?: () => void        // click handler, only wired up while selectable
}

export default function GuardUnitCard({ unit, label, color, icon, fireFlashKey, damageFlashKey, dodgeFlashKey, buff, reloadRoundsRemaining, armorPoints, maxArmorPoints, selectable, selectColor, onSelect }: Props) {
  const dead = unit.dead
  const reloading = !dead && (reloadRoundsRemaining ?? 0) > 0
  const hpPct = unit.maxHealth > 0 ? Math.max(0, Math.round((unit.health / unit.maxHealth) * 100)) : 0
  const hpColor = hpPct > 50 ? 'var(--pip-green)' : hpPct > 25 ? 'var(--pip-amber)' : 'var(--pip-red)'
  const apPct = maxArmorPoints && maxArmorPoints > 0 ? Math.max(0, Math.round((armorPoints! / maxArmorPoints) * 100)) : null

  return (
    <div
      className={`flex flex-col items-center gap-1 ${selectable ? 'cursor-pointer hover:scale-105 transition-transform' : ''}`}
      style={{ width: '3rem', opacity: dead ? 0.35 : reloading ? 0.55 : 1, filter: dead ? 'grayscale(1)' : 'none', transition: 'opacity 400ms, filter 400ms' }}
      onClick={selectable ? onSelect : undefined}
      role={selectable ? 'button' : undefined}
      title={selectable ? 'Apply here' : reloading ? `Reloading — ${reloadRoundsRemaining} round${reloadRoundsRemaining! > 1 ? 's' : ''} left` : undefined}
    >
      {(fireFlashKey > 0 || dodgeFlashKey > 0 || selectable) && <style>{GUARD_CARD_CSS}</style>}
      <div
        key={dodgeFlashKey > 0 ? `dodge-${dodgeFlashKey}` : 'still'}
        className="relative w-10 h-10 border rounded flex items-center justify-center"
        style={{
          borderColor: selectable ? selectColor : reloading ? 'var(--pip-amber)' : color,
          borderStyle: reloading ? 'dashed' : 'solid',
          animation: dodgeFlashKey > 0 ? 'guardCardDodge 420ms ease-out' : selectable ? 'guardCardSelectablePulse 1.1s ease-in-out infinite' : 'none',
          ...( selectable ? { '--select-color': selectColor } as React.CSSProperties : {} ),
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
        {!dead && buff && <BuffBadge color={buff.color} roundsRemaining={buff.roundsRemaining} label={buff.label} />}
        {reloading && <BuffBadge kind="reload" color="var(--pip-amber)" roundsRemaining={reloadRoundsRemaining!} label="Reloading" />}
      </div>
      <div className="h-1 w-full rounded overflow-hidden" style={{ backgroundColor: 'var(--pip-border-dim)' }}>
        {!dead && <div className="h-full transition-all duration-500" style={{ width: `${hpPct}%`, backgroundColor: hpColor }} />}
      </div>
      {apPct !== null && (
        <div className="h-1 w-full rounded overflow-hidden" style={{ backgroundColor: 'var(--pip-border-dim)' }}>
          {!dead && <div className="h-full transition-all duration-500" style={{ width: `${apPct}%`, backgroundColor: 'var(--pip-blue)' }} />}
        </div>
      )}
      <div className="text-center leading-tight" style={{ fontSize: '0.55rem', color: reloading ? 'var(--pip-amber)' : color, opacity: 0.7 }}>
        {reloading ? `RELOAD ${reloadRoundsRemaining}t` : label}
      </div>
    </div>
  )
}
