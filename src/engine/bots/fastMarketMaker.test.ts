import { describe, expect, it } from 'vitest'
import type { BookSnapshot } from '../types'
import { FastMarketMaker, type FastMarketMakerConfig } from './fastMarketMaker'
import type { BotContext } from './types'

const emptyBook: BookSnapshot = { bids: [], asks: [] }

function context(overrides: Partial<BotContext> = {}): BotContext {
  return { time: 0, snapshot: emptyBook, recentFills: [], ownOpenOrderIds: [], ...overrides }
}

const config: FastMarketMakerConfig = {
  participantId: 'fastmm',
  halfSpread: 2,
  qty: 4,
  requoteThreshold: 3,
  fallbackPrice: 100,
}

describe('FastMarketMaker', () => {
  it('quotes both sides around the fallback price when the book is empty and it has no open orders', () => {
    const mm = new FastMarketMaker(config)
    const actions = mm.decide(context())

    expect(actions).toEqual([
      { kind: 'submit', order: { participantId: 'fastmm', side: 'buy', type: 'limit', price: 98, qty: 4 } },
      { kind: 'submit', order: { participantId: 'fastmm', side: 'sell', type: 'limit', price: 102, qty: 4 } },
    ])
  })

  it('quotes around the book mid price once one exists', () => {
    const mm = new FastMarketMaker(config)
    const book: BookSnapshot = {
      bids: [{ price: 198, totalQty: 1, orderCount: 1 }],
      asks: [{ price: 202, totalQty: 1, orderCount: 1 }],
    }

    const actions = mm.decide(context({ snapshot: book }))

    expect(actions).toEqual([
      { kind: 'submit', order: { participantId: 'fastmm', side: 'buy', type: 'limit', price: 198, qty: 4 } },
      { kind: 'submit', order: { participantId: 'fastmm', side: 'sell', type: 'limit', price: 202, qty: 4 } },
    ])
  })

  it('does not re-quote while it already has open orders and the price has not moved enough', () => {
    const mm = new FastMarketMaker(config)
    mm.decide(context()) // places initial quotes at 100

    const actions = mm.decide(context({ ownOpenOrderIds: [1, 2] }))
    expect(actions).toEqual([])
  })

  it('cancels and re-quotes once the reference price drifts past the threshold', () => {
    const mm = new FastMarketMaker(config)
    mm.decide(context()) // quotes placed around 100

    const movedBook: BookSnapshot = {
      bids: [{ price: 103, totalQty: 1, orderCount: 1 }],
      asks: [{ price: 105, totalQty: 1, orderCount: 1 }],
    }
    const actions = mm.decide(context({ snapshot: movedBook, ownOpenOrderIds: [1, 2] }))

    expect(actions).toEqual([
      { kind: 'cancel', orderId: 1 },
      { kind: 'cancel', orderId: 2 },
      { kind: 'submit', order: { participantId: 'fastmm', side: 'buy', type: 'limit', price: 102, qty: 4 } },
      { kind: 'submit', order: { participantId: 'fastmm', side: 'sell', type: 'limit', price: 106, qty: 4 } },
    ])
  })
})
