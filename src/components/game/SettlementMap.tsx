import type { PlayerState } from '../../types/game'
import type { GameModeConfig, MapNodePosition } from '../../data/modes'
import { getAdjacentRoads, getRoadDestination } from '../../engine/travel'

function dangerColor(danger: number): string {
  if (danger >= 0.65) return '#8c1c1c'
  if (danger >= 0.45) return '#c47810'
  return '#4a6a20'
}

// Service icon glyphs — compact row below node name
function serviceIcons(s: GameModeConfig['settlements'][string]): string {
  const icons: string[] = []
  if (s.hasDoctor) icons.push('✚')
  if (s.hasBank)   icons.push('¤')
  if (s.hasGunShop) icons.push('⚙')
  if (s.hasGuards) icons.push('⚔')
  return icons.join(' ')
}

interface Props {
  player: PlayerState
  mc: GameModeConfig
  onTravel: (settlementId: string) => void
  compact?: boolean   // true = smaller layout for mobile
}

export default function SettlementMap({ player, mc, onTravel, compact = false }: Props) {
  const positions: Record<string, MapNodePosition> = mc.mapPositions

  const adjRoads = getAdjacentRoads(mc, player.location)
  const adjIds   = new Set(adjRoads.map(r => getRoadDestination(r, player.location)))

  const isAdjRoad = (road: GameModeConfig['roads'][number]) =>
    (road.from === player.location && adjIds.has(road.to)) ||
    (road.to   === player.location && adjIds.has(road.from))

  // compact: scale the 600×548 viewBox down to ~340×310 for mobile
  const viewW = 600
  const viewH = 548
  const scale = compact ? 0.58 : 1
  const svgH  = Math.round(viewH * scale)

  return (
    <div className={`flex flex-col ${compact ? 'h-full' : 'h-full'}`}>
      {!compact && (
        <div className="text-pip-green-dim text-xs mb-1 flex-shrink-0 flex flex-wrap gap-x-4">
          <span>Click a connected settlement to travel.</span>
          <span className="flex gap-2">
            <span style={{ color: '#4a6a20' }}>■ safe</span>
            <span style={{ color: '#c47810' }}>■ risky</span>
            <span style={{ color: '#8c1c1c' }}>■ dangerous</span>
          </span>
        </div>
      )}

      <div className={`${compact ? '' : 'flex-1 relative min-h-0'}`}>
        <svg
          viewBox={`0 0 ${viewW} ${viewH}`}
          width={compact ? '100%' : undefined}
          height={compact ? svgH : undefined}
          preserveAspectRatio="xMidYMin meet"
          className={compact ? 'block' : 'absolute inset-0 w-full h-full'}
        >
          <defs>
            <filter id="map-grain" x="0%" y="0%" width="100%" height="100%">
              <feTurbulence type="fractalNoise" baseFrequency="0.72" numOctaves="4" stitchTiles="stitch" />
              <feColorMatrix type="saturate" values="0" />
            </filter>
            <radialGradient id="map-vignette" cx="50%" cy="50%" r="72%">
              <stop offset="0%" stopColor="transparent" />
              <stop offset="100%" stopColor="rgba(90, 52, 14, 0.28)" />
            </radialGradient>
          </defs>

          {/* Background */}
          <rect width={viewW} height={viewH} fill="#d8bf88" rx="2" />
          <rect width={viewW} height={viewH} filter="url(#map-grain)" opacity="0.07" />
          <rect width={viewW} height={viewH} fill="url(#map-vignette)" />

          {/* Map title */}
          <text x={viewW / 2} y="32" textAnchor="middle" fontSize="9.5"
            fontFamily='"Special Elite", serif'
            fill="rgba(80, 50, 18, 0.50)"
            letterSpacing="0.14em"
          >
            {mc.mapTitle}
          </text>

          {/* Non-adjacent roads (dim dashed) */}
          {mc.roads.filter(r => !isAdjRoad(r)).map(road => {
            const from = positions[road.from]
            const to   = positions[road.to]
            if (!from || !to) return null
            return (
              <line key={road.id}
                x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                stroke="rgba(105, 68, 24, 0.28)"
                strokeWidth={3} strokeDasharray="6 5" strokeLinecap="round"
              />
            )
          })}

          {/* Adjacent roads (bold, colored by danger) */}
          {mc.roads.filter(r => isAdjRoad(r)).map(road => {
            const from = positions[road.from]
            const to   = positions[road.to]
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

          {/* Settlement nodes */}
          {Object.entries(positions).map(([id, pos]) => {
            const settlement = mc.settlements[id]
            if (!settlement) return null
            const isCurrent = id === player.location
            const isAdj     = adjIds.has(id)
            const name      = settlement.name.toUpperCase()
            const icons     = serviceIcons(settlement)
            const { labelAnchor, labelDx, labelDy } = pos

            const nodeR       = isCurrent ? 13  : isAdj ? 9.5 : 6.5
            const nodeFill    = isCurrent ? '#c4501a' : isAdj ? '#d8bf88' : 'rgba(162, 128, 60, 0.35)'
            const nodeStroke  = isCurrent ? '#e8a050' : isAdj ? '#6a4818' : 'rgba(120, 80, 28, 0.42)'
            const nodeStrokeW = isCurrent ? 3   : isAdj ? 2   : 1.5
            const textFill    = isCurrent || isAdj ? '#200e04' : 'rgba(80, 50, 18, 0.50)'
            const fontSize    = isCurrent ? 9.5 : isAdj ? 8.5 : 7.5
            const textStrokeW = isCurrent ? 3.5 : isAdj ? 3   : 2

            // Icon row position — offset further than name
            const iconDy = labelDy < 0 ? labelDy - 10 : labelDy + 11
            const iconFontSize = isCurrent ? 8 : 6.5

            return (
              <g key={id}
                onClick={() => isAdj && onTravel(id)}
                style={{ cursor: isAdj ? 'pointer' : 'default' }}
              >
                {isCurrent && (
                  <circle cx={pos.x} cy={pos.y} r={21}
                    fill="none" stroke="#c4501a" strokeWidth="1.5"
                    style={{ animation: 'map-ring-pulse 2.2s ease-in-out infinite' }}
                  />
                )}
                {isAdj && <circle cx={pos.x} cy={pos.y} r={22} fill="transparent" />}

                <circle cx={pos.x} cy={pos.y} r={nodeR}
                  fill={nodeFill} stroke={nodeStroke} strokeWidth={nodeStrokeW}
                />
                {isCurrent && <circle cx={pos.x} cy={pos.y} r={4} fill="#fdf0d0" />}

                {/* Settlement name */}
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

                {/* Service icons */}
                {icons && (
                  <text
                    x={pos.x + labelDx} y={pos.y + iconDy}
                    textAnchor={labelAnchor}
                    fontSize={iconFontSize}
                    fontFamily="monospace"
                    fill={textFill}
                    stroke="#d8bf88" strokeWidth="2" paintOrder="stroke"
                    style={{ userSelect: 'none' }}
                  >
                    {icons}
                  </text>
                )}
              </g>
            )
          })}

          {/* Compass */}
          <text x="572" y="52" textAnchor="middle" fontSize="9"
            fontFamily='"Special Elite", serif'
            fill="rgba(80, 50, 18, 0.45)">N</text>
          <line x1="572" y1="54" x2="572" y2="64"
            stroke="rgba(80, 50, 18, 0.35)" strokeWidth="1" />
        </svg>
      </div>
    </div>
  )
}
