import { describe, it, expect } from 'vitest'
import {
  getAdjacentRoads,
  getRoadDestination,
  calculateCapacity,
  totalInventoryItems,
  dropExcessInventory,
  loseBrahmin,
} from '../travel'
import { GAME_MODES } from '../../data/modes'
import type { PlayerState } from '../../types/game'

const cwMode = GAME_MODES['commonwealth']

function makePlayer(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    name: 'Test',
    caps: 1000,
    debt: 0,
    health: 100,
    maxHealth: 100,
    guards: 0,
    powerArmorGuards: 0,
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

describe('getAdjacentRoads', () => {
  it('returns roads from diamond_city', () => {
    const roads = getAdjacentRoads(cwMode, 'diamond_city')
    const dests = roads.map(r => getRoadDestination(r, 'diamond_city'))
    expect(dests).toContain('goodneighbor')
    expect(dests).toContain('bunker_hill')
    expect(dests).toContain('jamaica_plain')
    expect(dests).toContain('park_street_station')
  })

  it('returns roads from graygarden (a spoke node)', () => {
    const roads = getAdjacentRoads(cwMode, 'graygarden')
    expect(roads.length).toBe(2) // bunker_hill and sanctuary_hills
  })

  it('every settlement has at least one road', () => {
    const settlements = [
      'diamond_city', 'goodneighbor', 'bunker_hill', 'the_castle',
      'vault_81', 'sanctuary_hills', 'graygarden', 'jamaica_plain', 'park_street_station',
    ]
    for (const s of settlements) {
      expect(getAdjacentRoads(cwMode, s).length).toBeGreaterThan(0)
    }
  })

  it('mojave mode has its own separate roads', () => {
    const mojMode = GAME_MODES['mojave_wasteland']
    const roads = getAdjacentRoads(mojMode, 'the_strip')
    const dests = roads.map(r => getRoadDestination(r, 'the_strip'))
    expect(dests).toContain('freeside')
    expect(dests).toContain('camp_mccarran')
  })
})

describe('calculateCapacity', () => {
  it('returns 20 with 0 brahmin', () => {
    expect(calculateCapacity(0)).toBe(20)
  })

  it('returns 30 with 1 brahmin', () => {
    expect(calculateCapacity(1)).toBe(30)
  })

  it('returns 50 with 3 brahmin', () => {
    expect(calculateCapacity(3)).toBe(50)
  })
})

describe('totalInventoryItems', () => {
  it('counts all items', () => {
    const inv = { jet: { quantity: 5, pricePaid: 80 }, psycho: { quantity: 3, pricePaid: 120 } }
    expect(totalInventoryItems(inv)).toBe(8)
  })

  it('returns 0 for empty inventory', () => {
    expect(totalInventoryItems({})).toBe(0)
  })
})

describe('dropExcessInventory', () => {
  it('does nothing when within capacity', () => {
    const player = makePlayer({
      brahmin: 1,
      inventory: { jet: { quantity: 5, pricePaid: 80 } },
    })
    expect(dropExcessInventory(player).inventory).toEqual(player.inventory)
  })

  it('drops cheapest items when over capacity', () => {
    // brahmin=0 → capacity 20; inventory has 25 items
    const player = makePlayer({
      brahmin: 0,
      inventory: {
        jet: { quantity: 15, pricePaid: 80 },     // expensive
        radx: { quantity: 10, pricePaid: 60 },    // cheap — should be dropped first
      },
    })
    const result = dropExcessInventory(player)
    const remaining = totalInventoryItems(result.inventory)
    expect(remaining).toBeLessThanOrEqual(20)
    // radx should be partially or fully gone before jet
    const jetRemaining = result.inventory['jet']?.quantity ?? 0
    expect(jetRemaining).toBe(15) // jet is more expensive, stays
  })

  it('removes entry when quantity reaches 0', () => {
    const player = makePlayer({
      brahmin: 0,
      inventory: {
        jet: { quantity: 20, pricePaid: 80 },
        radx: { quantity: 5, pricePaid: 60 },
      },
    })
    const result = dropExcessInventory(player)
    expect(result.inventory['radx']).toBeUndefined()
  })
})

describe('loseBrahmin', () => {
  it('decrements brahmin', () => {
    const player = makePlayer({ brahmin: 2 })
    expect(loseBrahmin(player).player.brahmin).toBe(1)
  })

  it('does not go below 0', () => {
    const player = makePlayer({ brahmin: 0 })
    expect(loseBrahmin(player).player.brahmin).toBe(0)
  })

  it('trims inventory when capacity drops', () => {
    // brahmin goes from 1 (cap 30) to 0 (cap 20); player has 25 items
    const player = makePlayer({
      brahmin: 1,
      inventory: { jet: { quantity: 25, pricePaid: 80 } },
    })
    const { player: result, dropped } = loseBrahmin(player)
    expect(result.brahmin).toBe(0)
    expect(totalInventoryItems(result.inventory)).toBeLessThanOrEqual(20)
    expect(Object.values(dropped).reduce((s, n) => s + n, 0)).toBe(5)
  })
})
