import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  initializeMarket,
  applyMarketEvents,
  tickMarketEvents,
} from '../market'
import type { MarketEvent } from '../../types/game'

const TEST_CHEMS = ['jet', 'psycho', 'stimpak']

afterEach(() => {
  vi.restoreAllMocks()
})

describe('initializeMarket', () => {
  it('returns a valid market structure', () => {
    const market = initializeMarket(1, TEST_CHEMS)
    expect(market.lastRefreshed).toBe(1)
    expect(typeof market.prices).toBe('object')
    expect(typeof market.stock).toBe('object')
  })

  it('prices are multiples of 5', () => {
    const market = initializeMarket(1, TEST_CHEMS)
    for (const price of Object.values(market.prices)) {
      expect(price % 5).toBe(0)
    }
  })

  it('stock is positive when a chem is available', () => {
    const market = initializeMarket(1, TEST_CHEMS)
    for (const [chemId, qty] of Object.entries(market.stock)) {
      expect(qty).toBeGreaterThan(0)
      expect(market.prices[chemId]).toBeGreaterThan(0)
    }
  })
})

describe('applyMarketEvents', () => {
  it('applies shortage multiplier to affected chems', () => {
    const market = initializeMarket(1, TEST_CHEMS)
    if (!market.prices['jet']) market.prices['jet'] = 80

    const event: MarketEvent = {
      id: 'test1',
      type: 'shortage',
      chemId: 'jet',
      settlementId: null,
      multiplier: 3.0,
      turnsRemaining: 2,
      message: 'test',
    }

    const original = market.prices['jet']
    const result = applyMarketEvents(market, [event], 'diamond_city')
    expect(result.prices['jet']).toBe(Math.round((original * 3.0) / 5) * 5)
  })

  it('skips events for a different settlement', () => {
    const market = initializeMarket(1, TEST_CHEMS)
    if (!market.prices['jet']) market.prices['jet'] = 80
    const original = market.prices['jet']

    const event: MarketEvent = {
      id: 'test2',
      type: 'shortage',
      chemId: 'jet',
      settlementId: 'goodneighbor', // not diamond_city
      multiplier: 3.0,
      turnsRemaining: 2,
      message: 'test',
    }

    const result = applyMarketEvents(market, [event], 'diamond_city')
    expect(result.prices['jet']).toBe(original) // unchanged
  })

  it('does not mutate the original market', () => {
    const market = initializeMarket(1, TEST_CHEMS)
    if (!market.prices['jet']) market.prices['jet'] = 80
    const original = { ...market.prices }

    const event: MarketEvent = {
      id: 'test3',
      type: 'shortage',
      chemId: 'jet',
      settlementId: null,
      multiplier: 2.0,
      turnsRemaining: 1,
      message: 'test',
    }

    applyMarketEvents(market, [event], 'diamond_city')
    expect(market.prices['jet']).toBe(original['jet'])
  })
})

describe('tickMarketEvents', () => {
  it('decrements turnsRemaining', () => {
    const events: MarketEvent[] = [
      { id: '1', type: 'shortage', chemId: 'jet', settlementId: null, multiplier: 2, turnsRemaining: 3, message: '' },
    ]
    const result = tickMarketEvents(events)
    expect(result[0].turnsRemaining).toBe(2)
  })

  it('removes events that expire', () => {
    const events: MarketEvent[] = [
      { id: '1', type: 'shortage', chemId: 'jet', settlementId: null, multiplier: 2, turnsRemaining: 1, message: '' },
      { id: '2', type: 'surplus', chemId: 'psycho', settlementId: null, multiplier: 0.5, turnsRemaining: 3, message: '' },
    ]
    const result = tickMarketEvents(events)
    expect(result.length).toBe(1)
    expect(result[0].id).toBe('2')
  })
})
