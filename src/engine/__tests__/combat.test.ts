import { describe, it, expect, vi, afterEach } from 'vitest'
import { initiateCombat, resolveFight, resolveRun, aliveEnemyCount } from '../combat'
import * as rngModule from '../rng'
import type { PlayerState } from '../../types/game'
import type { GameModeConfig } from '../../data/modes'

// Minimal mode config used in all tests — matches Commonwealth values
const testMode: GameModeConfig = {
  id: 'commonwealth',
  name: 'Commonwealth',
  subtitle: 'Fallout 4',
  interestRate: 0.05,
  startingCaps: 2000,
  startingDebt: 2000,
  maxTurns: 30,
  startingHealth: 100,
  startingBrahmin: 1,
  baseCapacity: 20,
  capacityPerBrahmin: 10,
  debtEnforcement: [],
  guardCost: 150,
  guardHealth: 40,
  guardAccuracy: 0.55,
  guardDamage: [20, 35],
  brahminCost: 300,
  doctorCost: 200,
  doctorCostCheap: 100,
  eventBaseProb: 0.10,
  eventDangerScale: 0.60,
  debtCollectorMinAge: 5,
  debtCollectorProb: 0.30,
  marketEventProbPerTurn: 0.15,
  marketEventDurationMin: 1,
  marketEventDurationMax: 2,
  shortageMultiplierMin: 2.0,
  shortageMultiplierMax: 4.0,
  surplusMultiplierMin: 0.25,
  surplusMultiplierMax: 0.55,
  enemies: [
    { id: 'raider', name: 'Raider', caps: [20, 150], lootChems: ['jet', 'psycho'] },
  ],
  enemyStats: {
    raider: { health: 40, damage: [10, 30] },
  },
  availableChemIds: ['jet', 'psycho', 'stimpak'],
}

// Mode with multiple enemy types for weighted spawn tests
const multiEnemyMode: GameModeConfig = {
  ...testMode,
  enemies: [
    { id: 'raider',       name: 'Raider',       caps: [20, 150], lootChems: ['jet'] },
    { id: 'super_mutant', name: 'Super Mutant',  caps: [10, 80],  lootChems: ['psycho'] },
  ],
  enemyStats: {
    raider:       { health: 40, damage: [10, 30] },
    super_mutant: { health: 70, damage: [15, 35] },
  },
  availableChemIds: ['jet', 'psycho', 'stimpak'],
}

function makePlayer(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    name: 'Test',
    caps: 500,
    bank: 0,
    debt: 0,
    health: 100,
    maxHealth: 100,
    guards: 0,
    brahmin: 0,
    location: 'diamond_city',
    ageOfDebt: 0,
    inventory: {},
    gun: { id: 'pistol_10mm', name: '10mm Pistol', accuracy: 0.70, damage: 40, ammo: 20, ammoPerShot: 1 },
    ...overrides,
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

// ── initiateCombat ────────────────────────────────────────────────────────────

describe('initiateCombat', () => {
  it('creates valid EnemyUnit[] with correct initial state', () => {
    const combat = initiateCombat(0.5, testMode)
    expect(combat.enemies.length).toBeGreaterThanOrEqual(1)
    expect(combat.enemies.every(e => !e.dead)).toBe(true)
    expect(combat.enemies.every(e => e.health > 0 && e.health === e.maxHealth)).toBe(true)
    expect(combat.capsPool).toBeGreaterThanOrEqual(0)
    expect(combat.phase).toBe('player_choice')
    expect(combat.log.length).toBeGreaterThan(0)
  })

  it('spawns more enemies on more dangerous roads', () => {
    const low  = initiateCombat(0.1, testMode)
    const high = initiateCombat(0.9, testMode)
    expect(high.enemies.length).toBeGreaterThanOrEqual(low.enemies.length)
  })

  it('enemy health matches mode enemyStats', () => {
    const combat = initiateCombat(0.5, testMode)
    for (const enemy of combat.enemies) {
      expect(enemy.maxHealth).toBe(testMode.enemyStats[enemy.typeId]!.health)
    }
  })

  it('respects road enemy weights — heavy weight produces dominant type', () => {
    // Weight super_mutants 100:1 over raiders — every slot should be super_mutant
    const weights = { raider: 0, super_mutant: 100 }
    const combat = initiateCombat(0.5, multiEnemyMode, weights)
    expect(combat.enemies.every(e => e.typeId === 'super_mutant')).toBe(true)
    // Stats reflect super_mutant definition
    expect(combat.enemies[0].maxHealth).toBe(70)
  })

  it('enemies with higher stats reflect harder mode', () => {
    const harderMode: GameModeConfig = {
      ...testMode,
      enemyStats: { raider: { health: 80, damage: [20, 50] } },
    }
    const combat = initiateCombat(0.5, harderMode)
    expect(combat.enemies.every(e => e.maxHealth === 80)).toBe(true)
  })
})

// ── resolveFight ──────────────────────────────────────────────────────────────

describe('resolveFight', () => {
  it('returns log message if no gun', () => {
    const player = makePlayer({ gun: null })
    const combat = initiateCombat(0.4, testMode)
    const { combat: result } = resolveFight(player, combat, testMode)
    expect(result.log.some(l => l.includes('no weapon'))).toBe(true)
  })

  it('returns log message if no ammo', () => {
    const player = makePlayer({ gun: { id: 'p', name: 'p', accuracy: 0.7, damage: 40, ammo: 0, ammoPerShot: 1 } })
    const { combat: result } = resolveFight(player, initiateCombat(0.4, testMode), testMode)
    expect(result.log.some(l => l.includes('No ammo'))).toBe(true)
  })

  it('consumes ammo on player shot', () => {
    vi.spyOn(rngModule, 'rng').mockReturnValue(0.5)
    const player = makePlayer()
    const { player: result } = resolveFight(player, initiateCombat(0.1, testMode), testMode)
    // Player fired once (ammoPerShot = 1), no guards
    expect(result.gun!.ammo).toBe(19)
  })

  it('targets first alive enemy and reduces its health', () => {
    vi.spyOn(rngModule, 'rng').mockReturnValue(0.01) // always hit; low rng means min damage from enemies
    vi.spyOn(rngModule, 'rngInt').mockReturnValue(1)
    const player = makePlayer()
    const combat = initiateCombat(0.4, testMode)
    const { combat: result } = resolveFight(player, combat, testMode)
    const firstEnemy = result.enemies[0]
    // Either damaged or dead
    expect(firstEnemy.health).toBeLessThan(firstEnemy.maxHealth)
  })

  it('marks enemy dead when health reaches 0', () => {
    vi.spyOn(rngModule, 'rng').mockReturnValue(0.01)
    vi.spyOn(rngModule, 'rngInt').mockReturnValue(1)
    const player = makePlayer({ gun: { id: 'p', name: 'p', accuracy: 1.0, damage: 9999, ammo: 20, ammoPerShot: 1 } })
    const combat = initiateCombat(0.1, testMode) // 1 enemy at low danger
    const { combat: result } = resolveFight(player, combat, testMode)
    expect(result.phase).toBe('won')
    expect(result.enemies.every(e => e.dead)).toBe(true)
  })

  it('transitions to lost when player health reaches 0', () => {
    vi.spyOn(rngModule, 'rng').mockReturnValue(0.99)   // player misses; enemies always hit max
    vi.spyOn(rngModule, 'rngInt').mockReturnValue(999)
    const player = makePlayer({ health: 1 })
    const combat = initiateCombat(0.8, testMode)
    const { combat: result } = resolveFight(player, combat, testMode)
    expect(result.phase).toBe('lost')
  })

  it('guards fire and consume ammo from shared pool', () => {
    // Always hit so we can count damage
    vi.spyOn(rngModule, 'rng').mockReturnValue(0.01)
    vi.spyOn(rngModule, 'rngInt').mockReturnValue(1)
    const player = makePlayer({ guards: 2, gun: { id: 'p', name: 'p', accuracy: 1.0, damage: 5, ammo: 10, ammoPerShot: 1 } })
    const combat = initiateCombat(0.5, testMode)
    const { player: result } = resolveFight(player, combat, testMode)
    // Player spent 1 ammo + 2 guards spent 1 each = 3 total consumed
    expect(result.gun!.ammo).toBe(7)
  })

  it('guards stop firing if ammo runs out mid-turn', () => {
    vi.spyOn(rngModule, 'rng').mockReturnValue(0.01)
    vi.spyOn(rngModule, 'rngInt').mockReturnValue(1)
    // Player has 2 ammo, 3 guards — player uses 1, guard 1 uses 1, guard 2 and 3 get nothing
    const player = makePlayer({ guards: 3, gun: { id: 'p', name: 'p', accuracy: 1.0, damage: 5, ammo: 2, ammoPerShot: 1 } })
    const combat = initiateCombat(0.5, testMode)
    const { player: result } = resolveFight(player, combat, testMode)
    expect(result.gun!.ammo).toBe(0)
  })

  it('tracks totalDamageDealt correctly across hits', () => {
    vi.spyOn(rngModule, 'rng').mockReturnValue(0.01)
    vi.spyOn(rngModule, 'rngInt').mockReturnValue(1)
    const player = makePlayer({ gun: { id: 'p', name: 'p', accuracy: 1.0, damage: 10, ammo: 20, ammoPerShot: 1 } })
    const combat = initiateCombat(0.1, testMode)
    const { combat: result } = resolveFight(player, combat, testMode)
    expect(result.totalDamageDealt).toBeGreaterThan(0)
  })
})

// ── resolveRun ────────────────────────────────────────────────────────────────

describe('resolveRun', () => {
  it('sets phase to fled on successful escape', () => {
    vi.spyOn(rngModule, 'rng').mockReturnValue(0.01)
    const { combat } = resolveRun(makePlayer(), initiateCombat(0.4, testMode), testMode)
    expect(combat.phase).toBe('fled')
  })

  it('damages player on failed escape attempt', () => {
    vi.spyOn(rngModule, 'rng').mockReturnValue(0.99)
    vi.spyOn(rngModule, 'rngInt').mockReturnValue(20)
    const player = makePlayer({ health: 100 })
    const { player: result } = resolveRun(player, initiateCombat(0.4, testMode), testMode)
    expect(result.health).toBeLessThan(100)
  })

  it('guards improve run chance — 5 guards at rng=0.85 should escape', () => {
    vi.spyOn(rngModule, 'rng').mockReturnValue(0.85)
    const player = makePlayer({ guards: 5, brahmin: 0 })
    const { combat } = resolveRun(player, initiateCombat(0.4, testMode), testMode)
    expect(combat.phase).toBe('fled')
  })

  it('brahmin penalise escape chance', () => {
    // base 0.4 + 0 guards - 4 brahmin * 0.05 = 0.20. rng=0.15 should escape, rng=0.25 should fail
    vi.spyOn(rngModule, 'rng').mockReturnValue(0.25)
    vi.spyOn(rngModule, 'rngInt').mockReturnValue(5)
    const player = makePlayer({ brahmin: 4, guards: 0 })
    const { combat } = resolveRun(player, initiateCombat(0.4, testMode), testMode)
    expect(combat.phase).toBe('player_choice') // failed to flee
  })

  it('flee damage scales with alive enemy damage range', () => {
    vi.spyOn(rngModule, 'rng').mockReturnValue(0.99) // fail to flee
    vi.spyOn(rngModule, 'rngInt').mockReturnValue(20) // mid-damage
    const harderMode: GameModeConfig = {
      ...testMode,
      enemyStats: { raider: { health: 40, damage: [30, 60] } },
    }
    const combat = initiateCombat(0.2, harderMode) // 1 enemy
    const player = makePlayer({ health: 200 })
    const { player: result } = resolveRun(player, combat, harderMode)
    // Flee damage is ~half of enemy's damage range
    expect(result.health).toBeLessThan(200)
  })
})

// ── aliveEnemyCount ───────────────────────────────────────────────────────────

describe('aliveEnemyCount', () => {
  it('counts only living enemies', () => {
    const combat = initiateCombat(0.6, testMode) // ~3 enemies
    expect(aliveEnemyCount(combat)).toBe(combat.enemies.length)

    const withDead = {
      ...combat,
      enemies: combat.enemies.map((e, i) => i === 0 ? { ...e, dead: true } : e),
    }
    expect(aliveEnemyCount(withDead)).toBe(combat.enemies.length - 1)
  })
})
