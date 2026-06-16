// Gameplay tuning functions — centralise balancing formulas here so they're
// easy to find and adjust without hunting through engine logic.

import type { GameType } from '../types/game'

/**
 * Floor on enemy count that grows with turn number in Free Play.
 * Caps at a road-based ceiling so safe roads stay safe regardless of turn.
 *
 * Formula: min(floor(1 + turn/15), 3 + floor(dangerLevel * 4))
 */
export function minEnemyCount(
  turn: number,
  roadDangerLevel: number,
  gameType: GameType,
): number {
  if (gameType !== 'free_play') return 1
  return Math.min(
    Math.floor(1 + turn / 15),
    3 + Math.floor(roadDangerLevel * 4),
  )
}
