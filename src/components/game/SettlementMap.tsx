import type { PlayerState } from '../../types/game'
import type { GameModeConfig, MapNodePosition } from '../../data/modes'
import { getAdjacentRoads, getRoadDestination } from '../../engine/travel'

function dangerColor(danger: number): string {
  if (danger >= 0.50) return '#8c1c1c'
  if (danger >= 0.33) return '#c47810'
  return '#4a6a20'
}

const ICON_SIZES = {
  SMALL:  { px: 10, strokeW: 1.5 },
  MEDIUM: { px: 12, strokeW: 2.0 },
  LARGE:  { px: 14, strokeW: 2.5 },
} as const

type IconSize = typeof ICON_SIZES[keyof typeof ICON_SIZES]

// Inlined path data from the 24×24 viewBox SVGs — avoids SVG-in-SVG loading restrictions
const SERVICE_ICONS: { key: 'hasDoctor' | 'hasLoanshark' | 'hasArmory' | 'hasFollowers'; d: string }[] = [
  {
    key: 'hasDoctor',
    d: 'M7 17V7M17 17V7M10 10H10.01M14 10H14.01M14 14H14.01M10 14H10.01M6.2 17H17.8C18.9201 17 19.4802 17 19.908 16.782C20.2843 16.5903 20.5903 16.2843 20.782 15.908C21 15.4802 21 14.9201 21 13.8V10.2C21 9.07989 21 8.51984 20.782 8.09202C20.5903 7.71569 20.2843 7.40973 19.908 7.21799C19.4802 7 18.9201 7 17.8 7H6.2C5.0799 7 4.51984 7 4.09202 7.21799C3.71569 7.40973 3.40973 7.71569 3.21799 8.09202C3 8.51984 3 9.07989 3 10.2V13.8C3 14.9201 3 15.4802 3.21799 15.908C3.40973 16.2843 3.71569 16.5903 4.09202 16.782C4.51984 17 5.07989 17 6.2 17Z',
  },
  {
    key: 'hasLoanshark',
    d: 'M16 7C16 6.07003 16 5.60504 15.8978 5.22354C15.6204 4.18827 14.8117 3.37962 13.7765 3.10222C13.395 3 12.93 3 12 3C11.07 3 10.605 3 10.2235 3.10222C9.18827 3.37962 8.37962 4.18827 8.10222 5.22354C8 5.60504 8 6.07003 8 7M14 11.5C13.5 11.376 12.6851 11.3714 12 11.376M12 11.376C11.7709 11.3775 11.9094 11.3678 11.6 11.376C10.7926 11.4012 10.0016 11.7368 10 12.6875C9.99825 13.7004 11 14 12 14C13 14 14 14.2312 14 15.3125C14 16.1251 13.1925 16.4812 12.1861 16.5991C11.3861 16.5991 11 16.625 10 16.5M12 11.376L12 10M12 16.5995V18M7.8 21H16.2C17.8802 21 18.7202 21 19.362 20.673C19.9265 20.3854 20.3854 19.9265 20.673 19.362C21 18.7202 21 17.8802 21 16.2V11.8C21 10.1198 21 9.27976 20.673 8.63803C20.3854 8.07354 19.9265 7.6146 19.362 7.32698C18.7202 7 17.8802 7 16.2 7H7.8C6.11984 7 5.27976 7 4.63803 7.32698C4.07354 7.6146 3.6146 8.07354 3.32698 8.63803C3 9.27976 3 10.1198 3 11.8V16.2C3 17.8802 3 18.7202 3.32698 19.362C3.6146 19.9265 4.07354 20.3854 4.63803 20.673C5.27976 21 6.11984 21 7.8 21Z',
  },
  {
    key: 'hasArmory',
    d: 'M12 3V7M12 17V21M3 12H7M17 12H21M12 12H12.01M19 12C19 15.866 15.866 19 12 19C8.13401 19 5 15.866 5 12C5 8.13401 8.13401 5 12 5C15.866 5 19 8.13401 19 12Z',
  },
  {
    key: 'hasFollowers',
    d: 'M13 20V18C13 15.2386 10.7614 13 8 13C5.23858 13 3 15.2386 3 18V20H13ZM13 20H21V19C21 16.0545 18.7614 14 16 14C14.5867 14 13.3103 14.6255 12.4009 15.6311M11 7C11 8.65685 9.65685 10 8 10C6.34315 10 5 8.65685 5 7C5 5.34315 6.34315 4 8 4C9.65685 4 11 5.34315 11 7ZM18 9C18 10.1046 17.1046 11 16 11C14.8954 11 14 10.1046 14 9C14 7.89543 14.8954 7 16 7C17.1046 7 18 7.89543 18 9Z',
  },
]

function ServiceIcons({
  s, anchorX, nodeY, labelAnchor, labelDx, labelDy, iconSize,
}: {
  s: GameModeConfig['settlements'][string]
  anchorX: number
  nodeY: number
  labelAnchor: 'middle' | 'start' | 'end'
  labelDx: number
  labelDy: number
  iconSize: IconSize
}) {
  const active = SERVICE_ICONS.filter(i => s[i.key])
  if (active.length === 0) return null

  const { px, strokeW } = iconSize
  const gap = 2
  const totalW = active.length * px + (active.length - 1) * gap
  const ax = anchorX + labelDx
  const startX = labelAnchor === 'middle' ? ax - totalW / 2
               : labelAnchor === 'end'    ? ax - totalW
               : ax

  // For above-node labels, use px*2 gap so icons clear the full text ascent zone
  const rowY = labelDy < 0
    ? nodeY + labelDy - px * 2
    : nodeY + labelDy + 3

  const scale = px / 24

  return (
    <>
      {active.map((icon, i) => (
        <g
          key={icon.key}
          transform={`translate(${startX + i * (px + gap)}, ${rowY}) scale(${scale})`}
          opacity={0.75}
        >
          <path
            d={icon.d}
            fill="none"
            stroke="#3d2208"
            strokeWidth={strokeW}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
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
          <text x={viewW / 2} y="32" textAnchor="middle" fontSize="18"
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

            const iconSize = isCurrent ? ICON_SIZES.LARGE : isAdj ? ICON_SIZES.MEDIUM : ICON_SIZES.SMALL

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
                  iconSize={iconSize}
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
