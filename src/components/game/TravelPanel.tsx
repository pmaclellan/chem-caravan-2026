import type { PlayerState } from '../../types/game'
import { SETTLEMENTS } from '../../data/settlements'
import { getAdjacentRoads, getRoadDestination } from '../../engine/travel'
import { useGameStore } from '../../store/gameStore'

interface Props { player: PlayerState }

function DangerBars({ level }: { level: number }) {
  const bars = Math.round(level * 5)
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <div
          key={i}
          className={`w-2 h-3 rounded-sm ${i <= bars ? (bars >= 4 ? 'bg-pip-red' : bars >= 3 ? 'bg-pip-amber' : 'bg-pip-green') : 'bg-pip-border'}`}
        />
      ))}
    </div>
  )
}

export default function TravelPanel({ player }: Props) {
  const travelTo = useGameStore(s => s.travelTo)
  const roads = getAdjacentRoads(player.location)

  return (
    <div className="h-full overflow-y-auto space-y-3">
      <div className="text-pip-green-dim text-xs mb-2">
        Select a destination. Travel costs caps and advances the turn.
      </div>
      {roads.map(road => {
        const destId = getRoadDestination(road, player.location)
        const dest = SETTLEMENTS[destId]
        const canAfford = player.caps >= road.travelCost

        const services = [
          dest.hasDoctor && 'Doctor',
          dest.hasBank && 'Bank',
          dest.hasLoanshark && 'Loans',
          dest.hasGunShop && 'Guns',
          dest.hasGuards && 'Guards',
        ].filter(Boolean).join(' · ')

        return (
          <div key={road.id} className="border border-pip-border p-3 rounded">
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="text-pip-green font-display text-xl">{dest.name}</div>
                <div className="text-pip-green-dim text-xs">via {road.name}</div>
              </div>
              <div className="text-right">
                <div className="text-pip-amber font-display">{road.travelCost} ¤</div>
                <DangerBars level={road.dangerLevel} />
              </div>
            </div>
            <div className="text-xs text-pip-green-dim mb-1">{road.description}</div>
            {services && <div className="text-xs text-pip-green-dim mb-2">Services: {services}</div>}
            <button
              className="pip-btn w-full"
              disabled={!canAfford}
              onClick={() => travelTo(destId)}
            >
              {canAfford ? `TRAVEL (${road.travelCost} ¤)` : 'CANNOT AFFORD'}
            </button>
          </div>
        )
      })}
    </div>
  )
}
