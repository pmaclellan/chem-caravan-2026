import { ACHIEVEMENTS } from '../../data/achievements'
import type { EarnedAchievement } from '../../types/achievement'
import type { GameModeId } from '../../types/game'

interface Props {
  earnedAchievements: EarnedAchievement[]
  mode: GameModeId
}

export default function AchievementsGrid({ earnedAchievements, mode }: Props) {
  const earnedMap = new Map(earnedAchievements.map(a => [a.id, a]))

  const modeAchievements = ACHIEVEMENTS.filter(
    a => !a.modeFilter || a.modeFilter.includes(mode)
  )

  const earned   = modeAchievements.filter(a => earnedMap.has(a.id))
    .sort((a, b) => (earnedMap.get(b.id)!.earnedOnTurn - earnedMap.get(a.id)!.earnedOnTurn))
  const locked   = modeAchievements.filter(a => !earnedMap.has(a.id))
    .sort((a, b) => b.xpReward - a.xpReward)

  const ordered = [...earned, ...locked]
  const totalXp = earned.reduce((s, a) => s + a.xpReward, 0)

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-baseline">
        <div className="pip-label">
          {earned.length} / {modeAchievements.length} UNLOCKED
        </div>
        {totalXp > 0 && (
          <div className="text-pip-blue text-xs font-mono">+{totalXp.toLocaleString()} XP earned</div>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {ordered.map(def => {
          const earnedEntry = earnedMap.get(def.id)
          const isEarned = !!earnedEntry

          return (
            <div
              key={def.id}
              className={`border rounded p-2.5 flex flex-col gap-1.5 transition-opacity ${
                isEarned
                  ? 'border-pip-amber bg-pip-bg'
                  : 'border-pip-border-dim opacity-40'
              }`}
            >
              <div className="flex items-start justify-between gap-1">
                <img
                  src={`/assets/icons/${def.icon}`}
                  alt=""
                  className="w-7 h-7 flex-shrink-0"
                  style={{ opacity: isEarned ? 0.85 : 0.4 }}
                />
                <span className={`text-xs font-mono font-bold ${isEarned ? 'text-pip-blue' : 'text-pip-green-dim'}`}>
                  +{def.xpReward}
                </span>
              </div>
              <div>
                <div className={`font-display text-xs leading-tight ${isEarned ? 'text-pip-amber' : 'text-pip-green-dim'}`}>
                  {def.name}
                </div>
                <div className="text-pip-green-dim text-xs leading-snug mt-0.5" style={{ fontSize: '0.65rem' }}>
                  {isEarned ? (
                    <span className="text-pip-green-dim">Earned T{earnedEntry.earnedOnTurn}</span>
                  ) : (
                    def.description
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
