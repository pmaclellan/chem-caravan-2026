import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import type { GameState } from '@main/types/game'
import { cumulativeTradeProfit } from '@main/engine/statsReducer'

interface Props {
  gameState: GameState
}

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0)
}

interface MiniChartProps {
  title: string
  color: string
  data: Array<{ turn: number; value: number }>
}

function MiniLineChart({ title, color, data }: MiniChartProps) {
  return (
    <div className="border border-pip-border rounded p-3">
      <div className="pip-label mb-2">{title}</div>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={data} margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--pip-border-dim)" />
          <XAxis dataKey="turn" tick={{ fontSize: 10, fill: 'var(--pip-green-dim)' }} label={{ value: 'Turn', position: 'insideBottom', offset: -2, fontSize: 10, fill: 'var(--pip-green-dim)' }} />
          <YAxis tick={{ fontSize: 10, fill: 'var(--pip-green-dim)' }} width={42} />
          <Tooltip
            contentStyle={{ backgroundColor: 'var(--pip-bg-light)', border: '1px solid var(--pip-border)', fontSize: 11, fontFamily: 'monospace' }}
            labelFormatter={(t) => `Turn ${t}`}
          />
          <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export default function AnalyticsDashboard({ gameState }: Props) {
  const { history, stats } = gameState

  if (history.length <= 1) {
    // Legacy fallback — only an end-of-run aggregate exists, no per-turn time series.
    const tradeProfit = cumulativeTradeProfit(stats)
    return (
      <div className="flex flex-col gap-3">
        <div className="text-xs font-mono text-pip-amber border border-pip-amber rounded px-2 py-1">
          This run predates per-turn tracking — showing end-of-run totals only, not a time series.
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs font-mono">
          <KpiTile label="Total Kills" value={stats.totalKills} color="var(--pip-red)" />
          <KpiTile label="Combats Won / Fought" value={`${stats.combatsWon} / ${stats.combatsFought}`} color="var(--pip-green)" />
          <KpiTile label="Combats Fled" value={stats.combatsFled} color="var(--pip-amber)" />
          <KpiTile label="Damage Dealt" value={stats.totalDamageDealt.toLocaleString()} color="var(--pip-green)" />
          <KpiTile label="Damage Taken" value={stats.totalDamageTaken.toLocaleString()} color="var(--pip-red)" />
          <KpiTile label="Caps From Combat" value={stats.capsFromCombat.toLocaleString()} color="var(--pip-amber)" />
          <KpiTile label="Trade Profit" value={tradeProfit.toLocaleString()} color="var(--pip-blue)" />
          <KpiTile label="Lifetime Caps Earned" value={stats.lifetimeCapsEarned.toLocaleString()} color="var(--pip-amber)" />
          <KpiTile label="Total Payroll Paid" value={stats.totalPayrollPaid.toLocaleString()} color="var(--pip-red)" />
        </div>
      </div>
    )
  }

  const wealthData = history.map(h => ({ turn: h.turn, value: h.caps - h.debt }))
  const ammoData = history.map(h => ({ turn: h.turn, value: sum(Object.values(h.ownedGunAmmo)) }))
  const gunsData = history.map(h => ({ turn: h.turn, value: Object.keys(h.ownedGunAmmo).length }))
  const profitData = history.map(h => ({ turn: h.turn, value: h.tradeProfitToDate }))

  return (
    <div className="grid grid-cols-2 gap-3 overflow-y-auto min-h-0">
      <MiniLineChart title="Net Wealth (caps − debt)" color="var(--pip-amber)" data={wealthData} />
      <MiniLineChart title="Trade Profit To Date" color="var(--pip-blue)" data={profitData} />
      <MiniLineChart title="Ammo On Hand (total rounds)" color="var(--pip-green)" data={ammoData} />
      <MiniLineChart title="Guns Owned" color="var(--pip-red)" data={gunsData} />
    </div>
  )
}

function KpiTile({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="border border-pip-border rounded px-2 py-1.5">
      <div className="text-pip-green-dim text-[10px]">{label}</div>
      <div style={{ color }}>{value}</div>
    </div>
  )
}
