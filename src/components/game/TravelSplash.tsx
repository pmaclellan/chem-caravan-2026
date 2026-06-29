import { useEffect } from 'react'
import type { TransitQuote } from '../../types/game'
import { GAME_MODES } from '../../data/modes'
import { useGameStore } from '../../store/gameStore'

interface Props {
  quote: TransitQuote | null
  destination: string
}

export default function TravelSplash({ quote, destination }: Props) {
  const continueTravel = useGameStore(s => s.continueTravel)
  const mode = useGameStore(s => s.gameState?.mode ?? 'commonwealth')
  const mc = GAME_MODES[mode]
  const destName = mc.settlements[destination]?.name ?? destination.replace(/_/g, ' ')

  // No quote — auto-advance after 1 s so there's still a visual beat
  useEffect(() => {
    if (!quote) {
      const t = setTimeout(continueTravel, 1000)
      return () => clearTimeout(t)
    }
  }, [quote, continueTravel])

  return (
    <div className="flex flex-col items-center justify-center h-full px-8 py-6 gap-6">
      <div className="text-pip-green-dim text-xs uppercase tracking-widest opacity-60">
        — on the road —
      </div>

      {quote ? (() => {
        const isTip = quote.speaker === 'Omniscient Guide'
        return (
          <div className="max-w-lg w-full text-center">
            {isTip && (
              <div className="flex items-center justify-center gap-2 mb-3">
                <div className="h-px flex-1" style={{ background: 'rgba(196,80,26,0.4)' }} />
                <span className="font-display text-pip-amber text-xs tracking-widest px-2">◈ GUIDE TIP</span>
                <div className="h-px flex-1" style={{ background: 'rgba(196,80,26,0.4)' }} />
              </div>
            )}
            <div
              className="py-6 px-4"
              style={{
                borderTop: isTip ? '1px solid rgba(196,80,26,0.6)' : '1px solid rgba(138,96,32,0.45)',
                borderBottom: isTip ? '1px solid rgba(196,80,26,0.6)' : '1px solid rgba(138,96,32,0.45)',
                background: isTip ? 'rgba(196,80,26,0.05)' : undefined,
              }}
            >
              <p
                className="font-display leading-relaxed"
                style={{
                  fontSize: '1.15rem',
                  color: isTip ? 'var(--pip-amber)' : 'var(--pip-green)',
                }}
              >
                {isTip ? quote.text : `"${quote.text}"`}
              </p>
            </div>
            <p className="text-xs mt-3 italic" style={{ color: isTip ? 'rgba(196,80,26,0.6)' : 'var(--pip-green-dim)' }}>
              {isTip ? '— Omniscient Guide' : `— ${quote.speaker}, overheard on the road`}
            </p>
          </div>
        )
      })() : (
        <div className="text-pip-green-dim text-xs opacity-50">...</div>
      )}

      <div className="flex flex-col items-center gap-3">
        <div className="text-pip-green-dim text-xs">
          Heading to{' '}
          <span className="text-pip-amber font-display">{destName.toUpperCase()}</span>
          <span className="animate-[blink_1s_step-end_infinite]">...</span>
        </div>
        {quote && (
          <button className="pip-btn-amber px-8" onClick={continueTravel}>
            CONTINUE
          </button>
        )}
      </div>
    </div>
  )
}
