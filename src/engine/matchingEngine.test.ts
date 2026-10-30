import { describe, expect, it } from 'vitest'
import { MatchingEngine } from './matchingEngine'
import type { EngineEvent, Fill } from './types'

function fillsOf(events: readonly EngineEvent[]): Fill[] {
  return events.filter((e): e is Extract<EngineEvent, { type: 'fill' }> => e.type === 'fill').map((e) => e.fill)
}

describe('MatchingEngine — resting orders', () => {
  it('rests a limit order that has nothing to cross', () => {
    const engine = new MatchingEngine()
    const order = engine.submit({ participantId: 'a', side: 'buy', type: 'limit', price: 100, qty: 10 })

    expect(order.remainingQty).toBe(10)
    expect(fillsOf(engine.drainEvents())).toEqual([])
    expect(engine.snapshot().bids).toEqual([{ price: 100, totalQty: 10, orderCount: 1 }])
  })

  it('does not match a limit order against a price that does not cross', () => {
    const engine = new MatchingEngine()
    engine.submit({ participantId: 'maker', side: 'sell', type: 'limit', price: 105, qty: 5 })
    engine.drainEvents()

    const taker = engine.submit({ participantId: 'taker', side: 'buy', type: 'limit', price: 100, qty: 5 })

    expect(taker.remainingQty).toBe(5)
    expect(fillsOf(engine.drainEvents())).toEqual([])
    expect(engine.snapshot().bids).toEqual([{ price: 100, totalQty: 5, orderCount: 1 }])
  })
})

describe('MatchingEngine — matching and partial fills', () => {
  it('fully fills a crossing order of equal size', () => {
    const engine = new MatchingEngine()
    const maker = engine.submit({ participantId: 'maker', side: 'sell', type: 'limit', price: 100, qty: 5 })
    engine.drainEvents()

    const taker = engine.submit({ participantId: 'taker', side: 'buy', type: 'limit', price: 100, qty: 5 })
    const fills = fillsOf(engine.drainEvents())

    expect(taker.remainingQty).toBe(0)
    expect(fills).toEqual([
      {
        makerOrderId: maker.id,
        takerOrderId: taker.id,
        makerParticipantId: 'maker',
        takerParticipantId: 'taker',
        price: 100,
        qty: 5,
        makerRemainingQty: 0,
      },
    ])
    expect(engine.snapshot().asks).toEqual([])
  })

  it('partially fills a larger resting order, leaving the remainder queued', () => {
    const engine = new MatchingEngine()
    engine.submit({ participantId: 'maker', side: 'sell', type: 'limit', price: 100, qty: 10 })
    engine.drainEvents()

    const taker = engine.submit({ participantId: 'taker', side: 'buy', type: 'limit', price: 100, qty: 4 })
    const fills = fillsOf(engine.drainEvents())

    expect(taker.remainingQty).toBe(0)
    expect(fills).toHaveLength(1)
    expect(fills[0]?.qty).toBe(4)
    expect(engine.snapshot().asks).toEqual([{ price: 100, totalQty: 6, orderCount: 1 }])
  })

  it('sweeps price levels in price-then-time priority order', () => {
    const engine = new MatchingEngine()
    const makerA = engine.submit({ participantId: 'A', side: 'sell', type: 'limit', price: 100, qty: 5 })
    const makerB = engine.submit({ participantId: 'B', side: 'sell', type: 'limit', price: 100, qty: 5 })
    const makerC = engine.submit({ participantId: 'C', side: 'sell', type: 'limit', price: 101, qty: 10 })
    engine.drainEvents()

    const taker = engine.submit({ participantId: 'taker', side: 'buy', type: 'limit', price: 101, qty: 12 })
    const fills = fillsOf(engine.drainEvents())

    expect(taker.remainingQty).toBe(0)
    expect(fills.map((f) => ({ maker: f.makerOrderId, price: f.price, qty: f.qty }))).toEqual([
      { maker: makerA.id, price: 100, qty: 5 },
      { maker: makerB.id, price: 100, qty: 5 },
      { maker: makerC.id, price: 101, qty: 2 },
    ])
    expect(engine.snapshot().asks).toEqual([{ price: 101, totalQty: 8, orderCount: 1 }])
  })

  it('keeps a partially filled resting order at the front of its queue', () => {
    const engine = new MatchingEngine()
    const makerA = engine.submit({ participantId: 'A', side: 'sell', type: 'limit', price: 100, qty: 10 })
    const makerB = engine.submit({ participantId: 'B', side: 'sell', type: 'limit', price: 100, qty: 5 })
    engine.drainEvents()

    // First taker only partially consumes makerA.
    engine.submit({ participantId: 'taker1', side: 'buy', type: 'limit', price: 100, qty: 4 })
    engine.drainEvents()

    // Second taker should still hit makerA's leftover 6 before touching makerB.
    const taker2 = engine.submit({ participantId: 'taker2', side: 'buy', type: 'limit', price: 100, qty: 10 })
    const fills = fillsOf(engine.drainEvents())

    expect(taker2.remainingQty).toBe(0)
    expect(fills.map((f) => ({ maker: f.makerOrderId, qty: f.qty }))).toEqual([
      { maker: makerA.id, qty: 6 },
      { maker: makerB.id, qty: 4 },
    ])
  })

  it('does not special-case orders from the same participant (no self-trade prevention)', () => {
    const engine = new MatchingEngine()
    engine.submit({ participantId: 'same', side: 'sell', type: 'limit', price: 100, qty: 5 })
    engine.drainEvents()

    const taker = engine.submit({ participantId: 'same', side: 'buy', type: 'limit', price: 100, qty: 5 })
    const fills = fillsOf(engine.drainEvents())

    expect(taker.remainingQty).toBe(0)
    expect(fills).toHaveLength(1)
  })
})

describe('MatchingEngine — market orders', () => {
  it('fills a market order against the best resting price without a price of its own', () => {
    const engine = new MatchingEngine()
    engine.submit({ participantId: 'maker', side: 'sell', type: 'limit', price: 100, qty: 3 })
    engine.drainEvents()

    const taker = engine.submit({ participantId: 'taker', side: 'buy', type: 'market', qty: 10 })
    const fills = fillsOf(engine.drainEvents())

    expect(fills).toEqual([expect.objectContaining({ price: 100, qty: 3 })])
    expect(taker.remainingQty).toBe(7)
  })

  it('never rests a market order, even if unfilled', () => {
    const engine = new MatchingEngine()
    const taker = engine.submit({ participantId: 'taker', side: 'buy', type: 'market', qty: 10 })

    expect(taker.remainingQty).toBe(10)
    expect(engine.snapshot()).toEqual({ bids: [], asks: [] })
  })
})

describe('MatchingEngine — cancels', () => {
  it('removes a resting order so it can no longer be matched', () => {
    const engine = new MatchingEngine()
    const order = engine.submit({ participantId: 'a', side: 'buy', type: 'limit', price: 100, qty: 5 })
    engine.drainEvents()

    expect(engine.cancel(order.id)).toBe(true)
    expect(engine.snapshot().bids).toEqual([])
  })

  it('returns false when cancelling an order that is already gone', () => {
    const engine = new MatchingEngine()
    const order = engine.submit({ participantId: 'a', side: 'buy', type: 'limit', price: 100, qty: 5 })
    engine.cancel(order.id)

    expect(engine.cancel(order.id)).toBe(false)
    expect(engine.cancel(999999)).toBe(false)
  })

  it('does not disturb the queue position of other orders at that level', () => {
    const engine = new MatchingEngine()
    const a = engine.submit({ participantId: 'A', side: 'sell', type: 'limit', price: 100, qty: 5 })
    const b = engine.submit({ participantId: 'B', side: 'sell', type: 'limit', price: 100, qty: 5 })
    const c = engine.submit({ participantId: 'C', side: 'sell', type: 'limit', price: 100, qty: 5 })
    engine.drainEvents()

    engine.cancel(b.id)
    engine.drainEvents()

    const taker = engine.submit({ participantId: 'taker', side: 'buy', type: 'limit', price: 100, qty: 10 })
    const fills = fillsOf(engine.drainEvents())

    expect(taker.remainingQty).toBe(0)
    expect(fills.map((f) => f.makerOrderId)).toEqual([a.id, c.id])
  })
})

describe('MatchingEngine — validation', () => {
  it('rejects non-positive quantities', () => {
    const engine = new MatchingEngine()
    expect(() => engine.submit({ participantId: 'a', side: 'buy', type: 'limit', price: 100, qty: 0 })).toThrow()
    expect(() => engine.submit({ participantId: 'a', side: 'buy', type: 'market', qty: -1 })).toThrow()
  })

  it('rejects non-integer quantities and prices', () => {
    const engine = new MatchingEngine()
    expect(() => engine.submit({ participantId: 'a', side: 'buy', type: 'limit', price: 100, qty: 1.5 })).toThrow()
    expect(() => engine.submit({ participantId: 'a', side: 'buy', type: 'limit', price: 100.5, qty: 1 })).toThrow()
  })
})

describe('MatchingEngine — determinism', () => {
  function runScenario(engine: MatchingEngine): EngineEvent[] {
    engine.submit({ participantId: 'maker1', side: 'sell', type: 'limit', price: 101, qty: 5 })
    engine.submit({ participantId: 'maker2', side: 'sell', type: 'limit', price: 100, qty: 5 })
    const toCancel = engine.submit({ participantId: 'maker3', side: 'buy', type: 'limit', price: 98, qty: 3 })
    engine.cancel(toCancel.id)
    engine.submit({ participantId: 'taker', side: 'buy', type: 'limit', price: 101, qty: 8 })
    engine.submit({ participantId: 'taker2', side: 'buy', type: 'market', qty: 2 })
    return engine.drainEvents()
  }

  it('produces identical events for identical input sequences on fresh engines', () => {
    const eventsA = runScenario(new MatchingEngine())
    const eventsB = runScenario(new MatchingEngine())

    expect(eventsB).toEqual(eventsA)
  })
})
