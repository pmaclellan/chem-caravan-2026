import { FlashOverlay } from '../ui/FlashOverlay'
import { FloatingCombatText, type FloatLine } from '../ui/FloatingCombatText'
import BuffBadge from './BuffBadge'
import type { BuffInfo } from './buffInfo'

const PLAYER_ICON_PATH = 'M6.02958 19.4012C5.97501 19.9508 6.3763 20.4405 6.92589 20.4951C7.47547 20.5497 7.96523 20.1484 8.01979 19.5988L6.02958 19.4012ZM15.9802 19.5988C16.0348 20.1484 16.5245 20.5497 17.0741 20.4951C17.6237 20.4405 18.025 19.9508 17.9704 19.4012L15.9802 19.5988ZM20 12C20 16.4183 16.4183 20 12 20V22C17.5228 22 22 17.5228 22 12H20ZM12 20C7.58172 20 4 16.4183 4 12H2C2 17.5228 6.47715 22 12 22V20ZM4 12C4 7.58172 7.58172 4 12 4V2C6.47715 2 2 6.47715 2 12H4ZM12 4C16.4183 4 20 7.58172 20 12H22C22 6.47715 17.5228 2 12 2V4ZM13 10C13 10.5523 12.5523 11 12 11V13C13.6569 13 15 11.6569 15 10H13ZM12 11C11.4477 11 11 10.5523 11 10H9C9 11.6569 10.3431 13 12 13V11ZM11 10C11 9.44772 11.4477 9 12 9V7C10.3431 7 9 8.34315 9 10H11ZM12 9C12.5523 9 13 9.44772 13 10H15C15 8.34315 13.6569 7 12 7V9ZM8.01979 19.5988C8.22038 17.5785 9.92646 16 12 16V14C8.88819 14 6.33072 16.3681 6.02958 19.4012L8.01979 19.5988ZM12 16C14.0735 16 15.7796 17.5785 15.9802 19.5988L17.9704 19.4012C17.6693 16.3681 15.1118 14 12 14V16Z'

// Self-contained, like GuardUnitCard's own GUARD_CARD_CSS — only injected when a
// keyframe it defines is actually about to be used, so a static/snapshot render
// (all flash keys 0, not selectable) never pulls this in at all.
const PLAYER_CARD_CSS = `
  @keyframes playerCardFire {
    0%   { opacity: 0; box-shadow: none; }
    20%  { opacity: 1; box-shadow: 0 0 16px var(--pip-amber), inset 0 0 8px rgba(196,100,26,0.4); transform: scale(1.12); }
    65%  { opacity: 0.7; box-shadow: 0 0 8px var(--pip-amber); transform: scale(1.04); }
    100% { opacity: 0; box-shadow: none; transform: scale(1); }
  }
  @keyframes playerCardDodge {
    0%   { transform: translateX(0);    }
    30%  { transform: translateX(10px); }
    65%  { transform: translateX(-2px); }
    85%  { transform: translateX(1px);  }
    100% { transform: translateX(0);    }
  }
  @keyframes playerCardSelectablePulse {
    0%, 100% { box-shadow: 0 0 0 2px var(--select-color); }
    50%      { box-shadow: 0 0 6px 2px var(--select-color); }
  }
`

interface Props {
  health: number
  maxHealth: number
  armorPoints?: number      // omit (or maxArmorPoints undefined) when the player has no armor equipped
  maxArmorPoints?: number
  fireFlashKey?: number      // player fired at an enemy
  damageFlashKey?: number    // player took a hit
  dodgeFlashKey?: number     // player dodged an attack
  buff?: BuffInfo | null     // active Jet/Ultrajet accuracy buff, if any
  reloadRoundsRemaining?: number
  selectable?: boolean        // true while a chem is armed and the player is a valid target
  selectColor?: string
  onSelect?: () => void
  floatKey?: number            // "-X AP" / "-X HP" / "MISS" popup
  floatLines?: FloatLine[]
}

// The player's own mini-card in the Caravan row — used both live (CombatPanel, with
// animation/click-to-target-a-chem) and as a static post-combat snapshot (CombatSummaryPanel).
export default function PlayerCaravanCard({
  health, maxHealth, armorPoints, maxArmorPoints,
  fireFlashKey = 0, damageFlashKey = 0, dodgeFlashKey = 0,
  buff, reloadRoundsRemaining = 0, selectable, selectColor, onSelect,
  floatKey = 0, floatLines = [],
}: Props) {
  const hpPct = maxHealth > 0 ? Math.max(0, Math.round((health / maxHealth) * 100)) : 0
  const hpColor = hpPct > 50 ? 'var(--pip-green)' : hpPct > 25 ? 'var(--pip-amber)' : 'var(--pip-red)'
  const hasArmor = maxArmorPoints !== undefined && maxArmorPoints > 0
  const apPct = hasArmor ? Math.max(0, Math.round(((armorPoints ?? 0) / maxArmorPoints!) * 100)) : 0
  const reloading = reloadRoundsRemaining > 0

  return (
    <div
      className={`flex flex-col items-center gap-1 ${selectable ? 'cursor-pointer hover:scale-105 transition-transform' : ''}`}
      style={{ width: '3rem', opacity: reloading ? 0.55 : 1, transition: 'opacity 400ms' }}
      onClick={selectable ? onSelect : undefined}
      role={selectable ? 'button' : undefined}
      title={selectable ? 'Apply here' : reloading ? `Reloading — ${reloadRoundsRemaining} round${reloadRoundsRemaining > 1 ? 's' : ''} left` : undefined}
    >
      {(fireFlashKey > 0 || dodgeFlashKey > 0 || selectable) && <style>{PLAYER_CARD_CSS}</style>}
      <div
        key={dodgeFlashKey > 0 ? `dodge-${dodgeFlashKey}` : 'still'}
        className="relative w-10 h-10 border rounded flex items-center justify-center"
        style={{
          borderColor: selectable ? selectColor : 'var(--pip-amber)',
          borderStyle: reloading ? 'dashed' : 'solid',
          animation: dodgeFlashKey > 0 ? 'playerCardDodge 420ms ease-out' : selectable ? 'playerCardSelectablePulse 1.1s ease-in-out infinite' : 'none',
          ...( selectable ? { '--select-color': selectColor } as React.CSSProperties : {} ),
        }}
      >
        {fireFlashKey > 0 && (
          <div
            key={`fire-${fireFlashKey}`}
            style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', pointerEvents: 'none', animation: 'playerCardFire 400ms ease-out forwards', zIndex: 2 }}
          />
        )}
        <FlashOverlay flashKey={damageFlashKey} variant="damage" />
        <FloatingCombatText flashKey={floatKey} lines={floatLines} />
        <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor" style={{ color: 'var(--pip-amber)' }}>
          <path d={PLAYER_ICON_PATH} />
        </svg>
        {buff && <BuffBadge color={buff.color} roundsRemaining={buff.roundsRemaining} label={buff.label} />}
        {reloading && <BuffBadge kind="reload" color="var(--pip-amber)" roundsRemaining={reloadRoundsRemaining} label="Reloading" />}
      </div>
      <div className="h-1 w-full rounded overflow-hidden" style={{ backgroundColor: 'var(--pip-border-dim)' }}>
        <div className="h-full transition-all duration-500" style={{ width: `${hpPct}%`, backgroundColor: hpColor }} />
      </div>
      {hasArmor && (
        <div className="h-1 w-full rounded overflow-hidden" style={{ backgroundColor: 'var(--pip-border-dim)' }}>
          <div className="h-full transition-all duration-500" style={{ width: `${apPct}%`, backgroundColor: 'var(--pip-blue)' }} />
        </div>
      )}
      <div className="text-center" style={{ fontSize: '0.6rem', color: 'var(--pip-amber)', opacity: 0.7 }}>
        {reloading ? `RELOAD ${reloadRoundsRemaining}t` : 'YOU'}
      </div>
    </div>
  )
}
