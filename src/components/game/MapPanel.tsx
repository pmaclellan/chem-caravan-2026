import { SETTLEMENTS, ROADS } from '../../data/settlements'
import { getAdjacentRoads, getRoadDestination } from '../../engine/travel'
import { useGameStore } from '../../store/gameStore'
import type { PlayerState } from '../../types/game'

type Anchor = 'middle' | 'start' | 'end'

// MBTA-style transit layout. Grid unit = 130px, origin at (95, 95).
// Clean geometry: most roads are horizontal, vertical, or 45° diagonal.
//   SH ── GG
//    │      ╲ 45°
//   V81    BH ── GN ── PSS
//    │      │     ╲ 45°
//    ╲     DC ────(GN-DC)
//     ╲    │
//      ╲  JP
//       ╲  │
//        TC╯  (JP-TC horiz; V81-TC = Quincy Ruins Road, deliberately long/shallow)
const POSITIONS: Record<string, {
  x: number; y: number
  labelAnchor: Anchor; labelDx: number; labelDy: number
}> = {
  sanctuary_hills:     { x:  95, y:  95, labelAnchor: 'middle', labelDx:   0, labelDy: -15 },
  graygarden:          { x: 225, y:  95, labelAnchor: 'middle', labelDx:   0, labelDy: -15 },
  bunker_hill:         { x: 355, y: 225, labelAnchor: 'start',  labelDx:  13, labelDy:  -5 },
  goodneighbor:        { x: 485, y: 225, labelAnchor: 'start',  labelDx:  13, labelDy:   4 },
  park_street_station: { x: 485, y: 355, labelAnchor: 'middle', labelDx:   0, labelDy: -15 },
  diamond_city:        { x: 355, y: 355, labelAnchor: 'middle', labelDx:   0, labelDy:  18 },
  vault_81:            { x:  95, y: 355, labelAnchor: 'end',    labelDx: -13, labelDy:   4 },
  jamaica_plain:       { x: 225, y: 485, labelAnchor: 'middle', labelDx:   0, labelDy:  16 },
  the_castle:          { x: 485, y: 485, labelAnchor: 'middle', labelDx:   0, labelDy:  16 },
}

function dangerColor(danger: number): string {
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
      <div className="text-pip-green-dim text-xs mb-1 flex-shrink-0 flex flex-wrap gap-x-4">
        <span>Click a connected settlement to travel.</span>
        <span className="flex gap-2">
          <span style={{ color: '#4a6a20' }}>■ safe</span>
          <span style={{ color: '#c47810' }}>■ risky</span>
          <span style={{ color: '#8c1c1c' }}>■ dangerous</span>
        </span>
      </div>

      <div className="flex-1 relative min-h-0">
        <svg
          viewBox="0 0 600 548"
          preserveAspectRatio="xMidYMin meet"
          className="absolute inset-0 w-full h-full"
        >
          <defs>
            {/* Paper grain — generated, no external image */}
            <filter id="map-grain" x="0%" y="0%" width="100%" height="100%">
              <feTurbulence type="fractalNoise" baseFrequency="0.72"
                numOctaves="4" stitchTiles="stitch" />
              <feColorMatrix type="saturate" values="0" />
            </filter>
            {/* Warm vignette */}
            <radialGradient id="map-vignette" cx="50%" cy="50%" r="72%">
              <stop offset="0%" stopColor="transparent" />
              <stop offset="100%" stopColor="rgba(90, 52, 14, 0.28)" />
            </radialGradient>
          </defs>

          {/* ── Background: aged parchment ── */}
          <rect width="600" height="548" fill="#d8bf88" rx="2" />
          <rect width="600" height="548" filter="url(#map-grain)" opacity="0.07" />
          <rect width="600" height="548" fill="url(#map-vignette)" />

          {/* Map title */}
          <text x="300" y="32" textAnchor="middle" fontSize="9.5"
            fontFamily='"Special Elite", serif'
            fill="rgba(80, 50, 18, 0.50)"
            letterSpacing="0.14em">
            COMMONWEALTH WASTELAND
          </text>

          {/* ── Roads: non-adjacent (dim dashed) first, then adjacent (bold) ── */}
          {ROADS.filter(r => !isAdjRoad(r)).map(road => {
            const from = POSITIONS[road.from]
            const to   = POSITIONS[road.to]
            if (!from || !to) return null
            return (
              <line key={road.id}
                x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                stroke="rgba(105, 68, 24, 0.28)"
                strokeWidth={3} strokeDasharray="6 5" strokeLinecap="round"
              />
            )
          })}

          {ROADS.filter(r => isAdjRoad(r)).map(road => {
            const from = POSITIONS[road.from]
            const to   = POSITIONS[road.to]
            if (!from || !to) return null
            const color = dangerColor(road.dangerLevel)
            const w = road.dangerLevel >= 0.65 ? 5 : 3.5
            return (
              <line key={road.id}
                x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                stroke={color} strokeWidth={w} strokeLinecap="round"
              />
            )
          })}

          {/* ── Settlement nodes ── */}
          {Object.entries(POSITIONS).map(([id, pos]) => {
            const isCurrent = id === player.location
            const isAdj     = adjIds.has(id)
            const name      = (SETTLEMENTS[id]?.name ?? id.replace(/_/g, ' ')).toUpperCase()
            const { labelAnchor, labelDx, labelDy } = pos

            const nodeR       = isCurrent ? 13  : isAdj ? 9.5 : 6.5
            const nodeFill    = isCurrent ? '#c4501a'
                              : isAdj     ? '#d8bf88'   // matches bg — white "hole" look
                              :             'rgba(162, 128, 60, 0.35)'
            const nodeStroke  = isCurrent ? '#e8a050'
                              : isAdj     ? '#6a4818'
                              :             'rgba(120, 80, 28, 0.42)'
            const nodeStrokeW = isCurrent ? 3   : isAdj ? 2   : 1.5
            const textFill    = isCurrent ? '#200e04'
                              : isAdj     ? '#200e04'
                              :             'rgba(80, 50, 18, 0.50)'
            const fontSize    = isCurrent ? 9.5 : isAdj ? 8.5 : 7.5
            const textStrokeW = isCurrent ? 3.5 : isAdj ? 3   : 2

            return (
              <g key={id}
                onClick={() => isAdj && travelTo(id)}
                style={{ cursor: isAdj ? 'pointer' : 'default' }}
              >
                {/* Pulsing outer ring for current location */}
                {isCurrent && (
                  <circle cx={pos.x} cy={pos.y} r={21}
                    fill="none" stroke="#c4501a" strokeWidth="1.5"
                    style={{ animation: 'map-ring-pulse 2.2s ease-in-out infinite' }}
                  />
                )}

                {/* Enlarged hit area for adjacent */}
                {isAdj && <circle cx={pos.x} cy={pos.y} r={22} fill="transparent" />}

                {/* Node */}
                <circle cx={pos.x} cy={pos.y} r={nodeR}
                  fill={nodeFill} stroke={nodeStroke} strokeWidth={nodeStrokeW}
                />

                {/* Inner pip for current location */}
                {isCurrent && <circle cx={pos.x} cy={pos.y} r={4} fill="#fdf0d0" />}

                {/* Label — parchment stroke creates legible halo */}
                <text
                  x={pos.x + labelDx} y={pos.y + labelDy}
                  textAnchor={labelAnchor}
                  fontSize={fontSize}
                  fontFamily='"Special Elite", serif'
                  fontWeight={isCurrent ? 'bold' : 'normal'}
                  fill={textFill}
                  stroke="#d8bf88" strokeWidth={textStrokeW} paintOrder="stroke"
                  style={{ userSelect: 'none' }}
                >
                  {name}
                </text>
              </g>
            )
          })}

          {/* Compass: top-right */}
          <text x="572" y="52" textAnchor="middle" fontSize="9"
            fontFamily='"Special Elite", serif'
            fill="rgba(80, 50, 18, 0.45)">
            N
          </text>
          <line x1="572" y1="54" x2="572" y2="64"
            stroke="rgba(80, 50, 18, 0.35)" strokeWidth="1" markerEnd="url(#arrow)" />
        </svg>
      </div>
    </div>
  )
}
