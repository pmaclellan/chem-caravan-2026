interface Props {
  color: string            // 'var(--pip-amber)' for Jet, 'var(--pip-blue)' for Ultrajet
  roundsRemaining: number
  label: string             // tooltip text, e.g. "Jet — accuracy up"
  kind?: 'buff' | 'reload'  // buff: lightning bolt, pinned top-right; reload: clock, pinned top-left
}

// Small pinned corner badge for a timed unit status — a glyph ringed in the status's
// color, with a stack-count chip showing rounds remaining. Anchor a relatively
// positioned parent and render this as a child. 'buff' pins top-right (Jet/Ultrajet);
// 'reload' pins top-left (sniper cooldown) so both can be shown on the same card at once.
export default function BuffBadge({ color, roundsRemaining, label, kind = 'buff' }: Props) {
  const corner = kind === 'reload' ? { left: '-6px' } : { right: '-6px' }
  return (
    <div
      className="absolute"
      style={{ top: '-6px', ...corner, width: '16px', height: '16px', zIndex: 4 }}
      title={`${label} — ${roundsRemaining} round${roundsRemaining > 1 ? 's' : ''} left`}
    >
      <div
        className="w-full h-full rounded-full flex items-center justify-center"
        style={{ backgroundColor: 'var(--pip-bg-light)', border: `1.5px solid ${color}` }}
      >
        {kind === 'reload' ? (
          <svg viewBox="0 0 24 24" width="9" height="9" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3.5 2" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="9" height="9" fill={color}>
            <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" />
          </svg>
        )}
      </div>
      <div
        className="absolute flex items-center justify-center font-mono"
        style={{
          bottom: '-3px', ...(kind === 'reload' ? { left: '-3px' } : { right: '-3px' }), width: '10px', height: '10px',
          borderRadius: '50%', backgroundColor: color, color: 'var(--pip-bg-light)',
          fontSize: '7px', lineHeight: 1, fontWeight: 700,
        }}
      >
        {roundsRemaining}
      </div>
    </div>
  )
}
