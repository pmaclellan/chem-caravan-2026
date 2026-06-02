import { SETTLEMENTS, ROADS } from '../../data/settlements'
import { getAdjacentRoads, getRoadDestination } from '../../engine/travel'
import { useGameStore } from '../../store/gameStore'
import type { PlayerState } from '../../types/game'

// 1200-px scaled version of the 5120×5120 Commonwealth overhead map
const MAP_URL =
  'https://static.wikia.nocookie.net/fallout/images/2/2d/Commonwealth-local.jpg' +
  '/revision/latest/scale-to-width-down/1200?cb=20210413232104'

type Anchor = 'middle' | 'start' | 'end'

// Positions on a 1000×1000 viewBox matching the square Commonwealth map.
// Geography: NW = Sanctuary Hills (Concord), Center = Diamond City (Fenway),
// SE = The Castle (Fort Independence). Adjust x/y if the overlay drifts.
const POSITIONS: Record<string, {
  x: number; y: number
  labelAnchor: Anchor; labelDx: number; labelDy: number
}> = {
  sanctuary_hills:     { x: 178, y: 122, labelAnchor: 'start',  labelDx:  13, labelDy:   4 },
  graygarden:          { x: 352, y: 248, labelAnchor: 'middle', labelDx:   0, labelDy: -13 },
  bunker_hill:         { x: 618, y: 295, labelAnchor: 'start',  labelDx:  13, labelDy:   4 },
  goodneighbor:        { x: 715, y: 445, labelAnchor: 'start',  labelDx:  13, labelDy:   4 },
  park_street_station: { x: 640, y: 495, labelAnchor: 'start',  labelDx:  13, labelDy:   4 },
  diamond_city:        { x: 518, y: 558, labelAnchor: 'middle', labelDx:   0, labelDy:  18 },
  jamaica_plain:       { x: 385, y: 722, labelAnchor: 'middle', labelDx:   0, labelDy: -13 },
  the_castle:          { x: 790, y: 798, labelAnchor: 'start',  labelDx:  13, labelDy:   4 },
  vault_81:            { x: 240, y: 628, labelAnchor: 'end',    labelDx: -13, labelDy:   4 },
}

function roadColor(danger: number, isAdjacent: boolean): string {
  if (!isAdjacent) return 'rgba(80, 50, 18, 0.30)'
  if (danger >= 0.65) return '#8c1c1c'
  if (danger >= 0.45) return '#c47810'
  return '#4a6a20'
}

interface Props { player: PlayerState }

export default function MapPanel({ player }: Props) {
  const travelTo = useGameStore(s => s.travelTo)
  const adjRoads = getAdjacentRoads(player.location)
  const adjIds   = new Set(adjRoads.map(r => getRoadDestination(r, player.location)))

  const isAdjRoad = (road: typeof ROADS[number]) =>
    (road.from === player.location && adjIds.has(road.to)) ||
    (road.to   === player.location && adjIds.has(road.from))

  return (
    <div className="flex flex-col h-full">
      <div className="text-pip-green-dim text-xs mb-1 flex-shrink-0 flex flex-wrap gap-x-4 gap-y-0.5">
        <span>Click a connected settlement to travel.</span>
        <span className="flex gap-2">
          <span style={{ color: '#4a6a20' }}>■ safe</span>
          <span style={{ color: '#c47810' }}>■ risky</span>
          <span style={{ color: '#8c1c1c' }}>■ dangerous</span>
        </span>
      </div>

      <div className="flex-1 relative min-h-0">
        <svg
          viewBox="0 0 1000 1000"
          preserveAspectRatio="xMidYMin meet"
          className="absolute inset-0 w-full h-full"
        >
          <defs>
            {/* Warm sepia conversion: grayscale terrain → aged parchment map */}
            <filter id="map-sepia" x="0%" y="0%" width="100%" height="100%"
              colorInterpolationFilters="sRGB">
              <feColorMatrix type="matrix"
                values="0.82 0.14 0.04 0 0.05
                        0.52 0.36 0.12 0 0.02
                        0.22 0.06 0.42 0 0.00
                        0.00 0.00 0.00 0.80 0.00" />
            </filter>
          </defs>

          {/* Sandy fallback if image is still loading */}
          <rect width="1000" height="1000" fill="#c8a850" />

          {/* Commonwealth terrain image — sepia-toned */}
          <image
            href={MAP_URL}
            x="0" y="0" width="1000" height="1000"
            preserveAspectRatio="xMidYMid meet"
            filter="url(#map-sepia)"
          />

          {/* Warm amber veil for depth and readability */}
          <rect width="1000" height="1000" fill="rgba(140, 80, 20, 0.12)" />

          {/* ── Roads: non-adjacent first so adjacent render on top ── */}
          {ROADS.filter(r => !isAdjRoad(r)).map(road => {
            const from = POSITIONS[road.from]
            const to   = POSITIONS[road.to]
            if (!from || !to) return null
            return (
              <line key={road.id}
                x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                stroke={roadColor(road.dangerLevel, false)}
                strokeWidth={1} strokeDasharray="5 5"
              />
            )
          })}

          {ROADS.filter(r => isAdjRoad(r)).map(road => {
            const from = POSITIONS[road.from]
            const to   = POSITIONS[road.to]
            if (!from || !to) return null
            return (
              <line key={road.id}
                x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                stroke={roadColor(road.dangerLevel, true)}
                strokeWidth={2.5} strokeLinecap="round"
              />
            )
          })}

          {/* ── Settlement nodes ── */}
          {Object.entries(POSITIONS).map(([id, pos]) => {
            const isCurrent = id === player.location
            const isAdj     = adjIds.has(id)
            const name      = (SETTLEMENTS[id]?.name ?? id.replace(/_/g, ' ')).toUpperCase()
            const { labelAnchor, labelDx, labelDy } = pos

            const nodeR      = isCurrent ? 11 : isAdj ? 8 : 5
            const nodeFill   = isCurrent ? '#c4501a'
                             : isAdj     ? 'rgba(200, 148, 50, 0.90)'
                             :             'rgba(80, 50, 18, 0.22)'
            const nodeStroke = isCurrent ? '#e8a050'
                             : isAdj     ? '#8a6020'
                             :             'rgba(80, 50, 18, 0.40)'
            const textFill   = isCurrent ? '#fdf0d0'
                             : isAdj     ? '#ecddb0'
                             :             'rgba(50, 30, 8, 0.50)'
            const textSize   = isCurrent ? 11.5 : isAdj ? 9.5 : 7.5
            const strokeW    = isCurrent ? 4 : isAdj ? 3 : 2

            return (
              <g key={id}
                onClick={() => isAdj && travelTo(id)}
                style={{ cursor: isAdj ? 'pointer' : 'default' }}
              >
                {/* Pulsing outer ring — current location only */}
                {isCurrent && (
                  <circle cx={pos.x} cy={pos.y} r={19}
                    fill="none" stroke="#e8a050" strokeWidth="1.5"
                    style={{ animation: 'map-ring-pulse 2.2s ease-in-out infinite' }}
                  />
                )}

                {/* Larger invisible hit area for adjacent nodes */}
                {isAdj && <circle cx={pos.x} cy={pos.y} r={20} fill="transparent" />}

                {/* Main node circle */}
                <circle cx={pos.x} cy={pos.y} r={nodeR}
                  fill={nodeFill} stroke={nodeStroke}
                  strokeWidth={isCurrent ? 2.5 : 1.5}
                />

                {/* Center pip for current location */}
                {isCurrent && (
                  <circle cx={pos.x} cy={pos.y} r={3.5} fill="#fdf0d0" />
                )}

                {/* Settlement name — dark stroke creates legible halo on any terrain */}
                <text
                  x={pos.x + labelDx}
                  y={pos.y + labelDy}
                  textAnchor={labelAnchor}
                  fontSize={textSize}
                  fontFamily='"Special Elite", serif'
                  fontWeight={isCurrent ? 'bold' : 'normal'}
                  fill={textFill}
                  stroke="rgba(15, 8, 0, 0.88)"
                  strokeWidth={strokeW}
                  paintOrder="stroke"
                  style={{ userSelect: 'none' }}
                >
                  {name}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
