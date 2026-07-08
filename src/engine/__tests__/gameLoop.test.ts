import { describe, it, expect, vi, afterEach } from 'vitest'
import { initializeGame, afterCombat } from '../gameLoop'
import { shouldEscalateWave } from '../tuning'
import * as rngModule from '../rng'
import type { CombatState, GameState, TravelEvent } from '../../types/game'

afterEach(() => {
  vi.restoreAllMocks()
})

// ── shouldEscalateWave ──────────────────────────────────────────────────────

describe('shouldEscalateWave', () => {
  it('matches the original wave-2 formula exactly (no regression)', () => {
    vi.spyOn(rngModule, 'rng').mockReturnValue(0.10)
    // dangerLevel 0.55, threshold 0.40 -> roll needs to be < 0.15
    expect(shouldEscalateWave(1, 0.55, 1, 'standard')).toBe(true)
  })

  it('never escalates past wave 4', () => {
    expect(shouldEscalateWave(4, 0.99, 999, 'free_play')).toBe(false)
  })

  it('gates wave 3 behind turn 50 in free play', () => {
    vi.spyOn(rngModule, 'rng').mockReturnValue(0.01)
    expect(shouldEscalateWave(2, 0.85, 49, 'free_play')).toBe(false)
    expect(shouldEscalateWave(2, 0.85, 50, 'free_play')).toBe(true)
  })

  it('gates wave 4 behind turn 75 in free play', () => {
    vi.spyOn(rngModule, 'rng').mockReturnValue(0.01)
    expect(shouldEscalateWave(3, 0.85, 74, 'free_play')).toBe(false)
    expect(shouldEscalateWave(3, 0.85, 75, 'free_play')).toBe(true)
  })

  it('never escalates waves 3/4 in standard mode regardless of turn', () => {
    vi.spyOn(rngModule, 'rng').mockReturnValue(0.01)
    expect(shouldEscalateWave(2, 0.85, 100, 'standard')).toBe(false)
    expect(shouldEscalateWave(3, 0.85, 200, 'standard')).toBe(false)
  })

  it('reaches wave 3/4 on Commonwealth-level danger (0.58) given enough turns', () => {
    // Commonwealth's toughest road tops out at 0.58 — the danger floor must not exceed this
    vi.spyOn(rngModule, 'rng').mockReturnValue(0.01)
    expect(shouldEscalateWave(2, 0.58, 50, 'free_play')).toBe(true)
    expect(shouldEscalateWave(3, 0.58, 75, 'free_play')).toBe(true)
  })
})

// ── afterCombat — prior-wave loot carry-forward ─────────────────────────────

describe('afterCombat — wave escalation carries cumulative loot forward', () => {
  it('sums prior-wave caps/xp/loot with the just-resolved wave, not just the latest', () => {
    vi.spyOn(rngModule, 'rng').mockReturnValue(0.01) // guarantees escalation triggers

    const state: GameState = {
      ...initializeGame('Test', 'mojave_wasteland', 'free_play'),
      pendingDestination: 'nelson',
    }
    const stateAtNovac: GameState = { ...state, player: { ...state.player, location: 'novac' }, world: { ...state.world, turn: 60 } }

    const combat: CombatState = {
      enemies: [],
      capsPool: 0,
      totalDamageDealt: 0,
      totalDamageTaken: 0,
      enemyLoot: { stimpak: 2 },
      capsLooted: 100,
      xpGained: 50,
      phase: 'won',
      log: [],
      waveNumber: 2,
      isCheckpointFight: false,
      priorWaveCapsLooted: 40,   // from wave 1
      priorWaveXpGained: 20,     // from wave 1
      priorWaveEnemyLoot: { jet: 3 },
      activeBuffs: [],
      chemUsedThisRound: false,
    }

    const result = afterCombat(stateAtNovac, { player: stateAtNovac.player, combat })
    expect(result.phase).toBe('event')
    const payload = (result.pendingEvent as TravelEvent).payload as {
      nextWaveNumber: number; priorWaveCaps: number; priorWaveXp: number; priorWaveLoot: Record<string, number>
    }
    expect(payload.nextWaveNumber).toBe(3)
    expect(payload.priorWaveCaps).toBe(140)   // 100 (wave 2) + 40 (wave 1)
    expect(payload.priorWaveXp).toBe(70)      // 50 (wave 2) + 20 (wave 1)
    expect(payload.priorWaveLoot).toEqual({ stimpak: 2, jet: 3 })
  })

  it('does not escalate past wave 4', () => {
    vi.spyOn(rngModule, 'rng').mockReturnValue(0.01)
    const state: GameState = {
      ...initializeGame('Test', 'mojave_wasteland', 'free_play'),
      pendingDestination: 'nelson',
    }
    const stateAtNovac: GameState = { ...state, player: { ...state.player, location: 'novac' }, world: { ...state.world, turn: 100 } }
    const combat: CombatState = {
      enemies: [], capsPool: 0, totalDamageDealt: 0, totalDamageTaken: 0, enemyLoot: {}, capsLooted: 0, xpGained: 0,
      phase: 'won', log: [], waveNumber: 4, isCheckpointFight: false,
      priorWaveCapsLooted: 0, priorWaveXpGained: 0, priorWaveEnemyLoot: {}, activeBuffs: [], chemUsedThisRound: false,
    }
    const result = afterCombat(stateAtNovac, { player: stateAtNovac.player, combat })
    expect(result.phase).toBe('combat_summary')
  })
})
