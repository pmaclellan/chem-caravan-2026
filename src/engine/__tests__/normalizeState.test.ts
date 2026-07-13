import { describe, it, expect } from 'vitest'
import { normalizeState } from '../normalizeState'
import { initializeGame } from '../gameLoop'
import type { GameState } from '../../types/game'

describe('normalizeState — corrupted numeric/array fields', () => {
  it('coerces null caps/health/guards/stats/brahmin fields to safe non-crashing values', () => {
    // NaN round-trips through JSON.stringify as null, so a save corrupted by an
    // arithmetic bug elsewhere can persist explicit nulls into fields every
    // .toLocaleString() call site assumes are always numbers/arrays.
    const base = initializeGame('Test', 'capital_wasteland', 'free_play')
    const corrupted: GameState = {
      ...base,
      player: {
        ...base.player,
        caps: null as unknown as number,
        health: null as unknown as number,
        maxHealth: 100,
        guards: null as unknown as GameState['player']['guards'],
        brahmin: null as unknown as number,
      },
      stats: {
        ...base.stats,
        totalDamageTaken: null as unknown as number,
        totalPayrollPaid: null as unknown as number,
      },
    }

    const result = normalizeState(corrupted)

    expect(result.player.caps).toBe(0)
    expect(result.player.health).toBe(100)
    expect(result.player.guards).toEqual([])
    expect(result.player.brahmin).toBe(0)
    expect(result.stats.totalDamageTaken).toBe(0)
    expect(result.stats.totalPayrollPaid).toBe(0)

    expect(() => result.player.caps.toLocaleString()).not.toThrow()
    expect(() => result.stats.totalDamageTaken.toLocaleString()).not.toThrow()
  })

  it('a null brahmin no longer makes runEscapeChance (and therefore every flee attempt) NaN', () => {
    // Math.random() < NaN is always false — a non-finite brahmin previously made fleeing
    // deterministically fail instead of resolving at the normal odds-based chance.
    const base = initializeGame('Test', 'capital_wasteland', 'free_play')
    const corrupted: GameState = {
      ...base,
      player: { ...base.player, brahmin: null as unknown as number },
    }

    const result = normalizeState(corrupted)

    expect(Number.isFinite(result.player.brahmin)).toBe(true)
  })
})
