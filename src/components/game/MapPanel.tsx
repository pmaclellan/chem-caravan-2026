import { SETTLEMENTS, ROADS } from '../../data/settlements'
import { getAdjacentRoads, getRoadDestination } from '../../engine/travel'
import { useGameStore } from '../../store/gameStore'
import type { PlayerState } from '../../types/game'

// Approximate geographic positions on a 400×320 canvas
// Based on real Boston-area geography (Fenway=Diamond City, Charlestown=Bunker Hill, etc.)
type Anchor = 'middle' | 'start' | 'end'
const POSITIONS: Record<string, { x: number; y: number; labelAnchor?: Anchor; labelDy?: number }> = {
  sanctuary_hills:    { x: 58,  y: 42,  labelDy: 14 },
  graygarden:         { x: 158, y: 78,  labelDy: 14 },
  bunker_hill:        { x: 244, y: 108, labelDy: 14 },
  goodneighbor:       { x: 308, y: 152, labelAnchor: 'start', labelDy: 4 },
  park_street_station:{ x: 272, y: 188, labelAnchor: 'start', labelDy: 4 },
  diamond_city:       { x: 222, y: 212, labelDy: 16 },
  jamaica_plain:      { x: 168, y: 278, labelDy: 14 },
  the_castle:         { x: 318, y: 284, labelAnchor: 'start', labelDy: 4 },
  vault_81:           { x: 72,  y: 218, labelAnchor: 'end', labelDy: 4 },
}

// Danger-based road colour
function roadColor(danger: number, isAdjacent: boolean): string {
  if (!isAdjacent) return '#152815'
  if (danger >= 0.65) return '#ff3333'
  if (danger >= 0.45) return '#ffaa00'
  return '#2a7a1a'
}

interface Props { player: PlayerState }

export default function MapPanel({ player }: Props) {
  const travelTo = useGameStore(s => s.travelTo)
  const adjacentRoads = getAdjacentRoads(player.location)
  const adjacentIds = new Set(adjacentRoads.map(r => getRoadDestination(r, player.location)))

  function getRoadForDest(destId: string) {
    return adjacentRoads.find(r => getRoadDestination(r, player.location) === destId)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="text-pip-green-dim text-xs mb-1 flex-shrink-0">
        Click a connected settlement to travel.
        <span className="ml-3">
          <span className="text-pip-green">■</span> safe &nbsp;
          <span className="text-pip-amber">■</span> risky &nbsp;
          <span className="text-pip-red">■</span> dangerous
        </span>
      </div>

      <div className="flex-1 relative min-h-0">
        <svg
          viewBox="0 0 400 320"
          preserveAspectRatio="xMidYMin meet"
          className="absolute inset-0 w-full h-full"
          style={{ fontFamily: '"Share Tech Mono", monospace' }}
        >
          {/* Background */}
          <defs>
            <pattern id="mapgrid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#0c1a0c" strokeWidth="0.5" />
            </pattern>
            <filter id="glow">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          <rect width="400" height="320" fill="#0a0f0a" />
          <rect width="400" height="320" fill="url(#mapgrid)" />

          {/* Roads */}
          {ROADS.map(road => {
            const from = POSITIONS[road.from]
            const to = POSITIONS[road.to]
            if (!from || !to) return null
            const isAdj = (road.from === player.location && adjacentIds.has(road.to)) ||
                          (road.to === player.location && adjacentIds.has(road.from))
            const color = roadColor(road.dangerLevel, isAdj)
            return (
              <line
                key={road.id}
                x1={from.x} y1={from.y}
                x2={to.x} y2={to.y}
                stroke={color}
                strokeWidth={isAdj ? 1.5 : 1}
                strokeDasharray={isAdj ? undefined : '3 3'}
                opacity={isAdj ? 1 : 0.5}
              />
            )
          })}

          {/* Settlement nodes */}
          {Object.entries(POSITIONS).map(([id, pos]) => {
            const isCurrent = id === player.location
            const isAdj = adjacentIds.has(id)
            const settlement = SETTLEMENTS[id]
            const road = isAdj ? getRoadForDest(id) : undefined
            const nodeColor = isCurrent ? '#39ff14' : isAdj ? '#4cff4c' : '#1f4a1f'
            const fillColor = isCurrent ? '#39ff14' : isAdj ? '#0f2a0f' : '#0a0f0a'
            const label = settlement?.name ?? id
            const anchor: Anchor = pos.labelAnchor ?? 'middle'
            const dy = pos.labelDy ?? 14

            return (
              <g
                key={id}
                onClick={() => isAdj && travelTo(id)}
                style={{ cursor: isAdj ? 'pointer' : 'default' }}
              >
                {/* Outer glow for current */}
                {isCurrent && (
                  <circle cx={pos.x} cy={pos.y} r={14} fill="none" stroke="#39ff14" strokeWidth="0.5" opacity="0.3" />
                )}
                {/* Hover target (larger invisible hit area for adjacent) */}
                {isAdj && (
                  <circle cx={pos.x} cy={pos.y} r={16} fill="transparent" />
                )}
                {/* Node circle */}
                <circle
                  cx={pos.x} cy={pos.y}
                  r={isCurrent ? 7 : isAdj ? 5.5 : 4.5}
                  fill={fillColor}
                  stroke={nodeColor}
                  strokeWidth={isCurrent ? 2 : 1.5}
                  filter={isCurrent ? 'url(#glow)' : undefined}
                />
                {/* Center dot for current */}
                {isCurrent && (
                  <circle cx={pos.x} cy={pos.y} r={2.5} fill="#39ff14" />
                )}

                {/* Settlement name */}
                <text
                  x={anchor === 'start' ? pos.x + 9 : anchor === 'end' ? pos.x - 9 : pos.x}
                  y={anchor === 'middle' ? pos.y + dy : pos.y + 4}
                  textAnchor={anchor}
                  fontSize={isCurrent ? 7.5 : isAdj ? 7 : 6}
                  fill={nodeColor}
                  fontWeight={isCurrent ? 'bold' : 'normal'}
                >
                  {label.toUpperCase()}
                </text>

                {/* Danger label for adjacent roads */}
                {isAdj && road && (
                  <text
                    x={anchor === 'start' ? pos.x + 9 : anchor === 'end' ? pos.x - 9 : pos.x}
                    y={anchor === 'middle' ? pos.y + dy + 8 : pos.y + 12}
                    textAnchor={anchor}
                    fontSize={5.5}
                    fill={roadColor(road.dangerLevel, true)}
                    opacity={0.85}
                  >
                    {road.name.toUpperCase()}
                  </text>
                )}
              </g>
            )
          })}

          {/* Compass rose (top-right corner) */}
          <text x="385" y="18" textAnchor="end" fontSize="7" fill="#1f4a1f">N ▲</text>
        </svg>
      </div>
    </div>
  )
}
