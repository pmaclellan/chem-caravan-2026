interface Props {
  color: string            // 'var(--pip-amber)' for Jet, 'var(--pip-blue)' for Ultrajet
  roundsRemaining: number
  label: string             // tooltip text, e.g. "Jet — accuracy up"
}

// Small pinned corner badge for a timed buff — a lightning-bolt glyph ringed in the
// buff's color, with a stack-count chip showing rounds remaining. Anchor a relatively
// positioned parent and render this as a child; it positions itself at the top-right corner.
export default function BuffBadge({ color, roundsRemaining, label }: Props) {
  return (
    <div
      className="absolute"
      style={{ top: '-6px', right: '-6px', width: '16px', height: '16px', zIndex: 4 }}
      title={`${label} — ${roundsRemaining} round${roundsRemaining > 1 ? 's' : ''} left`}
    >
      <div
        className="w-full h-full rounded-full flex items-center justify-center"
        style={{ backgroundColor: 'var(--pip-bg-light)', border: `1.5px solid ${color}` }}
      >
        <svg viewBox="0 0 24 24" width="9" height="9" fill={color}>
          <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" />
        </svg>
      </div>
      <div
        className="absolute flex items-center justify-center font-mono"
        style={{
          bottom: '-3px', right: '-3px', width: '10px', height: '10px',
          borderRadius: '50%', backgroundColor: color, color: 'var(--pip-bg-light)',
          fontSize: '7px', lineHeight: 1, fontWeight: 700,
        }}
      >
        {roundsRemaining}
      </div>
    </div>
  )
}
