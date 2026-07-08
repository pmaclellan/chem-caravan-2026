import { describe, it, expect } from 'vitest'
import {
  applyTurnInterest,
  checkDebtEnforcement,
  buyChems,
  sellChems,
  calculateFinalScore,
  hireGuards,
  repayDebt,
} from '../economy'
import type { DebtEnforcementEntry, GameModeConfig } from '../../data/modes'
import type { GuardUnit, PlayerState, SettlementMarket } from '../../types/game'
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
    const { player: result, error } = hireGuards(player, 2, 10)
    expect(error).toBeUndefined()
    expect(result.caps).toBe(500 - 2 * GUARD_CLASSES.standard.hireCost)
    expect(result.guards.filter(g => !g.dead).length).toBe(3)
  })

  it('rejects when not enough caps', () => {
    const { error } = hireGuards(makePlayer({ caps: 100 }), 1, 10)
    expect(error).toBeTruthy()
  })

  it('respects the roster cap', () => {
    const player = makePlayer({ caps: 100000, guards: makeGuards(9) })
    const { player: result, error } = hireGuards(player, 5, 10)
    expect(error).toBeUndefined()
    // Only 1 slot remained (cap 10) — only 1 should actually be hired
    expect(result.guards.filter(g => !g.dead).length).toBe(10)
    expect(result.caps).toBe(100000 - GUARD_CLASSES.standard.hireCost)
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
