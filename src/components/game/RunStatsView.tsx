import type { RunStats, XpBySource } from '../../types/stats'
import type { GameModeConfig } from '../../data/modes'

interface Props {
  stats: RunStats
  mc: GameModeConfig
}

// Uniform label/value row — label in a fixed-width left column, value left-aligned after it.
// Eliminates the justify-between / right-edge-against-scrollbar problem throughout.
function StatRow({
  label,
  children,
  valueClass = 'text-pip-green font-display',
}: {
  label: string
  children: React.ReactNode
  valueClass?: string
}) {
  return (
    <div className="flex items-baseline gap-2 text-xs">
      <span className="text-pip-green-dim flex-shrink-0" style={{ minWidth: '9.5rem' }}>{label}</span>
      <span className={valueClass}>{children}</span>
    </div>
  )
}

// Thin section separator
function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="pip-label pb-1 mb-2"
      style={{ borderBottom: '1px solid var(--pip-border-dim)' }}
    >
      {children}
    </div>
  )
}

export default function RunStatsView({ stats, mc }: Props) {
  const topGun  = Object.entries(stats.killsByGun).sort(([, a], [, b]) => b - a)[0]
  const topChem = Object.entries(stats.chemsSold).sort(([, a], [, b]) => b.profitEarned - a.profitEarned)[0]
  const winRate = stats.combatsFought > 0
    ? Math.round((stats.combatsWon / stats.combatsFought) * 100)
    : null

  return (
    <div className="space-y-4 text-sm font-mono pr-3">

      {/* ── COMBAT ── */}
      <div>
        <SectionHeader>Combat</SectionHeader>
        <div className="space-y-1">
          <StatRow label="Enemies killed">{stats.totalKills.toLocaleString()}</StatRow>
          <StatRow label="Combats won">
            {stats.combatsWon} / {stats.combatsFought}
            {winRate !== null && <span className="text-pip-green-dim ml-1.5">({winRate}%)</span>}
          </StatRow>
          {stats.combatsFled > 0 && (
            <StatRow label="Times fled">{stats.combatsFled}</StatRow>
          )}
          {stats.secondWavesDefeated > 0 && (
            <StatRow label="2nd waves">{stats.secondWavesDefeated}</StatRow>
          )}
          <StatRow label="Damage dealt">{stats.totalDamageDealt.toLocaleString()}</StatRow>
          <StatRow label="Damage taken">{stats.totalDamageTaken.toLocaleString()}</StatRow>
          {stats.capsFromCombat > 0 && (
            <StatRow label="Caps from combat">{stats.capsFromCombat.toLocaleString()} ¤</StatRow>
          )}
          {topGun && (
            <StatRow label="Favorite weapon">
              {topGun[0] === 'unarmed' ? 'Bare hands' : (mc.guns[topGun[0]]?.name ?? topGun[0])}
              <span className="text-pip-green-dim ml-1.5">({topGun[1]}k)</span>
            </StatRow>
          )}

          {/* Kill breakdown by enemy type */}
          {stats.totalKills > 0 && Object.keys(stats.killsByEnemy).length > 0 && (
            <div className="mt-1.5 space-y-0.5 pl-4 border-l border-pip-border-dim">
              {Object.entries(stats.killsByEnemy)
                .sort(([, a], [, b]) => b - a)
                .map(([typeId, count]) => {
                  const name = mc.enemies.find(e => e.id === typeId)?.name ?? typeId
                  return (
                    <StatRow key={typeId} label={name}>{count}</StatRow>
                  )
                })}
            </div>
          )}
        </div>
      </div>

      {/* ── TRADING ── */}
      {(Object.keys(stats.chemsSold).length > 0 || stats.lifetimeCapsEarned > 0) && (
        <div>
          <SectionHeader>Trading</SectionHeader>
          <div className="space-y-1">
            <StatRow label="Caps earned">{stats.lifetimeCapsEarned.toLocaleString()} ¤</StatRow>
            {topChem && (
              <StatRow label="Top chem (profit)">
                {topChem[0]}
                <span className="text-pip-amber ml-1.5">+{topChem[1].profitEarned.toLocaleString()} ¤</span>
              </StatRow>
            )}
            {stats.hasSoldToMerchant && (
              <StatRow label="Road deals">Yes</StatRow>
            )}

            {/* Per-chem profit breakdown */}
            {Object.keys(stats.chemsSold).length > 0 && (
              <div className="mt-1.5 space-y-0.5 pl-4 border-l border-pip-border-dim">
                {Object.entries(stats.chemsSold)
                  .sort(([, a], [, b]) => b.profitEarned - a.profitEarned)
                  .slice(0, 5)
                  .map(([chemId, s]) => (
                    <StatRow
                      key={chemId}
                      label={`${chemId} ×${s.qty}`}
                      valueClass={s.profitEarned >= 0 ? 'text-pip-amber font-display' : 'text-pip-red font-display'}
                    >
                      {s.profitEarned >= 0 ? '+' : ''}{s.profitEarned.toLocaleString()} ¤
                    </StatRow>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAMING ── */}
      {Object.keys(stats.tamesByEnemy).length > 0 && (
        <div>
          <SectionHeader>Taming</SectionHeader>
          <div className="space-y-0.5">
            {Object.entries(stats.tamesByEnemy).map(([typeId, count]) => {
              const name = mc.enemies.find(e => e.id === typeId)?.name ?? typeId
              return <StatRow key={typeId} label={name}>{count}</StatRow>
            })}
          </div>
        </div>
      )}

      {/* ── MISC ── */}
      {stats.turnsInDebt > 0 && (
        <StatRow label="Turns in debt" valueClass="text-pip-red font-display">
          {stats.turnsInDebt}
        </StatRow>
      )}

      {/* ── XP BREAKDOWN ── */}
      {stats.xpBySource && Object.values(stats.xpBySource).some(v => v > 0) && (
        <XpBreakdown xpBySource={stats.xpBySource} />
      )}
    </div>
  )
}

function XpBreakdown({ xpBySource }: { xpBySource: XpBySource }) {
  const rows: { label: string; key: keyof XpBySource }[] = [
    { label: 'Combat',           key: 'combat' },
    { label: 'Achievements',     key: 'achievements' },
    { label: 'Trade profit',     key: 'trade' },
    { label: 'Travel/discovery', key: 'travel' },
  ]
  const total = Object.values(xpBySource).reduce((s, v) => s + v, 0)

  return (
    <div>
      <SectionHeader>XP Breakdown</SectionHeader>
      <div className="space-y-2">
        {rows.filter(r => xpBySource[r.key] > 0).map(({ label, key }) => {
          const pct = total > 0 ? (xpBySource[key] / total) * 100 : 0
          return (
            <div key={key}>
              <div className="flex items-baseline gap-2 text-xs mb-0.5">
                <span className="text-pip-green-dim flex-shrink-0" style={{ minWidth: '9.5rem' }}>{label}</span>
                <span className="text-pip-blue font-mono">{xpBySource[key].toLocaleString()} XP</span>
              </div>
              <div className="h-1 rounded-full bg-pip-border overflow-hidden">
                <div className="h-full rounded-full bg-pip-blue opacity-60" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )
        })}
        {total > 0 && (
          <div className="flex items-baseline gap-2 text-xs pt-1 border-t border-pip-border-dim">
            <span className="text-pip-green-dim flex-shrink-0" style={{ minWidth: '9.5rem' }}>Total</span>
            <span className="text-pip-blue font-mono font-bold">{total.toLocaleString()} XP</span>
          </div>
        )}
      </div>
    </div>
  )
}
