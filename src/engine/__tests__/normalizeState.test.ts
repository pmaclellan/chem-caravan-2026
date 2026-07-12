import { describe, it, expect } from 'vitest'
import { normalizeState } from '../normalizeState'
import { initializeGame } from '../gameLoop'
import type { GameState } from '../../types/game'

describe('normalizeState — corrupted numeric/array fields', () => {
  it('coerces null caps/health/guards/stats fields to safe non-crashing values', () => {
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
    expect(result.stats.totalDamageTaken).toBe(0)
    expect(result.stats.totalPayrollPaid).toBe(0)

    expect(() => result.player.caps.toLocaleString()).not.toThrow()
    expect(() => result.stats.totalDamageTaken.toLocaleString()).not.toThrow()
  })
})
