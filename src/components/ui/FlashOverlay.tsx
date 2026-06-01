/**
 * Absolutely-positioned overlay inside a `position: relative` container.
 * Mounting a new element (via key increment) restarts the CSS animation cleanly,
 * so spam-clicking never stacks or glitches.
 */

export type FlashOverlayVariant = 'buy' | 'sell' | 'heal' | 'damage' | 'gain'

const VARIANT_COLOR: Record<FlashOverlayVariant, string> = {
  buy:    'rgba(74,  112, 24,  0.22)',   // olive green wash — gaining stock
  heal:   'rgba(74,  112, 24,  0.22)',
  sell:   'rgba(180, 60,  40,  0.22)',   // rust red wash — losing stock
  damage: 'rgba(180, 40,  40,  0.28)',   // stronger rust — taking a hit
  gain:   'rgba(196, 100, 26,  0.22)',   // amber wash — caps/reward
}

interface Props {
  flashKey: number
  variant: FlashOverlayVariant
  duration?: number   // ms, default 380
  zIndex?: number
}

export function FlashOverlay({ flashKey, variant, duration = 380, zIndex = 1 }: Props) {
  if (flashKey === 0) return null
  return (
    <div
      key={flashKey}
      style={{
        position:        'absolute',
        inset:           0,
        pointerEvents:   'none',
        borderRadius:    'inherit',
        backgroundColor: VARIANT_COLOR[variant],
        animation:       `pip-flash-overlay ${duration}ms ease-out forwards`,
        zIndex,
      }}
    />
  )
}
