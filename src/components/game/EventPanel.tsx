import type { TravelEvent, PlayerState } from '../../types/game'
import { CHEMS } from '../../data/chems'
import { useGameStore } from '../../store/gameStore'

interface Props { event: TravelEvent; player: PlayerState }

export default function EventPanel({ event, player }: Props) {
  const resolveEvent = useGameStore(s => s.resolveEvent)

  const runChance = Math.round(
    Math.min(0.9, Math.max(0.1, 0.40 + player.guards * 0.10 - player.brahmin * 0.05)) * 100
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="text-pip-red font-display text-2xl border-b border-pip-border pb-2">
        !! {event.title} !!
      </div>

      <div className="border border-pip-border p-4 rounded bg-pip-border-dim">
        <p className="text-pip-green text-sm">{event.description}</p>
      </div>

      {event.type === 'raider_ambush' && (
        <div className="flex gap-3">
          <button className="pip-btn-danger flex-1" onClick={() => resolveEvent('fight')}>
            FIGHT
          </button>
          <button className="pip-btn-amber flex-1" onClick={() => resolveEvent('run')}>
            RUN ({runChance}% chance)
          </button>
        </div>
      )}

      {event.type === 'chem_stash' && (() => {
        const { chemId, qty } = event.payload as { chemId: string; qty: number }
        return (
          <div className="flex flex-col gap-2">
            <div className="text-pip-amber font-display text-lg">
              Found: {qty}× {CHEMS[chemId]?.name ?? chemId}
            </div>
            <button className="pip-btn" onClick={() => resolveEvent('take')}>TAKE THE CHEMS</button>
          </div>
        )
      })()}

      {event.type === 'brahmin_lost' && (
        <div className="flex flex-col gap-2">
          <div className="text-pip-red text-sm">One of your brahmin bolted into the wastes. Inventory space reduced.</div>
          <button className="pip-btn" onClick={() => resolveEvent('continue')}>KEEP MOVING</button>
        </div>
      )}

      {event.type === 'debt_collector' && (
        <div className="flex flex-col gap-2">
          <div className="text-pip-red text-sm">The Triggermen are collecting. There's no reasoning with them.</div>
          <button className="pip-btn-danger" onClick={() => resolveEvent('endure')}>TAKE THE BEATING</button>
        </div>
      )}

      {event.type === 'brotherhood_checkpoint' && (() => {
        const { toll } = event.payload as { toll: number }
        return (
          <div className="flex flex-col gap-3">
            <div className="text-pip-green-dim text-sm">
              The Brotherhood demands {toll} caps to pass. You can pay or turn back.
            </div>
            <div className="flex gap-3">
              <button
                className="pip-btn flex-1"
                disabled={player.caps < toll}
                onClick={() => resolveEvent('pay')}
              >
                PAY TOLL ({toll} ¤)
              </button>
              <button className="pip-btn-amber flex-1" onClick={() => resolveEvent('refuse')}>
                TURN BACK
              </button>
            </div>
          </div>
        )
      })()}

      {event.type === 'wandering_merchant' && (() => {
        const { prices } = event.payload as { prices: Record<string, number>; stock: Record<string, number> }
        return (
          <div className="flex flex-col gap-2">
            <div className="text-pip-green-dim text-sm">The merchant has a few things for sale at premium prices.</div>
            {Object.entries(prices).map(([chemId, price]) => (
              <div key={chemId} className="flex justify-between text-sm">
                <span>{CHEMS[chemId]?.name ?? chemId}</span>
                <span className="text-pip-amber">{price} ¤</span>
              </div>
            ))}
            <button className="pip-btn" onClick={() => resolveEvent('continue')}>PASS MERCHANT</button>
          </div>
        )
      })()}
    </div>
  )
}
