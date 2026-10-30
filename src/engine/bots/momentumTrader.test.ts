import { describe, expect, it } from 'vitest'
import type { BookSnapshot, Fill } from '../types'
import { MomentumTrader, type MomentumTraderConfig } from './momentumTrader'
import type { BotContext } from './types'

const emptyBook: BookSnapshot = { bids: [], asks: [] }

function makeFill(price: number): Fill {
  return {
    makerOrderId: 1,
    takerOrderId: 2,
    makerParticipantId: 'm',
    takerParticipantId: 't',
    price,
    qty: 1,
    makerRemainingQty: 0,
  }
}

function context(fillPrices: number[] = []): BotContext {
  return { time: 0, snapshot: emptyBook, recentFills: fillPrices.map(makeFill), ownOpenOrderIds: [] }
}

const config: MomentumTraderConfig = { participantId: 'momentum', windowSize: 3, threshold: 5, qty: 2 }

describe('MomentumTrader', () => {
  it('does nothing with no trade history', () => {
    const trader = new MomentumTrader(config)
    expect(trader.decide(context())).toEqual([])
  })

  it('does nothing with a single data point', () => {
    const trader = new MomentumTrader(config)
    expect(trader.decide(context([100]))).toEqual([])
  })

  it('does nothing when the move is within the threshold', () => {
    const trader = new MomentumTrader(config)
    trader.decide(context([100]))
    expect(trader.decide(context([103]))).toEqual([])
  })

  it('buys with a market order once the price has climbed past the threshold', () => {
    const trader = new MomentumTrader(config)
    trader.decide(context([100]))
    const actions = trader.decide(context([106]))

    expect(actions).toEqual([
      { kind: 'submit', order: { participantId: 'momentum', side: 'buy', type: 'market', qty: 2 } },
    ])
  })

  it('sells with a market order once the price has dropped past the threshold', () => {
    const trader = new MomentumTrader(config)
    trader.decide(context([100]))
    const actions = trader.decide(context([94]))

    expect(actions).toEqual([
      { kind: 'submit', order: { participantId: 'momentum', side: 'sell', type: 'market', qty: 2 } },
    ])
  })

  it('forgets prices once they age out of the window', () => {
    const trader = new MomentumTrader({ ...config, windowSize: 2 })
    trader.decide(context([100])) // window: [100]
    trader.decide(context([106])) // window: [100, 106] -> move 6, triggers buy
    // Next fill pushes 100 out of the window: [106, 106] -> move 0, no action.
    expect(trader.decide(context([106]))).toEqual([])
  })
})
