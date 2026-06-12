import type { PlayerState } from '../../types/game'
import type { GameModeConfig, MapNodePosition } from '../../data/modes'
import { getAdjacentRoads, getRoadDestination } from '../../engine/travel'

function dangerColor(danger: number): string {
  if (danger >= 0.50) return '#8c1c1c'
  if (danger >= 0.33) return '#c47810'
  return '#4a6a20'
}

const SERVICE_ICONS: { key: 'hasDoctor' | 'hasLoanshark' | 'hasGunShop' | 'hasFollowers'; src: string }[] = [
  { key: 'hasDoctor',    src: '/assets/icons/bandage-svgrepo-com.svg' },
  { key: 'hasLoanshark', src: '/assets/icons/briefcase-dollar-svgrepo-com.svg' },
  { key: 'hasGunShop',   src: '/assets/icons/crosshair-svgrepo-com.svg' },
  { key: 'hasFollowers', src: '/assets/icons/followers-svgrepo-com.svg' },
]

function ServiceIcons({
  s, anchorX, nodeY, labelAnchor, labelDx, labelDy, size,
}: {
  s: GameModeConfig['settlements'][string]
  anchorX: number
  nodeY: number
  labelAnchor: 'middle' | 'start' | 'end'
  labelDx: number
  labelDy: number
  size: number
}) {
  const srcs = SERVICE_ICONS.filter(i => s[i.key]).map(i => i.src)
  if (srcs.length === 0) return null

  const gap = 2
  const totalW = srcs.length * size + (srcs.length - 1) * gap
  const ax = anchorX + labelDx
  const startX = labelAnchor === 'middle' ? ax - totalW / 2
               : labelAnchor === 'end'    ? ax - totalW
               : ax

  // Place icon row on the far side of the label from the node
  const rowY = labelDy < 0
    ? nodeY + labelDy - size - 3   // label is above node → icons above label
    : nodeY + labelDy + 3          // label is below node → icons below label

  return (
    <>
      {srcs.map((src, i) => (
        <image
          key={src}
          href={src}
          x={startX + i * (size + gap)}
          y={rowY}
          width={size}
          height={size}
          opacity={0.72}
        />
      ))}
    </>
  )
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

  // compact: scale the 620×620 viewBox down to ~360×360 for mobile
  const viewW = 620
  const viewH = 620
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

          {/* All roads — danger-colored; adjacent = solid+bold, others = dashed+dim */}
          {mc.roads.map(road => {
            const from = positions[road.from]
            const to   = positions[road.to]
            if (!from || !to) return null
            const adj   = isAdjRoad(road)
            const color = dangerColor(road.dangerLevel)
            return (
              <line key={road.id}
                x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                stroke={color}
                strokeOpacity={adj ? 1 : 0.35}
                strokeWidth={adj ? (road.dangerLevel >= 0.65 ? 5 : 3.5) : 2.5}
                strokeDasharray={adj ? undefined : '6 5'}
                strokeLinecap="round"
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
            const { labelAnchor, labelDx, labelDy } = pos

            const nodeR       = isCurrent ? 13  : isAdj ? 9.5 : 6.5
            const nodeFill    = isCurrent ? '#c4501a' : isAdj ? '#d8bf88' : 'rgba(162, 128, 60, 0.35)'
            const nodeStroke  = isCurrent ? '#e8a050' : isAdj ? '#6a4818' : 'rgba(120, 80, 28, 0.42)'
            const nodeStrokeW = isCurrent ? 3   : isAdj ? 2   : 1.5
            const textFill    = isCurrent || isAdj ? '#200e04' : 'rgba(80, 50, 18, 0.50)'
            const fontSize    = isCurrent ? 11.5 : isAdj ? 10 : 8.5
            const textStrokeW = isCurrent ? 3.5 : isAdj ? 3   : 2

            const iconSize = isCurrent ? 13 : isAdj ? 11 : 9

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
                <ServiceIcons
                  s={settlement}
                  anchorX={pos.x}
                  nodeY={pos.y}
                  labelAnchor={labelAnchor}
                  labelDx={labelDx}
                  labelDy={labelDy}
                  size={iconSize}
                />
              </g>
            )
          })}

          {/* Compass */}
          <text x="594" y="52" textAnchor="middle" fontSize="9"
            fontFamily='"Special Elite", serif'
            fill="rgba(80, 50, 18, 0.45)">N</text>
          <line x1="594" y1="54" x2="594" y2="64"
            stroke="rgba(80, 50, 18, 0.35)" strokeWidth="1" />
        </svg>
      </div>
    </div>
  )
}
