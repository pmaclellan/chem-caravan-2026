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
 * Escape chance when running from combat.
 *
 * Each guard (regular or PA) adds +0.10.
 * Each brahmin subtracts 0.12 — intentionally larger than the guard bonus
 * so a full brahmin train is a genuine liability in a fight.
 *
 * Clamped to [0.10, 0.90] so there's always some hope (and some risk).
 *
 * Example table (no PA guards):
 *   0 guards / 0 brahmin → 40%
 *   2 guards / 0 brahmin → 60%
 *   0 guards / 5 brahmin → 10% (clamped)
 *   2 guards / 5 brahmin → 20%
 *   4 guards / 5 brahmin → 40%
 */
export const RUN_BASE_CHANCE     = 0.40
export const RUN_GUARD_BONUS     = 0.10   // per regular or PA guard
export const RUN_BRAHMIN_PENALTY = 0.12   // per brahmin — larger than guard bonus by design

export function runEscapeChance(guards: number, paGuards: number, brahmin: number): number {
  const totalGuards = guards + paGuards
  return Math.min(0.90, Math.max(0.10,
    RUN_BASE_CHANCE + totalGuards * RUN_GUARD_BONUS - brahmin * RUN_BRAHMIN_PENALTY
  ))
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
