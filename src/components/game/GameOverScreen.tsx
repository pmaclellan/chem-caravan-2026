import { useEffect, useState } from 'react'
import { GAME_MODES } from '../../data/modes'
import { inventoryBaseValue, calculateNetWorth } from '../../engine/economy'
import type { GameState } from '../../types/game'
import type { RunStats } from '../../types/stats'

const KEYFRAMES = `
  @keyframes gosFadeUp {
    from { opacity: 0; transform: translateY(14px); }
    to   { opacity: 1; transform: translateY(0); }
  }
`

function useCountUp(target: number, duration = 700, startDelay = 0, enabled = false) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!enabled) { setVal(0); return }
    if (target === 0) { setVal(0); return }
    let raf: number
    const timeout = setTimeout(() => {
      const t0 = performance.now()
      const step = (now: number) => {
        const p = Math.min((now - t0) / duration, 1)
        setVal(Math.round(target * (1 - Math.pow(1 - p, 3))))
        if (p < 1) raf = requestAnimationFrame(step)
        else setVal(target)
      }
      raf = requestAnimationFrame(step)
    }, startDelay)
    return () => { clearTimeout(timeout); cancelAnimationFrame(raf) }
  }, [target, duration, startDelay, enabled])
  return val
}

function fadeStyle(visible: boolean, delay = 0): React.CSSProperties {
  return {
    opacity: visible ? 1 : 0,
    transform: visible ? 'translateY(0)' : 'translateY(10px)',
    transition: `opacity 0.4s ease ${delay}ms, transform 0.4s ease ${delay}ms`,
  }
}

function statHasData(stats: RunStats): boolean {
  return stats.totalKills > 0 || stats.combatsFought > 0 || Object.keys(stats.chemsSold).length > 0
}

type Phase = 'header' | 'info' | 'breakdown' | 'final' | 'buttons'

interface Props {
  gameState: GameState
  onHome: () => void
}

export default function GameOverScreen({ gameState, onHome }: Props) {
  const { player, gameOverReason, endReason, log, stats } = gameState
  const mc = GAME_MODES[gameState.mode]
  const isFreePlay = gameState.gameType === 'free_play'
  const isRetired = gameOverReason === 'retired'
  const isWin = gameOverReason === 'turns' || isRetired

  const [phase, setPhase] = useState<Phase>('header')
  const [logOpen, setLogOpen] = useState(false)

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase('info'),      400),
      setTimeout(() => setPhase('breakdown'), 900),
      setTimeout(() => setPhase('final'),     2400),
      setTimeout(() => setPhase('buttons'),   3800),
    ]
    return () => timers.forEach(clearTimeout)
  }, [])

  const skip = () => setPhase('buttons')

  const subtitle = endReason ?? (
    isRetired                      ? 'You chose to hang up your pack.' :
    gameOverReason === 'turns'     ? 'Time ran out on your caravan run.' :
    gameOverReason === 'combat'    ? 'You were killed on the road.' :
    gameOverReason === 'debt'      ? 'Your debtors finally caught up with you.' :
    'Game ended.'
  )

  const titleText  = isRetired ? 'RETIRED' : isFreePlay ? 'RUN ENDED' : isWin ? 'GAME OVER' : 'YOU DIED'
  const titleColor = isRetired ? 'text-pip-amber' : isWin ? 'text-pip-green' : 'text-pip-red'

  // Net worth breakdown
  const inventoryValue = inventoryBaseValue(player.inventory)
  const gunsValue = Object.values(player.ownedGuns ?? {}).reduce((sum, gun) => sum + (mc.guns[gun.id]?.price ?? 0), 0)
  const armorValue = player.armor
    ? Math.round((player.armor.armorPoints / player.armor.maxArmorPoints) * (mc.armors[player.armor.id]?.price ?? 0))
    : 0
  const netWorth = calculateNetWorth(player, mc)
  // Standard score = net worth; free play score = XP
  const finalScore = isFreePlay ? (player.xp ?? 0) : netWorth

  const showInfo      = phase !== 'header'
  const showBreakdown = phase === 'breakdown' || phase === 'final' || phase === 'buttons'
  const showFinal     = phase === 'final'     || phase === 'buttons'
  const showButtons   = phase === 'buttons'

  // Breakdown count-ups (staggered)
  const capsVal  = useCountUp(player.caps,       600,   0, showBreakdown)
  const invVal   = useCountUp(inventoryValue,    600, 120, showBreakdown)
  const gunsVal  = useCountUp(gunsValue,         500, 240, showBreakdown)
  const armorVal = useCountUp(armorValue,        500, 360, showBreakdown)
  const debtVal  = useCountUp(player.debt,       500, 480, showBreakdown)

  // Final score count-up (net worth for standard, XP for free play)
  const scoreVal = useCountUp(Math.abs(finalScore), 1000, 700, showFinal)

  // Derived stats
  const hasStats = !!stats && statHasData(stats)
  const favoriteGunId = stats && Object.keys(stats.killsByGun).length > 0
    ? Object.entries(stats.killsByGun).sort((a, b) => b[1] - a[1])[0]?.[0]
    : null
  const favoriteWeapon = favoriteGunId && favoriteGunId !== 'unarmed'
    ? (mc.guns[favoriteGunId]?.name ?? favoriteGunId)
    : favoriteGunId === 'unarmed' ? 'Unarmed / guards' : null
  const topChem = stats && Object.keys(stats.chemsSold).length > 0
    ? Object.entries(stats.chemsSold).sort((a, b) => b[1].profitEarned - a[1].profitEarned)[0]
    : null

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 bg-pip-bg"
      data-mode={gameState.mode}
      onClick={phase !== 'buttons' ? skip : undefined}
      style={{ cursor: phase !== 'buttons' ? 'pointer' : 'default' }}
    >
      <style>{KEYFRAMES}</style>
      <div
        className="pip-panel max-w-lg w-full space-y-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Title */}
        <div className="text-center space-y-1" style={{ animation: 'gosFadeUp 0.5s ease both' }}>
          <div className={`font-display text-5xl ${titleColor}`}>{titleText}</div>
          {isFreePlay && <div className="text-pip-amber text-xs font-mono tracking-widest">FREE PLAY</div>}
          <div className="text-pip-green-dim text-sm">{subtitle}</div>
        </div>

        {/* Character info + run stats */}
        <div className="border border-pip-border rounded p-3 space-y-1.5" style={fadeStyle(showInfo)}>
          <div className="flex justify-between text-sm">
            <span className="pip-label">Character</span>
            <span className="text-pip-green">{player.name}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="pip-label">Turns survived</span>
            <span className="text-pip-green">
              {gameState.world.turn}{gameState.world.maxTurns ? ` / ${gameState.world.maxTurns}` : ''}
            </span>
          </div>

          {hasStats && stats && (
            <>
              <div className="border-t border-pip-border-dim pt-1.5 space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="pip-label">Enemies killed</span>
                  <span className="text-pip-green">{stats.totalKills}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="pip-label">Combats won</span>
                  <span className="text-pip-green">{stats.combatsWon} / {stats.combatsFought}</span>
                </div>
                {favoriteWeapon && (
                  <div className="flex justify-between text-sm">
                    <span className="pip-label">Favorite weapon</span>
                    <span className="text-pip-green text-right max-w-[60%] truncate">{favoriteWeapon}</span>
                  </div>
                )}
                {topChem && topChem[1].profitEarned > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="pip-label">Top chem (profit)</span>
                    <span className="text-pip-green">
                      {topChem[0]}
                      <span className="text-pip-green-dim text-xs ml-1">+{topChem[1].profitEarned.toLocaleString()} ¤</span>
                    </span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Net worth breakdown + score */}
        <div className="border border-pip-border rounded p-3 space-y-1.5" style={fadeStyle(showBreakdown)}>
          <div className="flex justify-between text-sm">
            <span className="pip-label">Caps on hand</span>
            <span className="text-pip-green font-mono">{capsVal.toLocaleString()} ¤</span>
          </div>
          {inventoryValue > 0 && (
            <div className="flex justify-between text-sm">
              <span className="pip-label">+ Inventory</span>
              <span className="text-pip-green font-mono">{invVal.toLocaleString()} ¤</span>
            </div>
          )}
          {gunsValue > 0 && (
            <div className="flex justify-between text-sm">
              <span className="pip-label">+ Weapons</span>
              <span className="text-pip-green font-mono">{gunsVal.toLocaleString()} ¤</span>
            </div>
          )}
          {armorValue > 0 && (
            <div className="flex justify-between text-sm">
              <span className="pip-label">+ Armor</span>
              <span className="text-pip-green font-mono">{armorVal.toLocaleString()} ¤</span>
            </div>
          )}
          {player.debt > 0 && (
            <div className="flex justify-between text-sm">
              <span className="pip-label">− Debt</span>
              <span className="text-pip-red font-mono">-{debtVal.toLocaleString()} ¤</span>
            </div>
          )}

          {/* Standard: net worth IS the final score */}
          {!isFreePlay && (
            <div className="border-t border-pip-border pt-2 flex justify-between items-center" style={fadeStyle(showFinal)}>
              <span className="font-display tracking-widest text-pip-green-dim text-sm">FINAL SCORE</span>
              <span className={`font-display text-3xl ${netWorth >= 0 ? 'text-pip-amber' : 'text-pip-red'}`}>
                {netWorth < 0 ? '-' : ''}{scoreVal.toLocaleString()} ¤
              </span>
            </div>
          )}

          {/* Free play: net worth as context, then XP as the score */}
          {isFreePlay && (
            <>
              <div className="border-t border-pip-border pt-1.5 flex justify-between items-baseline">
                <span className="pip-label">Net worth</span>
                <span className={`font-mono text-lg ${netWorth >= 0 ? 'text-pip-green' : 'text-pip-red'}`}>
                  {netWorth < 0 ? '-' : ''}{Math.abs(netWorth).toLocaleString()} ¤
                </span>
              </div>
              <div className="border-t border-pip-border pt-2 flex justify-between items-center" style={fadeStyle(showFinal)}>
                <span className="font-display tracking-widest text-pip-green-dim text-sm">XP EARNED</span>
                <span className="font-display text-3xl text-pip-blue">{scoreVal.toLocaleString()} XP</span>
              </div>
            </>
          )}
        </div>

        {/* XP earned — informational for standard, not part of score */}
        {!isFreePlay && (player.xp ?? 0) > 0 && (
          <div className="flex justify-between text-sm" style={fadeStyle(showFinal)}>
            <span className="pip-label">XP earned</span>
            <span className="text-pip-blue font-mono">{(player.xp ?? 0).toLocaleString()} XP</span>
          </div>
        )}

        {/* Buttons */}
        <div style={{ ...fadeStyle(showButtons), pointerEvents: showButtons ? 'auto' : 'none' }}>
          <div className="flex gap-3 mb-3">
            <button className="pip-btn flex-1" onClick={onHome}>MAIN MENU</button>
            <button className="pip-btn flex-1" onClick={() => { window.location.href = '/leaderboard' }}>LEADERBOARD</button>
          </div>
          <button className="pip-btn w-full text-sm" onClick={() => setLogOpen(o => !o)}>
            {logOpen ? 'HIDE RUN LOG ▲' : `VIEW RUN LOG (${log.length} entries) ▼`}
          </button>
          {logOpen && (
            <div className="border border-pip-border rounded text-left max-h-72 overflow-y-auto mt-2">
              <div className="text-xs font-mono space-y-0.5 p-2">
                {log.map((entry, i) => (
                  <div key={i} className={`log-${entry.type}`}>
                    <span className="text-pip-green-dim">[T{String(entry.turn).padStart(2, '0')}]</span>{' '}
                    {entry.message}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {phase !== 'buttons' && (
          <div className="text-center text-pip-green-dim text-xs opacity-40">tap to skip</div>
        )}
      </div>
    </div>
  )
}
