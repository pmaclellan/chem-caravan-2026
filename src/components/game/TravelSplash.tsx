import type { TransitQuote } from '../../types/game'
import { SETTLEMENTS } from '../../data/settlements'
import { useGameStore } from '../../store/gameStore'

interface Props {
  quote: TransitQuote
  destination: string
}

export default function TravelSplash({ quote, destination }: Props) {
  const continueTravel = useGameStore(s => s.continueTravel)
  const destName = SETTLEMENTS[destination]?.name ?? destination.replace(/_/g, ' ')

  return (
    <div className="flex flex-col items-center justify-center h-full px-8 py-6 gap-6">
      {/* Decorative road marker */}
      <div className="text-pip-green-dim text-xs uppercase tracking-widest opacity-60">
        — on the road —
      </div>

      {/* Quote card */}
      <div className="max-w-lg w-full text-center">
        <div
          className="border-t border-b border-pip-border py-6 px-4"
          style={{ borderColor: 'rgba(138, 96, 32, 0.45)' }}
        >
          <p
            className="font-display text-pip-green leading-relaxed"
            style={{ fontSize: '1.15rem' }}
          >
            "{quote.text}"
          </p>
        </div>
        <p className="text-pip-green-dim text-xs mt-3 italic">
          — {quote.speaker}, overheard on the road
        </p>
      </div>

      {/* Destination + continue */}
      <div className="flex flex-col items-center gap-3">
        <div className="text-pip-green-dim text-xs">
          Heading to{' '}
          <span className="text-pip-amber font-display">{destName.toUpperCase()}</span>
          <span className="animate-[blink_1s_step-end_infinite]">...</span>
        </div>
        <button className="pip-btn-amber px-8" onClick={continueTravel}>
          CONTINUE
        </button>
      </div>
    </div>
  )
}
