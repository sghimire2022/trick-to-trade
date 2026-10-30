import { describe, expect, it } from 'vitest'
import type { SimulationLogEntry } from '../engine/simulation'
import type { LimitOrder, Side } from '../engine/types'
import { INITIAL_PNL_STATE, PnlTracker } from './pnlTracker'

const PLAYER = 'player'

function orderAcceptedEntry(orderId: number, side: Side, qty: number, price: number): SimulationLogEntry {
  const order: LimitOrder = { id: orderId, participantId: PLAYER, side, type: 'limit', qty, remainingQty: qty, price }
  return { time: 0, recipient: PLAYER, event: { type: 'orderAccepted', order } }
}

function fillEntry(opts: { makerOrderId: number; takerOrderId: number; qty: number; price: number }): SimulationLogEntry {
  return {
    time: 0,
    recipient: PLAYER,
    event: {
      type: 'fill',
      fill: {
        makerOrderId: opts.makerOrderId,
        takerOrderId: opts.takerOrderId,
        makerParticipantId: PLAYER,
        takerParticipantId: 'bot',
        price: opts.price,
        qty: opts.qty,
        makerRemainingQty: 0,
      },
    },
  }
}

describe('PnlTracker', () => {
  it('starts flat', () => {
    const tracker = new PnlTracker(PLAYER)
    expect(tracker.state).toEqual(INITIAL_PNL_STATE)
  })

  it('increases inventory and decreases cash when the player buys', () => {
    const tracker = new PnlTracker(PLAYER)
    tracker.absorb([orderAcceptedEntry(1, 'buy', 5, 100)])
    tracker.absorb([fillEntry({ makerOrderId: 1, takerOrderId: 99, qty: 5, price: 100 })])

    expect(tracker.state).toEqual({ cash: -500, inventory: 5 })
  })

  it('decreases inventory and increases cash when the player sells', () => {
    const tracker = new PnlTracker(PLAYER)
    tracker.absorb([orderAcceptedEntry(1, 'sell', 5, 100)])
    tracker.absorb([fillEntry({ makerOrderId: 1, takerOrderId: 99, qty: 5, price: 100 })])

    expect(tracker.state).toEqual({ cash: 500, inventory: -5 })
  })

  it('accumulates across multiple fills on different orders', () => {
    const tracker = new PnlTracker(PLAYER)
    tracker.absorb([orderAcceptedEntry(1, 'buy', 5, 100), orderAcceptedEntry(2, 'sell', 3, 102)])
    tracker.absorb([
      fillEntry({ makerOrderId: 1, takerOrderId: 99, qty: 5, price: 100 }),
      fillEntry({ makerOrderId: 2, takerOrderId: 98, qty: 3, price: 102 }),
    ])

    // Bought 5 @ 100 (-500), sold 3 @ 102 (+306): net inventory 2, net cash -194.
    expect(tracker.state).toEqual({ cash: -194, inventory: 2 })
  })

  it('ignores entries addressed to someone else', () => {
    const tracker = new PnlTracker(PLAYER)
    tracker.absorb([{ time: 0, recipient: 'bot', event: orderAcceptedEntry(1, 'buy', 5, 100).event }])
    tracker.absorb([{ time: 0, recipient: 'bot', event: fillEntry({ makerOrderId: 1, takerOrderId: 2, qty: 5, price: 100 }).event }])

    expect(tracker.state).toEqual(INITIAL_PNL_STATE)
  })

  it('ignores a fill for an order it never saw orderAccepted for', () => {
    const tracker = new PnlTracker(PLAYER)
    tracker.absorb([fillEntry({ makerOrderId: 1, takerOrderId: 99, qty: 5, price: 100 })])

    expect(tracker.state).toEqual(INITIAL_PNL_STATE)
  })

  it('marks inventory to market at a given price', () => {
    const tracker = new PnlTracker(PLAYER)
    tracker.absorb([orderAcceptedEntry(1, 'buy', 5, 100)])
    tracker.absorb([fillEntry({ makerOrderId: 1, takerOrderId: 99, qty: 5, price: 100 })])

    // Bought 5 @ 100 (cash -500); marking 5 shares at 110 gives paper value 550.
    expect(tracker.markToMarket(110)).toBe(50)
  })
})
