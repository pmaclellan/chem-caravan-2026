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

      {quote ? (
        <div className="max-w-lg w-full text-center">
          <div
            className="border-t border-b border-pip-border py-6 px-4"
            style={{ borderColor: 'rgba(138, 96, 32, 0.45)' }}
          >
            <p className="font-display text-pip-green leading-relaxed" style={{ fontSize: '1.15rem' }}>
              "{quote.text}"
            </p>
          </div>
          <p className="text-pip-green-dim text-xs mt-3 italic">
            — {quote.speaker}, overheard on the road
          </p>
        </div>
      ) : (
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
