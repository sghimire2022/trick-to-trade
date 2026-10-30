import { describe, expect, it } from 'vitest'
import { Rng } from '../rng'
import type { BookSnapshot } from '../types'
import { NoiseTrader, type NoiseTraderConfig } from './noiseTrader'
import type { BotContext } from './types'

const emptyBook: BookSnapshot = { bids: [], asks: [] }

function context(snapshot: BookSnapshot = emptyBook): BotContext {
  return { time: 0, snapshot, recentFills: [], ownOpenOrderIds: [] }
}

const baseConfig: NoiseTraderConfig = {
  participantId: 'noise',
  actionProbability: 1,
  minQty: 1,
  maxQty: 5,
  maxOffset: 3,
  fallbackPrice: 100,
}

describe('NoiseTrader', () => {
  it('never acts when actionProbability is 0', () => {
    const trader = new NoiseTrader({ ...baseConfig, actionProbability: 0 }, new Rng(1))
    for (let i = 0; i < 20; i++) {
      expect(trader.decide(context())).toEqual([])
    }
  })

  it('always acts when actionProbability is 1, submitting a limit order within bounds', () => {
    const trader = new NoiseTrader(baseConfig, new Rng(1))

    for (let i = 0; i < 50; i++) {
      const actions = trader.decide(context())
      expect(actions).toHaveLength(1)
      const action = actions[0]
      if (action === undefined || action.kind !== 'submit' || action.order.type !== 'limit') {
        throw new Error('expected a limit order submission')
      }
      expect(['buy', 'sell']).toContain(action.order.side)
      expect(action.order.qty).toBeGreaterThanOrEqual(baseConfig.minQty)
      expect(action.order.qty).toBeLessThanOrEqual(baseConfig.maxQty)
      const offset = Math.abs(action.order.price - baseConfig.fallbackPrice)
      expect(offset).toBeGreaterThanOrEqual(1)
      expect(offset).toBeLessThanOrEqual(baseConfig.maxOffset)
    }
  })

  it('quotes around the book mid price once one exists', () => {
    const trader = new NoiseTrader(baseConfig, new Rng(1))
    const book: BookSnapshot = {
      bids: [{ price: 198, totalQty: 1, orderCount: 1 }],
      asks: [{ price: 202, totalQty: 1, orderCount: 1 }],
    }

    const actions = trader.decide(context(book))
    const action = actions[0]
    if (action === undefined || action.kind !== 'submit' || action.order.type !== 'limit') {
      throw new Error('expected a limit order submission')
    }
    const offset = Math.abs(action.order.price - 200)
    expect(offset).toBeGreaterThanOrEqual(1)
    expect(offset).toBeLessThanOrEqual(baseConfig.maxOffset)
  })

  it('produces the same decisions for the same seed', () => {
    const traderA = new NoiseTrader(baseConfig, new Rng(42))
    const traderB = new NoiseTrader(baseConfig, new Rng(42))

    for (let i = 0; i < 20; i++) {
      expect(traderB.decide(context())).toEqual(traderA.decide(context()))
    }
  })
})
