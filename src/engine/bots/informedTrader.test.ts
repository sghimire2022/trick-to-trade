import { describe, expect, it } from 'vitest'
import type { BookSnapshot } from '../types'
import { InformedTrader, type InformedTraderConfig } from './informedTrader'
import type { BotContext } from './types'

function context(snapshot: BookSnapshot): BotContext {
  return { time: 0, snapshot, recentFills: [], ownOpenOrderIds: [] }
}

const config: InformedTraderConfig = { participantId: 'informed', qty: 3, minEdge: 2 }

describe('InformedTrader', () => {
  it('does nothing on an empty book', () => {
    const trader = new InformedTrader(config, 100)
    expect(trader.decide(context({ bids: [], asks: [] }))).toEqual([])
  })

  it('does nothing when the market is within the edge threshold of fair value', () => {
    const trader = new InformedTrader(config, 100)
    const book: BookSnapshot = {
      bids: [{ price: 99, totalQty: 1, orderCount: 1 }],
      asks: [{ price: 101, totalQty: 1, orderCount: 1 }],
    }
    expect(trader.decide(context(book))).toEqual([])
  })

  it('buys when the best ask is a bargain relative to fair value', () => {
    const trader = new InformedTrader(config, 100)
    const book: BookSnapshot = {
      bids: [],
      asks: [{ price: 97, totalQty: 5, orderCount: 1 }],
    }
    expect(trader.decide(context(book))).toEqual([
      { kind: 'submit', order: { participantId: 'informed', side: 'buy', type: 'market', qty: 3 } },
    ])
  })

  it('sells when the best bid is overpriced relative to fair value', () => {
    const trader = new InformedTrader(config, 100)
    const book: BookSnapshot = {
      bids: [{ price: 103, totalQty: 5, orderCount: 1 }],
      asks: [],
    }
    expect(trader.decide(context(book))).toEqual([
      { kind: 'submit', order: { participantId: 'informed', side: 'sell', type: 'market', qty: 3 } },
    ])
  })

  it('reacts to an updated fair value', () => {
    const trader = new InformedTrader(config, 100)
    const book: BookSnapshot = {
      bids: [],
      asks: [{ price: 97, totalQty: 5, orderCount: 1 }],
    }
    expect(trader.decide(context(book))).toHaveLength(1)

    trader.setFairValue(95)
    expect(trader.decide(context(book))).toEqual([])
  })
})
