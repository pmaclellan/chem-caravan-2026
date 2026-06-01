import { describe, it, expect, vi, afterEach } from 'vitest'
import { initiateCombat, resolveFight, resolveRun } from '../combat'
import * as rngModule from '../rng'
import type { PlayerState } from '../../types/game'

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

describe('initiateCombat', () => {
  it('creates a valid initial combat state', () => {
    const combat = initiateCombat(0.5)
    expect(combat.raiderCount).toBeGreaterThanOrEqual(1)
    expect(combat.raiderHealth).toBeGreaterThan(0)
    expect(combat.raiderCaps).toBeGreaterThan(0)
    expect(combat.phase).toBe('player_choice')
    expect(combat.log.length).toBeGreaterThan(0)
  })

  it('creates more raiders on dangerous roads', () => {
    const lowDanger = initiateCombat(0.1)
    const highDanger = initiateCombat(0.9)
    expect(highDanger.raiderCount).toBeGreaterThanOrEqual(lowDanger.raiderCount)
  })
})

describe('resolveFight', () => {
  it('rejects if no gun', () => {
    const player = makePlayer({ gun: null })
    const combat = initiateCombat(0.4)
    const { combat: result } = resolveFight(player, combat)
    expect(result.log.some(l => l.includes('No ammo'))).toBe(true)
  })

  it('rejects if not enough ammo', () => {
    const player = makePlayer({ gun: { id: 'p', name: 'p', accuracy: 0.7, damage: 40, ammo: 0, ammoPerShot: 1 } })
    const { combat: result } = resolveFight(player, initiateCombat(0.4))
    expect(result.log.some(l => l.includes('No ammo'))).toBe(true)
  })

  it('consumes ammo on shot', () => {
    vi.spyOn(rngModule, 'rng').mockReturnValue(0.5) // always hit; raiders don't kill
    const player = makePlayer()
    const { player: result } = resolveFight(player, initiateCombat(0.1))
    expect(result.gun!.ammo).toBe(19) // started at 20
  })

  it('transitions to won when raider health reaches 0', () => {
    // Mock rng: hit always (< accuracy), raiders hit always but do minimal damage
    const rngSpy = vi.spyOn(rngModule, 'rng').mockReturnValue(0.01)
    vi.spyOn(rngModule, 'rngInt').mockReturnValue(1)
    const player = makePlayer({ gun: { id: 'p', name: 'p', accuracy: 1.0, damage: 9999, ammo: 20, ammoPerShot: 1 } })
    const combat = initiateCombat(0.1)
    const { combat: result } = resolveFight(player, combat)
    expect(result.phase).toBe('won')
    rngSpy.mockRestore()
  })

  it('transitions to lost when player health reaches 0', () => {
    vi.spyOn(rngModule, 'rng').mockReturnValue(0.99) // miss; raiders hit;
    vi.spyOn(rngModule, 'rngInt').mockReturnValue(999)
    const player = makePlayer({ health: 1 })
    const combat = initiateCombat(0.8)
    const { combat: result } = resolveFight(player, combat)
    expect(result.phase).toBe('lost')
  })
})

describe('resolveRun', () => {
  it('succeeds when rng favors escape', () => {
    vi.spyOn(rngModule, 'rng').mockReturnValue(0.01) // well below run chance
    const { combat } = resolveRun(makePlayer(), initiateCombat(0.4))
    expect(['fled', 'player_choice']).toContain(combat.phase)
    // fled is set on success
    expect(combat.phase).toBe('fled')
  })

  it('fails and damages player when rng is against escape', () => {
    vi.spyOn(rngModule, 'rng').mockReturnValue(0.99) // above run chance
    vi.spyOn(rngModule, 'rngInt').mockReturnValue(20)
    const player = makePlayer({ health: 100 })
    const { player: result } = resolveRun(player, initiateCombat(0.4))
    expect(result.health).toBeLessThan(100)
  })

  it('guards improve run chance (reflected in outcome probability)', () => {
    // With many guards, even a high rng should still succeed more often — verify formula
    // base=0.4 + 5*0.1 = 0.9 (with 5 guards). rng=0.85 should succeed.
    const rngSpy = vi.spyOn(rngModule, 'rng').mockReturnValue(0.85)
    const player = makePlayer({ guards: 5, brahmin: 0 })
    const { combat } = resolveRun(player, initiateCombat(0.4))
    expect(combat.phase).toBe('fled')
    rngSpy.mockRestore()
  })
})
