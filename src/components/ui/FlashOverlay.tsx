/**
 * Absolutely-positioned overlay inside a `position: relative` container.
 * Mounting a new element (via key increment) restarts the CSS animation cleanly,
 * so spam-clicking never stacks or glitches.
 */

export type FlashOverlayVariant = 'buy' | 'sell' | 'heal' | 'damage' | 'gain'

const VARIANT_COLOR: Record<FlashOverlayVariant, string> = {
  buy:    'rgba(57,  255, 20,  0.16)',
  heal:   'rgba(57,  255, 20,  0.16)',
  sell:   'rgba(255, 51,  51,  0.18)',
  damage: 'rgba(255, 51,  51,  0.20)',
  gain:   'rgba(255, 170, 0,   0.14)',
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
