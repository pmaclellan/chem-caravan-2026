import { describe, it, expect } from 'vitest'
import {
  applyTurnInterest,
  checkDebtEnforcement,
  buyChems,
  sellChems,
  calculateFinalScore,
  hireGuards,
  dismissGuard,
  dismissPAGuard,
  dismissMount,
  dismissBrahmin,
  sellGun,
  sellArmor,
  repayDebt,
} from '../economy'
import type { DebtEnforcementEntry, GameModeConfig } from '../../data/modes'
import type { ArmorDefinition, GuardUnit, PAGuardUnit, PlayerState, SettlementMarket } from '../../types/game'
import type { GunDefinition } from '../../data/guns'
import { GUARD_CLASSES } from '../../data/guardClasses'

const EMPTY_MC = { guns: {}, armors: {} } as GameModeConfig

function makeGuards(n: number): GuardUnit[] {
  return Array.from({ length: n }, (_, i) => ({ id: `guard_${i}`, classId: 'standard' as const, health: 50, maxHealth: 50, dead: false }))
}

const TEST_DEBT_ENFORCEMENT: DebtEnforcementEntry[] = [
  { age: 5,  damage: 30,  message: "Thugs find you." },
  { age: 10, damage: 50,  message: "They're back." },
  { age: 12, damage: 999, message: "You're dead." },
]

function makePlayer(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    name: 'Test',
    caps: 1000,
    debt: 500,
    health: 100,
    maxHealth: 100,
    guards: [],
    paGuards: [],
    nextGuardId: 0,
    brahmin: 1,
    location: 'diamond_city',
    ageOfDebt: 0,
    inventory: {},
    gun: null,
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

function makeMarket(overrides: Partial<SettlementMarket> = {}): SettlementMarket {
  return {
    prices: { jet: 80, stimpak: 200 },
    stock: { jet: 10, stimpak: 3 },
    lastRefreshed: 1,
    depletion: {},
    ...overrides,
  }
}

describe('applyTurnInterest', () => {
  it('increases debt by the given interest rate', () => {
    const player = makePlayer({ debt: 1000, ageOfDebt: 0 })
    const result = applyTurnInterest(player, 0.065)
    expect(result.debt).toBe(1065) // ceil(1000 * 1.065) = 1065
    expect(result.ageOfDebt).toBe(1)
  })

  it('rounds up fractional caps', () => {
    const player = makePlayer({ debt: 101, ageOfDebt: 0 })
    const result = applyTurnInterest(player, 0.065)
    expect(result.debt).toBe(108) // ceil(101 * 1.065) = ceil(107.565) = 108
  })

  it('applies mode-specific rates — 5% vs 8%', () => {
    const player = makePlayer({ debt: 2000, ageOfDebt: 0 })
    expect(applyTurnInterest(player, 0.05).debt).toBe(2100)
    expect(applyTurnInterest(player, 0.08).debt).toBe(2160)
  })

  it('does nothing if debt is 0', () => {
    const player = makePlayer({ debt: 0, ageOfDebt: 3 })
    const result = applyTurnInterest(player, 0.065)
    expect(result.debt).toBe(0)
    expect(result.ageOfDebt).toBe(3) // unchanged
  })
})

describe('checkDebtEnforcement', () => {
  it('returns none when no debt', () => {
    expect(checkDebtEnforcement(makePlayer({ debt: 0 }), TEST_DEBT_ENFORCEMENT)).toEqual({ action: 'none' })
  })

  it('returns beat at age 5', () => {
    const result = checkDebtEnforcement(makePlayer({ debt: 100, ageOfDebt: 5 }), TEST_DEBT_ENFORCEMENT)
    expect(result.action).toBe('beat')
  })

  it('returns beat at age 10', () => {
    const result = checkDebtEnforcement(makePlayer({ debt: 100, ageOfDebt: 10 }), TEST_DEBT_ENFORCEMENT)
    expect(result.action).toBe('beat')
  })

  it('returns kill at age 12', () => {
    const result = checkDebtEnforcement(makePlayer({ debt: 100, ageOfDebt: 12 }), TEST_DEBT_ENFORCEMENT)
    expect(result.action).toBe('kill')
  })

  it('returns none at non-enforcement ages', () => {
    expect(checkDebtEnforcement(makePlayer({ debt: 100, ageOfDebt: 3 }), TEST_DEBT_ENFORCEMENT)).toEqual({ action: 'none' })
    expect(checkDebtEnforcement(makePlayer({ debt: 100, ageOfDebt: 7 }), TEST_DEBT_ENFORCEMENT)).toEqual({ action: 'none' })
  })

  it('uses mode-specific enforcement schedule', () => {
    const mojaveLike: DebtEnforcementEntry[] = [
      { age: 3, damage: 40, message: 'Legion hits you harder, earlier.' },
    ]
    const result = checkDebtEnforcement(makePlayer({ debt: 100, ageOfDebt: 3 }), mojaveLike)
    expect(result.action).toBe('beat')
  })
})

describe('buyChems', () => {
  it('deducts caps and adds to inventory', () => {
    const player = makePlayer({ caps: 500 })
    const market = makeMarket()
    const { player: result, error } = buyChems(player, market, 'jet', 3)
    expect(error).toBeUndefined()
    expect(result.caps).toBe(500 - 80 * 3)
    expect(result.inventory['jet'].quantity).toBe(3)
    expect(result.inventory['jet'].pricePaid).toBe(80)
  })

  it('rejects when not enough caps', () => {
    const player = makePlayer({ caps: 50 })
    const { error } = buyChems(player, makeMarket(), 'jet', 3)
    expect(error).toBeTruthy()
  })

  it('rejects when not enough stock', () => {
    const player = makePlayer({ caps: 5000 })
    const market = makeMarket({ stock: { jet: 2 } })
    const { error } = buyChems(player, market, 'jet', 5)
    expect(error).toBeTruthy()
  })

  it('rejects when exceeds inventory capacity (base 30 = 20 + 1 brahmin * 10)', () => {
    // brahmin=1 gives capacity of 30; buying 31 should fail
    const player = makePlayer({ caps: 10000, brahmin: 1 })
    const market = makeMarket({ prices: { jet: 10 }, stock: { jet: 50 } })
    const { error } = buyChems(player, market, 'jet', 31)
    expect(error).toBeTruthy()
  })

  it('averages cost basis correctly', () => {
    const player = makePlayer({ caps: 2000, inventory: { jet: { quantity: 5, pricePaid: 80 } } })
    const market = makeMarket({ prices: { jet: 100 } })
    const { player: result } = buyChems(player, market, 'jet', 5)
    // new average = (80*5 + 100*5) / 10 = 90
    expect(result.inventory['jet'].pricePaid).toBe(90)
  })
})

describe('sellChems', () => {
  it('adds caps and removes from inventory', () => {
    const player = makePlayer({ caps: 100, inventory: { jet: { quantity: 5, pricePaid: 60 } } })
    const market = makeMarket({ prices: { jet: 100 } })
    const { player: result, profit, error } = sellChems(player, market, 'jet', 3)
    expect(error).toBeUndefined()
    expect(result.caps).toBe(100 + 300)
    expect(profit).toBe(300 - 180) // 3 * (100 - 60)
    expect(result.inventory['jet'].quantity).toBe(2)
  })

  it('removes entry when selling all', () => {
    const player = makePlayer({ caps: 0, inventory: { jet: { quantity: 3, pricePaid: 80 } } })
    const { player: result } = sellChems(player, makeMarket(), 'jet', 3)
    expect(result.inventory['jet']).toBeUndefined()
  })

  it('rejects when not enough inventory', () => {
    const player = makePlayer({ inventory: { jet: { quantity: 2, pricePaid: 80 } } })
    const { error } = sellChems(player, makeMarket(), 'jet', 5)
    expect(error).toBeTruthy()
  })

  it('rejects when no market price', () => {
    const player = makePlayer({ inventory: { ultrajet: { quantity: 1, pricePaid: 300 } } })
    const market = makeMarket({ prices: { jet: 80 } }) // no ultrajet
    const { error } = sellChems(player, market, 'ultrajet', 1)
    expect(error).toBeTruthy()
  })
})

describe('calculateFinalScore', () => {
  it('returns net worth (caps - debt when no gear)', () => {
    const player = makePlayer({ caps: 1000, debt: 200 })
    expect(calculateFinalScore(player, EMPTY_MC)).toBe(800)
  })

  it('can be negative', () => {
    const player = makePlayer({ caps: 100, debt: 5000 })
    expect(calculateFinalScore(player, EMPTY_MC)).toBe(-4900)
  })
})

describe('hireGuards', () => {
  it('deducts caps and adds guards', () => {
    const player = makePlayer({ caps: 500, guards: makeGuards(1) })
    const { player: result, error } = hireGuards(player, 'standard', 2, 10)
    expect(error).toBeUndefined()
    expect(result.caps).toBe(500 - 2 * GUARD_CLASSES.standard.hireCost)
    expect(result.guards.filter(g => !g.dead).length).toBe(3)
  })

  it('rejects when not enough caps', () => {
    const { error } = hireGuards(makePlayer({ caps: 100 }), 'standard', 1, 10)
    expect(error).toBeTruthy()
  })

  it('respects the roster cap', () => {
    const player = makePlayer({ caps: 100000, guards: makeGuards(9) })
    const { player: result, error } = hireGuards(player, 'standard', 5, 10)
    expect(error).toBeUndefined()
    // Only 1 slot remained (cap 10) — only 1 should actually be hired
    expect(result.guards.filter(g => !g.dead).length).toBe(10)
    expect(result.caps).toBe(100000 - GUARD_CLASSES.standard.hireCost)
  })

  it('hires the requested class with its own cost/HP', () => {
    const player = makePlayer({ caps: 1000 })
    const { player: result, error } = hireGuards(player, 'sniper', 1, 10)
    expect(error).toBeUndefined()
    expect(result.caps).toBe(1000 - GUARD_CLASSES.sniper.hireCost)
    const hired = result.guards.find(g => !g.dead)!
    expect(hired.classId).toBe('sniper')
    expect(hired.maxHealth).toBe(GUARD_CLASSES.sniper.health)
  })
})

describe('dismissGuard', () => {
  it('removes the specified guard and leaves the rest', () => {
    const guards = makeGuards(3)
    const player = makePlayer({ guards })
    const { player: result, error } = dismissGuard(player, guards[1].id)
    expect(error).toBeUndefined()
    expect(result.guards).toHaveLength(2)
    expect(result.guards.some(g => g.id === guards[1].id)).toBe(false)
  })

  it('errors when the guard is not in the roster', () => {
    const { error } = dismissGuard(makePlayer({ guards: makeGuards(1) }), 'nonexistent')
    expect(error).toBeTruthy()
  })
})

describe('dismissPAGuard', () => {
  it('removes the specified PA guard and leaves the rest', () => {
    const paGuards: PAGuardUnit[] = [
      { id: 'pa_0', health: 150, maxHealth: 150, armorPoints: 100, maxArmorPoints: 100, dead: false },
      { id: 'pa_1', health: 150, maxHealth: 150, armorPoints: 100, maxArmorPoints: 100, dead: false },
    ]
    const player = makePlayer({ paGuards })
    const { player: result, error } = dismissPAGuard(player, 'pa_0')
    expect(error).toBeUndefined()
    expect(result.paGuards).toHaveLength(1)
    expect(result.paGuards[0].id).toBe('pa_1')
  })

  it('errors when the PA guard is not in the roster', () => {
    const { error } = dismissPAGuard(makePlayer(), 'nonexistent')
    expect(error).toBeTruthy()
  })
})

describe('dismissMount', () => {
  it('clears the mount', () => {
    const player = makePlayer({ mount: { creatureTypeId: 'yao_guai', name: 'Yao Guai', health: 60, maxHealth: 60, damage: [15, 30], accuracy: 0.7 } })
    const { player: result, error } = dismissMount(player)
    expect(error).toBeUndefined()
    expect(result.mount).toBeNull()
  })

  it('errors when there is no mount', () => {
    const { error } = dismissMount(makePlayer({ mount: null }))
    expect(error).toBeTruthy()
  })
})

describe('repayDebt', () => {
  it('reduces debt and caps', () => {
    const { player: result } = repayDebt(makePlayer({ caps: 500, debt: 300, ageOfDebt: 3 }), 300)
    expect(result.debt).toBe(0)
    expect(result.caps).toBe(200)
    expect(result.ageOfDebt).toBe(0) // resets when debt is cleared
  })

  it('only pays up to debt amount', () => {
    const { player: result } = repayDebt(makePlayer({ caps: 500, debt: 100 }), 300)
    expect(result.debt).toBe(0)
    expect(result.caps).toBe(400) // only 100 actually paid
  })
})

describe('dismissBrahmin', () => {
  it('refunds half of brahminCost per brahmin and reduces the count', () => {
    const player = makePlayer({ brahmin: 3, caps: 100 })
    const { player: result, error } = dismissBrahmin(player, 1, 300)
    expect(error).toBeUndefined()
    expect(result.brahmin).toBe(2)
    expect(result.caps).toBe(250) // 100 + floor(300/2)
  })

  it('caps the dismissed count at what the player actually owns', () => {
    const player = makePlayer({ brahmin: 1, caps: 0 })
    const { player: result } = dismissBrahmin(player, 5, 300)
    expect(result.brahmin).toBe(0)
    expect(result.caps).toBe(150) // only 1 actually dismissed
  })

  it('errors when the player has no brahmin', () => {
    const { error } = dismissBrahmin(makePlayer({ brahmin: 0 }), 1, 300)
    expect(error).toBeTruthy()
  })

  it('drops excess inventory when losing brahmin shrinks capacity below current pack weight', () => {
    // brahmin 1 -> capacity 30; dismissing it -> capacity 20; inventory has 25 items
    const player = makePlayer({
      brahmin: 1,
      caps: 0,
      inventory: { jet: { quantity: 25, pricePaid: 80 } },
    })
    const { player: result, dropped } = dismissBrahmin(player, 1, 300)
    expect(result.brahmin).toBe(0)
    expect(result.inventory['jet']?.quantity ?? 0).toBeLessThanOrEqual(20)
    expect(dropped['jet']).toBeGreaterThan(0)
  })
})

describe('sellGun', () => {
  const testGun: GunDefinition = {
    id: 'pipe_pistol', name: 'Pipe Pistol', price: 200, accuracy: 0.55, damage: 25,
    ammoPerShot: 1, ammoPrice: 3, ammoWithPurchase: 30, description: 'x',
  }

  it('refunds half price and removes the gun from ownedGuns', () => {
    const player = makePlayer({
      caps: 100,
      ownedGuns: { pipe_pistol: { id: 'pipe_pistol', name: 'Pipe Pistol', accuracy: 0.55, damage: 25, ammo: 10, ammoPerShot: 1, ammoPrice: 3 } },
    })
    const { player: result, error } = sellGun(player, testGun)
    expect(error).toBeUndefined()
    expect(result.caps).toBe(200) // 100 + floor(200/2)
    expect(result.ownedGuns['pipe_pistol']).toBeUndefined()
  })

  it('unequips the gun if it was equipped', () => {
    const gunState = { id: 'pipe_pistol', name: 'Pipe Pistol', accuracy: 0.55, damage: 25, ammo: 10, ammoPerShot: 1, ammoPrice: 3 }
    const player = makePlayer({ gun: gunState, ownedGuns: { pipe_pistol: gunState } })
    const { player: result } = sellGun(player, testGun)
    expect(result.gun).toBeNull()
  })

  it('leaves a different equipped gun untouched', () => {
    const equipped = { id: 'combat_rifle', name: 'Combat Rifle', accuracy: 0.75, damage: 65, ammo: 20, ammoPerShot: 1, ammoPrice: 8 }
    const owned = { id: 'pipe_pistol', name: 'Pipe Pistol', accuracy: 0.55, damage: 25, ammo: 10, ammoPerShot: 1, ammoPrice: 3 }
    const player = makePlayer({ gun: equipped, ownedGuns: { combat_rifle: equipped, pipe_pistol: owned } })
    const { player: result } = sellGun(player, testGun)
    expect(result.gun?.id).toBe('combat_rifle')
    expect(result.ownedGuns['pipe_pistol']).toBeUndefined()
  })

  it('errors when the gun is not owned', () => {
    const { error } = sellGun(makePlayer(), testGun)
    expect(error).toBeTruthy()
  })
})

describe('sellArmor', () => {
  const testArmor: ArmorDefinition = {
    id: 'leather_armor', name: 'Leather Armor', price: 300, armorPoints: 50, repairCostPerAP: 2, description: 'x',
  }

  it('refunds half price and clears armor', () => {
    const player = makePlayer({
      caps: 100,
      armor: { id: 'leather_armor', name: 'Leather Armor', armorPoints: 30, maxArmorPoints: 50, repairCostPerAP: 2 },
    })
    const { player: result, error } = sellArmor(player, testArmor)
    expect(error).toBeUndefined()
    expect(result.caps).toBe(250) // 100 + floor(300/2)
    expect(result.armor).toBeNull()
  })

  it('refunds the same amount regardless of current damage', () => {
    const damaged = makePlayer({ caps: 0, armor: { id: 'leather_armor', name: 'Leather Armor', armorPoints: 1, maxArmorPoints: 50, repairCostPerAP: 2 } })
    const { player: result } = sellArmor(damaged, testArmor)
    expect(result.caps).toBe(150)
  })

  it('errors when no armor is equipped', () => {
    const { error } = sellArmor(makePlayer({ armor: null }), testArmor)
    expect(error).toBeTruthy()
  })

  it('errors when a different armor is equipped', () => {
    const player = makePlayer({ armor: { id: 'combat_armor', name: 'Combat Armor', armorPoints: 80, maxArmorPoints: 80, repairCostPerAP: 3 } })
    const { error } = sellArmor(player, testArmor)
    expect(error).toBeTruthy()
  })
})
