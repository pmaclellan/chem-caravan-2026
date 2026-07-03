import type { RunStats } from '../../types/stats'
import type { GameModeConfig } from '../../data/modes'

interface Props {
  stats: RunStats
  mc: GameModeConfig
}

export default function RunStatsView({ stats, mc }: Props) {
  const topGun = Object.entries(stats.killsByGun).sort(([, a], [, b]) => b - a)[0]
  const topChem = Object.entries(stats.chemsSold)
    .sort(([, a], [, b]) => b.profitEarned - a.profitEarned)[0]

  const winRate = stats.combatsFought > 0
    ? Math.round((stats.combatsWon / stats.combatsFought) * 100)
    : null

  return (
    <div className="space-y-4 text-sm font-mono">
      {/* Combat */}
      <div>
        <div className="pip-label mb-2">Combat</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <div className="text-pip-green-dim">Enemies killed</div>
          <div className="text-pip-green font-display">{stats.totalKills.toLocaleString()}</div>

          <div className="text-pip-green-dim">Combats won</div>
          <div className="text-pip-green font-display">
            {stats.combatsWon} / {stats.combatsFought}
            {winRate !== null && <span className="text-pip-green-dim ml-1">({winRate}%)</span>}
          </div>

          {stats.combatsFled > 0 && (
            <>
              <div className="text-pip-green-dim">Times fled</div>
              <div className="text-pip-green font-display">{stats.combatsFled}</div>
            </>
          )}

          {stats.secondWavesDefeated > 0 && (
            <>
              <div className="text-pip-green-dim">2nd waves defeated</div>
              <div className="text-pip-green font-display">{stats.secondWavesDefeated}</div>
            </>
          )}

          <div className="text-pip-green-dim">Damage dealt</div>
          <div className="text-pip-green font-display">{stats.totalDamageDealt.toLocaleString()}</div>

          <div className="text-pip-green-dim">Damage taken</div>
          <div className="text-pip-green font-display">{stats.totalDamageTaken.toLocaleString()}</div>

          {stats.capsFromCombat > 0 && (
            <>
              <div className="text-pip-green-dim">Caps from combat</div>
              <div className="text-pip-green font-display">{stats.capsFromCombat.toLocaleString()} ¤</div>
            </>
          )}

          {topGun && (
            <>
              <div className="text-pip-green-dim">Favorite weapon</div>
              <div className="text-pip-green font-display">
                {topGun[0] === 'unarmed' ? 'Bare hands' : (mc.guns[topGun[0]]?.name ?? topGun[0])}
                <span className="text-pip-green-dim ml-1">({topGun[1]}k)</span>
              </div>
            </>
          )}
        </div>

        {stats.totalKills > 0 && Object.keys(stats.killsByEnemy).length > 0 && (
          <div className="mt-2 space-y-0.5">
            {Object.entries(stats.killsByEnemy)
              .sort(([, a], [, b]) => b - a)
              .map(([typeId, count]) => {
                const enemyDef = mc.enemies.find(e => e.id === typeId)
                return (
                  <div key={typeId} className="flex justify-between text-xs">
                    <span className="text-pip-green-dim">{enemyDef?.name ?? typeId}</span>
                    <span className="text-pip-green font-display">{count}</span>
                  </div>
                )
              })}
          </div>
        )}
      </div>

      {/* Trading */}
      {(Object.keys(stats.chemsSold).length > 0 || stats.lifetimeCapsEarned > 0) && (
        <div>
          <div className="pip-label mb-2">Trading</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <div className="text-pip-green-dim">Lifetime caps earned</div>
            <div className="text-pip-green font-display">{stats.lifetimeCapsEarned.toLocaleString()} ¤</div>

            {topChem && (
              <>
                <div className="text-pip-green-dim">Most profitable chem</div>
                <div className="text-pip-green font-display">
                  {topChem[0]}
                  <span className="text-pip-amber ml-1">+{topChem[1].profitEarned.toLocaleString()} ¤</span>
                </div>
              </>
            )}

            {stats.hasSoldToMerchant && (
              <>
                <div className="text-pip-green-dim">Road deals</div>
                <div className="text-pip-green font-display">Yes</div>
              </>
            )}
          </div>

          {Object.keys(stats.chemsSold).length > 0 && (
            <div className="mt-2 space-y-0.5">
              {Object.entries(stats.chemsSold)
                .sort(([, a], [, b]) => b.profitEarned - a.profitEarned)
                .slice(0, 5)
                .map(([chemId, s]) => (
                  <div key={chemId} className="flex justify-between text-xs">
                    <span className="text-pip-green-dim">{chemId} ×{s.qty}</span>
                    <span className={s.profitEarned >= 0 ? 'text-pip-amber' : 'text-pip-red'}>
                      {s.profitEarned >= 0 ? '+' : ''}{s.profitEarned.toLocaleString()} ¤
                    </span>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Taming */}
      {Object.keys(stats.tamesByEnemy).length > 0 && (
        <div>
          <div className="pip-label mb-2">Taming</div>
          <div className="space-y-0.5">
            {Object.entries(stats.tamesByEnemy).map(([typeId, count]) => {
              const enemyDef = mc.enemies.find(e => e.id === typeId)
              return (
                <div key={typeId} className="flex justify-between text-xs">
                  <span className="text-pip-green-dim">{enemyDef?.name ?? typeId}</span>
                  <span className="text-pip-green font-display">{count}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {stats.turnsInDebt > 0 && (
        <div className="text-xs text-pip-green-dim">
          Turns in debt: <span className="text-pip-red font-display">{stats.turnsInDebt}</span>
        </div>
      )}

      {/* XP Breakdown */}
      {stats.xpBySource && Object.values(stats.xpBySource).some(v => v > 0) && (
        <XpBreakdown xpBySource={stats.xpBySource} />
      )}
    </div>
  )
}

function XpBreakdown({ xpBySource }: { xpBySource: import('../../types/stats').XpBySource }) {
  const rows: { label: string; key: keyof typeof xpBySource }[] = [
    { label: 'Combat',           key: 'combat' },
    { label: 'Achievements',     key: 'achievements' },
    { label: 'Trade profit',     key: 'trade' },
    { label: 'Travel/discovery', key: 'travel' },
  ]
  const total = Object.values(xpBySource).reduce((s, v) => s + v, 0)
  return (
    <div>
      <div className="pip-label mb-2">XP Breakdown</div>
      <div className="space-y-1.5">
        {rows.filter(r => xpBySource[r.key] > 0).map(({ label, key }) => {
          const pct = total > 0 ? (xpBySource[key] / total) * 100 : 0
          return (
            <div key={key}>
              <div className="flex justify-between text-xs mb-0.5">
                <span className="text-pip-green-dim">{label}</span>
                <span className="text-pip-blue font-mono">{xpBySource[key].toLocaleString()} XP</span>
              </div>
              <div className="h-1 rounded-full bg-pip-border overflow-hidden">
                <div className="h-full rounded-full bg-pip-blue opacity-60" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )
        })}
        {total > 0 && (
          <div className="flex justify-between text-xs pt-1 border-t border-pip-border-dim">
            <span className="text-pip-green-dim">Total</span>
            <span className="text-pip-blue font-mono font-bold">{total.toLocaleString()} XP</span>
          </div>
        )}
      </div>
    </div>
  )
}
