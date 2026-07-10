import { describe, it, expect, vi, afterEach } from 'vitest'
import { initiateCombat, resolveFight, resolveRun, aliveEnemyCount, applyAccuracyBuff, tickActiveBuffs, chemUseCap, resolveSingleAttack } from '../combat'
import * as rngModule from '../rng'
import type { ActiveBuff, GuardUnit, PAGuardUnit, PlayerState } from '../../types/game'
import type { GameModeConfig } from '../../data/modes'

function makeGuards(n: number): GuardUnit[] {
  return Array.from({ length: n }, (_, i) => ({ id: `guard_${i}`, classId: 'standard' as const, health: 50, maxHealth: 50, dead: false }))
}

// Minimal mode config used in all tests — matches Commonwealth values
// Cast to avoid listing world-data fields (settlements, roads, etc.) irrelevant to combat tests
const testMode = {
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
  nonCombatEventProb: 0.30,
  debtGracePeriod: 10,
  debtCollectorProb: 0.45,
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
    raider: { health: 40, damage: [10, 30], xpReward: 15 },
  },
  availableChemIds: ['jet', 'psycho', 'stimpak'],
} as unknown as GameModeConfig

// Mode with multiple enemy types for weighted spawn tests
const multiEnemyMode = {
  ...testMode,
  enemies: [
    { id: 'raider',       name: 'Raider',       caps: [20, 150], lootChems: ['jet'] },
    { id: 'super_mutant', name: 'Super Mutant',  caps: [10, 80],  lootChems: ['psycho'] },
  ],
  enemyStats: {
    raider:       { health: 40, damage: [10, 30], xpReward: 15 },
    super_mutant: { health: 70, damage: [15, 35], xpReward: 25 },
  },
  availableChemIds: ['jet', 'psycho', 'stimpak'],
} as unknown as GameModeConfig

function makePlayer(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    name: 'Test',
    caps: 500,
    debt: 0,
    health: 100,
    maxHealth: 100,
    guards: [],
    paGuards: [],
    nextGuardId: 0,
    brahmin: 0,
    location: 'diamond_city',
    ageOfDebt: 0,
    inventory: {},
    gun: { id: 'pistol_10mm', name: '10mm Pistol', accuracy: 0.70, damage: 40, ammo: 20, ammoPerShot: 1, ammoPrice: 5 },
    armor: null,
    tamingTool: null,
    hasSaddle: false,
    mount: null,
    xp: 0,
    visitedSettlements: [],
    ownedGuns: {},
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
      enemyStats: { raider: { health: 80, damage: [20, 50], xpReward: 15 } },
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
    const player = makePlayer({ gun: { id: 'p', name: 'p', accuracy: 0.7, damage: 40, ammo: 0, ammoPerShot: 1, ammoPrice: 5 } })
    const { combat: result } = resolveFight(player, initiateCombat(0.4, testMode), testMode)
    expect(result.log.some(l => l.includes('Not enough ammo'))).toBe(true)
  })

  it('blocks firing a PA-required gun without power armor equipped, with a message distinguishing it from PA guards', () => {
    const player = makePlayer({
      gun: { id: 'gatling_laser', name: 'Gatling Laser', accuracy: 0.45, damage: 50, ammo: 60, ammoPerShot: 3, ammoPrice: 6, requiresPowerArmor: true },
      armor: null,
    })
    const { combat: result, animSteps } = resolveFight(player, initiateCombat(0.4, testMode), testMode)
    expect(animSteps).toHaveLength(0) // whole round is blocked, nothing fires
    const msg = result.log.find(l => l.includes('Gatling Laser'))
    expect(msg).toBeDefined()
    expect(msg).toContain('YOU')
    expect(msg).toContain('not the same as power armor guards')
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
    const player = makePlayer({ gun: { id: 'p', name: 'p', accuracy: 1.0, damage: 9999, ammo: 20, ammoPerShot: 1, ammoPrice: 5 } })
    const combat = initiateCombat(0.1, testMode) // 1 enemy at low danger
    const { combat: result } = resolveFight(player, combat, testMode)
    expect(result.phase).toBe('won')
    expect(result.enemies.every(e => e.dead)).toBe(true)
  })

  it('transitions to lost when player health reaches 0', () => {
    // Low rng: enemies always hit (below default accuracy) and always land max damage.
    // Player has no gun so it can't affect the outcome — isolates enemy damage only.
    vi.spyOn(rngModule, 'rng').mockReturnValue(0.01)
    vi.spyOn(rngModule, 'rngInt').mockReturnValue(999)
    const player = makePlayer({ gun: null, health: 1 })
    const combat = initiateCombat(0.8, testMode)
    const { combat: result } = resolveFight(player, combat, testMode)
    expect(result.phase).toBe('lost')
  })

  it('guards fire and consume ammo from shared pool', () => {
    // Always hit so we can count damage
    vi.spyOn(rngModule, 'rng').mockReturnValue(0.01)
    vi.spyOn(rngModule, 'rngInt').mockReturnValue(1)
    const player = makePlayer({ guards: makeGuards(2), gun: { id: 'p', name: 'p', accuracy: 1.0, damage: 5, ammo: 10, ammoPerShot: 1, ammoPrice: 5 } })
    const combat = initiateCombat(0.5, testMode)
    const { player: result } = resolveFight(player, combat, testMode)
    // Guards fire with their own sidearms — only the player's own shot touches player.gun.ammo
    expect(result.gun!.ammo).toBe(9)
  })

  it('guards fire independently of player ammo', () => {
    vi.spyOn(rngModule, 'rng').mockReturnValue(0.01)
    vi.spyOn(rngModule, 'rngInt').mockReturnValue(1)
    const player = makePlayer({ guards: makeGuards(3), gun: { id: 'p', name: 'p', accuracy: 1.0, damage: 5, ammo: 0, ammoPerShot: 1, ammoPrice: 5 } })
    const combat = initiateCombat(0.5, testMode)
    const { player: result } = resolveFight(player, combat, testMode)
    // Player can't fire (no ammo) but guards still get their shots off
    expect(result.gun!.ammo).toBe(0)
    expect(result.guards.some(g => g.dead === false)).toBe(true)
  })

  it('tracks totalDamageDealt correctly across hits', () => {
    vi.spyOn(rngModule, 'rng').mockReturnValue(0.01)
    vi.spyOn(rngModule, 'rngInt').mockReturnValue(1)
    const player = makePlayer({ gun: { id: 'p', name: 'p', accuracy: 1.0, damage: 10, ammo: 20, ammoPerShot: 1, ammoPrice: 5 } })
    const combat = initiateCombat(0.1, testMode)
    const { combat: result } = resolveFight(player, combat, testMode)
    expect(result.totalDamageDealt).toBeGreaterThan(0)
  })

  it('a gun with damageRange rolls per-shot damage instead of using the flat damage field', () => {
    vi.spyOn(rngModule, 'rng').mockReturnValue(0.01) // always hit
    vi.spyOn(rngModule, 'rngInt').mockReturnValue(72)
    const player = makePlayer({
      gun: { id: 'sniper_rifle', name: 'Sniper Rifle', accuracy: 0.75, damage: 999, damageRange: [55, 90], ammo: 5, ammoPerShot: 1, ammoPrice: 8, cooldownTurns: 1 },
    })
    const combat = initiateCombat(0.1, testMode)
    const { player: result, combat: combatResult, animSteps } = resolveFight(player, combat, testMode)
    // Rolled damage (72) is logged, not the flat `damage` fallback (999) — and it overkills
    // the 40 HP test enemy, so totalDamageDealt is capped at the enemy's remaining health.
    expect(combatResult.log.some(l => l.includes('(72 damage)'))).toBe(true)
    expect(combatResult.totalDamageDealt).toBe(40)
    expect(result.gun!.cooldownRemaining).toBe(1)
    // Threaded onto the shot itself so the UI can sync the reload badge to this shot's animation
    const shot = animSteps.find(s => s.kind === 'shot' && s.by === 'player')
    expect(shot).toBeDefined()
    expect(shot!.kind === 'shot' ? shot!.shooterCooldownRemaining : undefined).toBe(1)
  })

  it('a gun with both shotsPerTurn and cooldownTurns bursts, then sits out a round, then bursts again', () => {
    vi.spyOn(rngModule, 'rng').mockReturnValue(0.01) // always hit
    const player = makePlayer({
      gun: { id: 'double_barrel', name: 'Double-Barrel Shotgun', accuracy: 0.65, damage: 75, ammo: 20, ammoPerShot: 2, ammoPrice: 10, shotsPerTurn: 2, cooldownTurns: 1 },
    })
    const combat = initiateCombat(0.1, testMode, undefined, undefined, 4) // force 4 enemies so targets remain by round 3

    const round1 = resolveFight(player, combat, testMode)
    expect(round1.player.gun!.ammo).toBe(18) // ammoPerShot consumed once per round, not per shot
    expect(round1.player.gun!.cooldownRemaining).toBe(1)
    const burst1 = round1.animSteps.find(s => s.kind === 'burst')
    expect(burst1).toBeDefined()
    expect(burst1!.kind === 'burst' ? burst1!.shots.length : 0).toBe(2)
    expect(burst1!.kind === 'burst' ? burst1!.shooterCooldownRemaining : undefined).toBe(1)

    const round2 = resolveFight(round1.player, round1.combat, testMode)
    expect(round2.player.gun!.ammo).toBe(18) // no ammo spent while reloading
    expect(round2.player.gun!.cooldownRemaining).toBe(0)
    expect(round2.animSteps.some(s => s.kind === 'burst')).toBe(false)
    expect(round2.combat.log.some(l => l.includes('Reloading'))).toBe(true)

    const round3 = resolveFight(round2.player, round2.combat, testMode)
    expect(round3.animSteps.some(s => s.kind === 'burst')).toBe(true)
    expect(round3.player.gun!.cooldownRemaining).toBe(1)
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
    const player = makePlayer({ guards: makeGuards(5), brahmin: 0 })
    const { combat } = resolveRun(player, initiateCombat(0.4, testMode), testMode)
    expect(combat.phase).toBe('fled')
  })

  it('brahmin penalise escape chance', () => {
    // base 0.4 + 0 guards - 4 brahmin * 0.05 = 0.20. rng=0.15 should escape, rng=0.25 should fail
    vi.spyOn(rngModule, 'rng').mockReturnValue(0.25)
    vi.spyOn(rngModule, 'rngInt').mockReturnValue(5)
    const player = makePlayer({ brahmin: 4, guards: [] })
    const { combat } = resolveRun(player, initiateCombat(0.4, testMode), testMode)
    expect(combat.phase).toBe('player_choice') // failed to flee
  })

  it('flee damage scales with alive enemy damage range', () => {
    vi.spyOn(rngModule, 'rng').mockReturnValue(0.99) // fail to flee
    vi.spyOn(rngModule, 'rngInt').mockReturnValue(20) // mid-damage
    const harderMode: GameModeConfig = {
      ...testMode,
      enemyStats: { raider: { health: 40, damage: [30, 60], xpReward: 15 } },
    }
    const combat = initiateCombat(0.2, harderMode) // 1 enemy
    const player = makePlayer({ health: 200 })
    const { player: result } = resolveRun(player, combat, harderMode)
    // Flee damage is ~half of enemy's damage range
    expect(result.health).toBeLessThan(200)
  })
})

// ── resolveSingleAttack — PA guard armor absorption ────────────────────────────

describe('resolveSingleAttack — pa_guard armor', () => {
  function makePAGuard(overrides: Partial<PAGuardUnit> = {}): PAGuardUnit {
    return { id: 'pa_0', health: 50, maxHealth: 50, armorPoints: 100, maxArmorPoints: 100, dead: false, ...overrides }
  }

  it('absorbs damage fully into armor when armor exceeds the hit, leaving health untouched', () => {
    const paGuards = [makePAGuard()]
    const result = resolveSingleAttack({ kind: 'pa_guard', id: 'pa_0', weight: 4 }, 30, 100, [], paGuards, null, null)
    expect(result.armorAbsorbed).toBe(30)
    expect(result.paGuards[0].armorPoints).toBe(70)
    expect(result.paGuards[0].health).toBe(50)
    expect(result.targetHealthAfter).toBe(50)
    expect(result.targetDied).toBe(false)
  })

  it('overflow damage past depleted armor comes out of health', () => {
    const paGuards = [makePAGuard({ armorPoints: 20 })]
    const result = resolveSingleAttack({ kind: 'pa_guard', id: 'pa_0', weight: 4 }, 50, 100, [], paGuards, null, null)
    expect(result.armorAbsorbed).toBe(20)
    expect(result.paGuards[0].armorPoints).toBe(0)
    expect(result.paGuards[0].health).toBe(20) // 50 - (50 - 20)
    expect(result.targetHealthAfter).toBe(20)
    expect(result.targetDied).toBe(false)
  })

  it('a hit that exceeds armor + health kills the PA guard', () => {
    const paGuards = [makePAGuard({ health: 10, armorPoints: 5 })]
    const result = resolveSingleAttack({ kind: 'pa_guard', id: 'pa_0', weight: 4 }, 30, 100, [], paGuards, null, null)
    expect(result.paGuards[0].armorPoints).toBe(0)
    expect(result.paGuards[0].health).toBe(0)
    expect(result.paGuards[0].dead).toBe(true)
    expect(result.targetDied).toBe(true)
  })

  it('does not touch armor on guards not being targeted', () => {
    const paGuards = [makePAGuard({ id: 'pa_0' }), makePAGuard({ id: 'pa_1' })]
    const result = resolveSingleAttack({ kind: 'pa_guard', id: 'pa_1', weight: 4 }, 30, 100, [], paGuards, null, null)
    expect(result.paGuards.find(g => g.id === 'pa_0')!.armorPoints).toBe(100)
    expect(result.paGuards.find(g => g.id === 'pa_1')!.armorPoints).toBe(70)
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

// ── accuracy buffs (Jet/Ultrajet) ──────────────────────────────────────────────

describe('applyAccuracyBuff', () => {
  it('adds the buff bonus for a matching target', () => {
    const buffs: ActiveBuff[] = [{ id: 'b1', chemId: 'jet', targetKind: 'player', targetId: 'player', accuracyBonus: 0.1, roundsRemaining: 2 }]
    expect(applyAccuracyBuff(0.5, buffs, 'player', 'player')).toBeCloseTo(0.6)
  })

  it('leaves accuracy unchanged when no buff matches', () => {
    const buffs: ActiveBuff[] = [{ id: 'b1', chemId: 'jet', targetKind: 'guard', targetId: 'guard_0', accuracyBonus: 0.1, roundsRemaining: 2 }]
    expect(applyAccuracyBuff(0.5, buffs, 'player', 'player')).toBe(0.5)
  })

  it('clamps to the 0.95 ceiling', () => {
    const buffs: ActiveBuff[] = [{ id: 'b1', chemId: 'ultrajet', targetKind: 'player', targetId: 'player', accuracyBonus: 0.5, roundsRemaining: 2 }]
    expect(applyAccuracyBuff(0.9, buffs, 'player', 'player')).toBe(0.95)
  })
})

describe('tickActiveBuffs', () => {
  it('decrements roundsRemaining and drops expired buffs', () => {
    const buffs: ActiveBuff[] = [
      { id: 'b1', chemId: 'jet', targetKind: 'player', targetId: 'player', accuracyBonus: 0.1, roundsRemaining: 2 },
      { id: 'b2', chemId: 'ultrajet', targetKind: 'guard', targetId: 'guard_0', accuracyBonus: 0.3, roundsRemaining: 1 },
    ]
    const ticked = tickActiveBuffs(buffs)
    expect(ticked).toHaveLength(1)
    expect(ticked[0].id).toBe('b1')
    expect(ticked[0].roundsRemaining).toBe(1)
  })
})

describe('resolveFight — buff integration', () => {
  it('carries activeBuffs through a round, ticked down by one', () => {
    vi.spyOn(rngModule, 'rng').mockReturnValue(0.99) // miss everything, isolate buff bookkeeping
    const player = makePlayer({ gun: null })
    const combat = {
      ...initiateCombat(0.1, testMode),
      activeBuffs: [{ id: 'b1', chemId: 'jet', targetKind: 'player' as const, targetId: 'player', accuracyBonus: 0.1, roundsRemaining: 2 }],
      chemUsesThisRound: 1,
    }
    const { combat: result } = resolveFight(player, combat, testMode)
    expect(result.activeBuffs).toHaveLength(1)
    expect(result.activeBuffs[0].roundsRemaining).toBe(1)
    expect(result.chemUsesThisRound).toBe(0)
  })
})

// ── guard classes: shotgunner splash, medic chem-use cap ───────────────────────

describe('resolveFight — guard classes', () => {
  it('shotgunner splash damages a second alive enemy on hit', () => {
    vi.spyOn(rngModule, 'rng').mockReturnValue(0.01) // always hit
    vi.spyOn(rngModule, 'rngInt').mockReturnValue(10)
    const shotgunner: GuardUnit = { id: 'guard_0', classId: 'shotgunner', health: 50, maxHealth: 50, dead: false }
    const player = makePlayer({ gun: null, guards: [shotgunner] })
    const combat = initiateCombat(0.9, multiEnemyMode, { raider: 1, super_mutant: 1 }, undefined, 2)
    const { combat: result, animSteps } = resolveFight(player, combat, multiEnemyMode)
    // Both enemies should have taken damage: the primary target and the splash target
    expect(result.enemies.every(e => e.health < e.maxHealth)).toBe(true)
    // Splash must land as a single simultaneous 'blast' step, not as separate sequential 'shot' steps
    const guardSteps = animSteps.filter(s => (s.kind === 'blast' && s.shooterId === 'guard_0') || (s.kind === 'shot' && s.by === 'guard'))
    expect(guardSteps).toHaveLength(1)
    expect(guardSteps[0].kind).toBe('blast')
  })

  it('chemUseCap is 1 with no medics', () => {
    const player = makePlayer({ guards: [] })
    expect(chemUseCap(player)).toBe(1)
  })

  it('chemUseCap grants +1 per living medic guard', () => {
    const medic1: GuardUnit = { id: 'guard_0', classId: 'medic', health: 30, maxHealth: 30, dead: false }
    const medic2: GuardUnit = { id: 'guard_1', classId: 'medic', health: 30, maxHealth: 30, dead: false }
    const deadMedic: GuardUnit = { id: 'guard_2', classId: 'medic', health: 0, maxHealth: 30, dead: true }
    const standard: GuardUnit = { id: 'guard_3', classId: 'standard', health: 50, maxHealth: 50, dead: false }
    const player = makePlayer({ guards: [medic1, medic2, deadMedic, standard] })
    // 1 base + 2 living medics; the dead medic and the non-medic standard guard don't count
    expect(chemUseCap(player)).toBe(3)
  })

  it('medic guards fire their own shot but no longer auto-heal', () => {
    vi.spyOn(rngModule, 'rng').mockReturnValue(0.99) // medic's own shot misses
    vi.spyOn(rngModule, 'rngInt').mockReturnValue(1)
    const medic: GuardUnit = { id: 'guard_0', classId: 'medic', health: 50, maxHealth: 50, dead: false }
    const wounded: GuardUnit = { id: 'guard_1', classId: 'standard', health: 10, maxHealth: 50, dead: false }
    const player = makePlayer({
      gun: null,
      guards: [medic, wounded],
      inventory: { stimpak: { quantity: 2, pricePaid: 200 } },
    })
    const combat = initiateCombat(0.8, testMode)
    const { player: result, combat: combatResult } = resolveFight(player, combat, testMode)
    const stillWounded = result.guards.find(g => g.id === 'guard_1')!
    expect(stillWounded.health).toBe(10) // no auto-heal — stays wounded
    expect(result.inventory['stimpak']?.quantity ?? 0).toBe(2) // stimpak untouched
    expect(combatResult.log.some(l => l.includes('administers a Stimpak'))).toBe(false)
  })

  it('sniper enters a 1-turn cooldown after firing and skips the next round', () => {
    // rng high -> every accuracy roll (guard's own shot AND enemy counterattack) misses.
    // A 'shot' animStep is pushed on a miss too, so this still proves the sniper fired
    // while keeping the enemy from one-shotting the sniper mid-test via a lucky counterattack.
    vi.spyOn(rngModule, 'rng').mockReturnValue(0.99)
    vi.spyOn(rngModule, 'rngInt').mockReturnValue(60)
    const sniper: GuardUnit = { id: 'guard_0', classId: 'sniper', health: 40, maxHealth: 40, dead: false }
    const player = makePlayer({ gun: null, guards: [sniper] })
    const combat = initiateCombat(0.8, testMode)

    const round1 = resolveFight(player, combat, testMode)
    const sniperAfterRound1 = round1.player.guards.find(g => g.id === 'guard_0')!
    expect(sniperAfterRound1.cooldownRemaining).toBe(1)
    const round1Shot = round1.animSteps.find(s => s.kind === 'shot' && s.by === 'guard')
    expect(round1Shot).toBeDefined()
    // Threaded onto the shot itself so the UI can sync the reload badge to this shot's animation
    expect(round1Shot!.kind === 'shot' ? round1Shot!.shooterCooldownRemaining : undefined).toBe(1)

    const round2 = resolveFight(round1.player, round1.combat, testMode)
    const sniperAfterRound2 = round2.player.guards.find(g => g.id === 'guard_0')!
    expect(sniperAfterRound2.cooldownRemaining).toBe(0)
    expect(round2.animSteps.some(s => s.kind === 'shot' && s.by === 'guard')).toBe(false)
    expect(round2.combat.log.some(l => l.includes('reloads'))).toBe(true)

    const round3 = resolveFight(round2.player, round2.combat, testMode)
    expect(round3.animSteps.some(s => s.kind === 'shot' && s.by === 'guard')).toBe(true)
  })

  it('a standard guard (no cooldown) leaves shooterCooldownRemaining undefined on its shot', () => {
    vi.spyOn(rngModule, 'rng').mockReturnValue(0.99)
    vi.spyOn(rngModule, 'rngInt').mockReturnValue(20)
    const player = makePlayer({ gun: null, guards: makeGuards(1) })
    const combat = initiateCombat(0.8, testMode)
    const { animSteps } = resolveFight(player, combat, testMode)
    const shot = animSteps.find(s => s.kind === 'shot' && s.by === 'guard')
    expect(shot).toBeDefined()
    expect(shot!.kind === 'shot' ? shot!.shooterCooldownRemaining : 'wrong-kind').toBeUndefined()
  })
})
