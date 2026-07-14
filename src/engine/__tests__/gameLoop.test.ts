import { describe, it, expect, vi, afterEach } from 'vitest'
import { initializeGame, afterCombat, completeTravel, continueTravel, startCombat, startTravel } from '../gameLoop'
import { shouldEscalateWave } from '../tuning'
import * as rngModule from '../rng'
import type { CombatState, GameState, PlayerState, TravelEvent } from '../../types/game'

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

  it('danger floor sits at 0.45, not the original 0.55', () => {
    vi.spyOn(rngModule, 'rng').mockReturnValue(0.01)
    expect(shouldEscalateWave(1, 0.44, 1, 'standard')).toBe(false)
    expect(shouldEscalateWave(1, 0.45, 1, 'standard')).toBe(true)
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
      chemUsesThisRound: 0,
      replaySteps: [],
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
      priorWaveCapsLooted: 0, priorWaveXpGained: 0, priorWaveEnemyLoot: {}, activeBuffs: [], chemUsesThisRound: 0,
      replaySteps: [],
    }
    const result = afterCombat(stateAtNovac, { player: stateAtNovac.player, combat })
    expect(result.phase).toBe('combat_summary')
  })
})

// ── startCombat — activeBuffs carry across wave escalation ──────────────────

describe('startCombat — wave escalation carries activeBuffs forward', () => {
  it('does not wipe a Jet/Ultrajet buff still in effect when a new wave starts', () => {
    const base = initializeGame('Test', 'mojave_wasteland', 'free_play')
    const priorBuff = { id: 'jet_guard_1_0_1', chemId: 'jet', targetKind: 'guard' as const, targetId: 'guard_1', accuracyBonus: 0.1125, roundsRemaining: 1 }
    const priorCombat: CombatState = {
      enemies: [], capsPool: 0, totalDamageDealt: 0, totalDamageTaken: 0, enemyLoot: {}, capsLooted: 0, xpGained: 0,
      phase: 'won', log: [], waveNumber: 1, isCheckpointFight: false,
      priorWaveCapsLooted: 0, priorWaveXpGained: 0, priorWaveEnemyLoot: {},
      activeBuffs: [priorBuff], chemUsesThisRound: 0, replaySteps: [],
    }
    const state: GameState = {
      ...base,
      player: { ...base.player, location: 'novac' },
      combat: priorCombat,
      pendingDestination: 'nelson',
      pendingEvent: {
        type: 'raider_ambush',
        title: 'SECOND WAVE!',
        description: '',
        payload: { nextWaveNumber: 2, enemyTypeId: 'viper', count: 1, priorWaveCaps: 0, priorWaveXp: 0, priorWaveLoot: {} },
      },
    }

    const result = startCombat(state)

    expect(result.combat!.waveNumber).toBe(2)
    expect(result.combat!.activeBuffs).toEqual([priorBuff])
  })

  it('starts with no buffs for a fresh (non-escalated) combat', () => {
    const base = initializeGame('Test', 'mojave_wasteland', 'free_play')
    const state: GameState = { ...base, player: { ...base.player, location: 'novac' }, pendingDestination: 'nelson' }

    const result = startCombat(state)

    expect(result.combat!.waveNumber).toBe(1)
    expect(result.combat!.activeBuffs).toEqual([])
  })
})

// ── afterCombat — death screen text ─────────────────────────────────────────

describe('afterCombat — killed-by message', () => {
  it('pluralizes Cazador as Cazadores, not Cazadors', () => {
    const state: GameState = initializeGame('Test', 'mojave_wasteland', 'free_play')
    const combat: CombatState = {
      enemies: [{ id: 'enemy_0', typeId: 'cazador', name: 'Cazador', health: 0, maxHealth: 40, dead: true }],
      capsPool: 0, totalDamageDealt: 0, totalDamageTaken: 0, enemyLoot: {}, capsLooted: 0, xpGained: 0,
      phase: 'lost', log: [], waveNumber: 1, isCheckpointFight: false,
      priorWaveCapsLooted: 0, priorWaveXpGained: 0, priorWaveEnemyLoot: {}, activeBuffs: [], chemUsesThisRound: 0,
      replaySteps: [],
    }
    const result = afterCombat(state, { player: state.player, combat })
    expect(result.endReason).toBe('Killed by Cazadores on the road')
  })
})

// ── afterCombat — weapon/guard reload cooldown clearing ────────────────────

describe('afterCombat — reload cooldown clearing', () => {
  function playerWithCooldowns(basePlayer: PlayerState): PlayerState {
    return {
      ...basePlayer,
      gun: { id: 'missile_launcher', name: 'Missile Launcher', accuracy: 0.8, damage: 220, ammo: 5, ammoPerShot: 1, ammoPrice: 100, cooldownTurns: 2, cooldownRemaining: 2 },
      guards: [{ id: 'guard_0', classId: 'sniper', health: 40, maxHealth: 40, dead: false, cooldownRemaining: 1 }],
    }
  }

  it('clears gun and guard reload cooldowns when combat is genuinely over (no next wave)', () => {
    vi.spyOn(rngModule, 'rng').mockReturnValue(0.99) // guarantees no escalation
    const state: GameState = {
      ...initializeGame('Test', 'mojave_wasteland', 'free_play'),
      pendingDestination: 'nelson',
    }
    const stateAtNovac: GameState = { ...state, player: { ...state.player, location: 'novac' }, world: { ...state.world, turn: 60 } }
    const player = playerWithCooldowns(stateAtNovac.player)
    const combat: CombatState = {
      enemies: [], capsPool: 0, totalDamageDealt: 0, totalDamageTaken: 0, enemyLoot: {}, capsLooted: 0, xpGained: 0,
      phase: 'won', log: [], waveNumber: 1, isCheckpointFight: false,
      priorWaveCapsLooted: 0, priorWaveXpGained: 0, priorWaveEnemyLoot: {}, activeBuffs: [], chemUsesThisRound: 0,
      replaySteps: [],
    }
    const result = afterCombat(stateAtNovac, { player, combat })
    expect(result.phase).toBe('combat_summary')
    expect(result.player.gun!.cooldownRemaining).toBe(0)
    expect(result.player.guards[0].cooldownRemaining).toBe(0)
  })

  it('does NOT clear cooldowns when a next wave is about to chain in — no time to reload', () => {
    vi.spyOn(rngModule, 'rng').mockReturnValue(0.01) // guarantees escalation triggers
    const state: GameState = {
      ...initializeGame('Test', 'mojave_wasteland', 'free_play'),
      pendingDestination: 'nelson',
    }
    const stateAtNovac: GameState = { ...state, player: { ...state.player, location: 'novac' }, world: { ...state.world, turn: 60 } }
    const player = playerWithCooldowns(stateAtNovac.player)
    const combat: CombatState = {
      enemies: [], capsPool: 0, totalDamageDealt: 0, totalDamageTaken: 0, enemyLoot: {}, capsLooted: 0, xpGained: 0,
      phase: 'won', log: [], waveNumber: 1, isCheckpointFight: false,
      priorWaveCapsLooted: 0, priorWaveXpGained: 0, priorWaveEnemyLoot: {}, activeBuffs: [], chemUsesThisRound: 0,
      replaySteps: [],
    }
    const result = afterCombat(stateAtNovac, { player, combat })
    expect(result.phase).toBe('event')
    expect(result.player.gun!.cooldownRemaining).toBe(2)
    expect(result.player.guards[0].cooldownRemaining).toBe(1)
  })
})

// ── startTravel — turn-limit gate ───────────────────────────────────────────

describe('startTravel — turn-limit gate', () => {
  it('ends the run at turn === maxTurns instead of letting the player travel one turn past it', () => {
    const state = initializeGame('Test', 'commonwealth', 'standard')
    const atLimit: GameState = { ...state, world: { ...state.world, turn: state.world.maxTurns! } }
    const result = startTravel(atLimit, 'park_street_station')
    expect(result.phase).toBe('game_over')
    expect(result.gameOverReason).toBe('turns')
    expect(result.world.turn).toBe(state.world.maxTurns)  // never increments past the advertised limit
  })

  it('still travels normally one turn before the limit', () => {
    const state = initializeGame('Test', 'commonwealth', 'standard')
    const oneBeforeLimit: GameState = { ...state, world: { ...state.world, turn: state.world.maxTurns! - 1 } }
    const result = startTravel(oneBeforeLimit, 'park_street_station')
    expect(result.phase).toBe('traveling')
    expect(result.pendingDestination).toBe('park_street_station')
  })

  it('never gates free play, which has no turn limit', () => {
    const state = initializeGame('Test', 'commonwealth', 'free_play')
    const wayPastCommonwealthsStandardLimit: GameState = { ...state, world: { ...state.world, turn: 500 } }
    const result = startTravel(wayPastCommonwealthsStandardLimit, 'park_street_station')
    expect(result.phase).toBe('traveling')
  })
})

// ── continueTravel — debt payment window ────────────────────────────────────

describe('continueTravel — debt payment window', () => {
  function playerMidWindow(basePlayer: PlayerState, overrides: Partial<PlayerState> = {}): PlayerState {
    return {
      ...basePlayer,
      debt: 1000,
      ageOfDebt: 10,               // commonwealth grace period is 10
      debtWindowStartAge: 10,
      debtWindowMinPayment: 150,   // locked target: 15% of 1000
      debtWindowCapsPaid: 0,
      caps: 5000,
      ...overrides,
    }
  }

  it('satisfies the window against the LOCKED target, not a fresh recompute off post-interest debt', () => {
    vi.spyOn(rngModule, 'rng').mockReturnValue(0.99) // no ambush/random event this tick
    const state = initializeGame('Test', 'commonwealth', 'standard')
    const player = playerMidWindow(state.player, { debtPaidThisCycle: 150 }) // pays exactly the locked target
    const result = continueTravel({ ...state, player, pendingDestination: 'park_street_station' })

    // Post-interest debt is 1050 (5% interest) — a fresh 15% recompute would demand 158,
    // which this payment doesn't cover. The window must still reset off the locked 150.
    expect(result.player.debt).toBe(1050)
    expect(result.player.debtWindowCapsPaid).toBe(0)
    expect(result.player.debtWindowStartAge).toBe(result.player.ageOfDebt)
  })

  it('does not satisfy the window when the locked target is unmet', () => {
    vi.spyOn(rngModule, 'rng').mockReturnValue(0.99)
    const state = initializeGame('Test', 'commonwealth', 'standard')
    const player = playerMidWindow(state.player, { debtPaidThisCycle: 100 })
    const result = continueTravel({ ...state, player, pendingDestination: 'park_street_station' })

    expect(result.player.debtWindowCapsPaid).toBe(100)
    expect(result.player.debtWindowStartAge).toBe(10) // unchanged — window still open
  })

  it('de-escalates debtWarnings by 1 when a window is satisfied', () => {
    vi.spyOn(rngModule, 'rng').mockReturnValue(0.99)
    const state = initializeGame('Test', 'commonwealth', 'standard')
    const player = playerMidWindow(state.player, { debtPaidThisCycle: 150, debtWarnings: 2 })
    const result = continueTravel({ ...state, player, pendingDestination: 'park_street_station' })

    expect(result.player.debtWarnings).toBe(1)
  })

  it('does not decrement debtWarnings below 0', () => {
    vi.spyOn(rngModule, 'rng').mockReturnValue(0.99)
    const state = initializeGame('Test', 'commonwealth', 'standard')
    const player = playerMidWindow(state.player, { debtPaidThisCycle: 150, debtWarnings: 0 })
    const result = continueTravel({ ...state, player, pendingDestination: 'park_street_station' })

    expect(result.player.debtWarnings).toBe(0)
  })

  it('leaves debtWarnings untouched when the window is not satisfied', () => {
    vi.spyOn(rngModule, 'rng').mockReturnValue(0.99)
    const state = initializeGame('Test', 'commonwealth', 'standard')
    const player = playerMidWindow(state.player, { debtPaidThisCycle: 0, debtWarnings: 2 })
    const result = continueTravel({ ...state, player, pendingDestination: 'park_street_station' })

    expect(result.player.debtWarnings).toBe(2)
  })
})

// ── completeTravel — PA guard HP (doctor) vs AP (armory) auto-repair ───────

describe('completeTravel — PA guard healing/repair', () => {
  function woundedPAGuardPlayer(basePlayer: PlayerState): PlayerState {
    return {
      ...basePlayer,
      paGuards: [{ id: 'pa_0', health: 20, maxHealth: 50, armorPoints: 10, maxArmorPoints: 100, dead: false }],
    }
  }

  it('repairs armor but not HP at a settlement with an armory but no doctor', () => {
    const state = initializeGame('Test', 'commonwealth', 'standard')
    const player = woundedPAGuardPlayer(state.player)
    // park_street_station: hasDoctor: false, hasArmory: true
    const result = completeTravel({ ...state, player }, 'park_street_station')
    expect(result.player.paGuards[0].armorPoints).toBe(100)
    expect(result.player.paGuards[0].health).toBe(20)
  })

  it('heals HP and repairs armor at a settlement with both a doctor and an armory', () => {
    const state = initializeGame('Test', 'commonwealth', 'standard')
    const player = woundedPAGuardPlayer(state.player)
    // diamond_city: hasDoctor: true, hasArmory: true
    const result = completeTravel({ ...state, player }, 'diamond_city')
    expect(result.player.paGuards[0].armorPoints).toBe(100)
    expect(result.player.paGuards[0].health).toBe(50)
  })
})
