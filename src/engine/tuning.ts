// Gameplay tuning functions — centralise balancing formulas here so they're
// easy to find and adjust without hunting through engine logic.

import type { GameType } from '../types/game'

/**
 * Cursor speed multiplier for the taming mini-game, based on the creature's
 * current absolute HP (not a fraction). Deathclaws are inherently harder
 * than yao guai at the same fraction because they have more total HP.
 *
 * Formula: 0.4 + currentHP / 100
 * - 140 HP (full deathclaw): 1.8× — very fast
 * -  85 HP (full yao guai):  1.25×
 * -  35 HP (wounded):        0.75×
 * -   0 HP (near dead):      0.4× — slow
 *
 * Stacks multiplicatively with each tool's cursorSpeedMultiplier.
 */
export function tamingCursorSpeedScale(currentHP: number): number {
  return 0.4 + currentHP / 100
}

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
