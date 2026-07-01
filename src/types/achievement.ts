import type { GameModeId } from './game'

export interface AchievementDef {
  id: string
  name: string
  description: string
  icon: string          // filename in /public/assets/icons/
  xpReward: number
  modeFilter?: GameModeId[]  // if set, only unlockable in these modes
}

export interface EarnedAchievement {
  id: string
  earnedOnTurn: number
}
