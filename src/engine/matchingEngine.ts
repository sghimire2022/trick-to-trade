import { OrderBook } from './orderBook'
import type { EngineEvent, Fill, LimitOrder, Order, OrderId, Side, SubmitOrderInput } from './types'

/**
 * Matches incoming orders against a limit order book using strict
 * price-time priority: at a given price, the order that arrived first fills
 * first — "first" meaning the order in which submit() was called, since
 * this engine has no notion of time at all. No participant — including the
 * player — is special-cased; everyone goes through submit()/cancel() the
 * same way.
 *
 * Pure and time-agnostic by design: it only reacts to submit()/cancel()
 * calls, in whatever order its caller makes them. Modeling simulated time,
 * latency, and bots is entirely the Scheduler/Simulation's job — see
 * simulation.ts.
 */
export class MatchingEngine {
  private readonly book = new OrderBook()
  private readonly events: EngineEvent[] = []
  private nextOrderId = 1

  submit(input: SubmitOrderInput): Order {
    if (!Number.isInteger(input.qty) || input.qty <= 0) {
      throw new Error('Order qty must be a positive integer')
    }
    if (input.type === 'limit' && !Number.isInteger(input.price)) {
      throw new Error('Limit order price must be an integer number of ticks')
    }

    const id = this.nextOrderId++
    const order: Order =
      input.type === 'limit'
        ? {
            id,
            participantId: input.participantId,
            side: input.side,
            type: 'limit',
            price: input.price,
            qty: input.qty,
            remainingQty: input.qty,
          }
        : {
            id,
            participantId: input.participantId,
            side: input.side,
            type: 'market',
            qty: input.qty,
            remainingQty: input.qty,
          }

    this.events.push({ type: 'orderAccepted', order })
    this.match(order)

    // A limit order that isn't fully filled rests in the book. A market
    // order never rests — any unfilled remainder simply expires.
    if (order.remainingQty > 0 && order.type === 'limit') {
      this.book.addOrder(order)
    }

    this.events.push({ type: 'bookUpdate', snapshot: this.book.snapshot() })
    return order
  }

  cancel(orderId: OrderId): boolean {
    const removed = this.book.removeOrder(orderId)
    if (removed === undefined) return false
    this.events.push({ type: 'orderCancelled', orderId, participantId: removed.participantId })
    this.events.push({ type: 'bookUpdate', snapshot: this.book.snapshot() })
    return true
  }

  /** Returns the current top-of-book snapshot without waiting for an event. */
  snapshot() {
    return this.book.snapshot()
  }

  /** Quantity resting ahead of `orderId` in its own queue. Undefined if it isn't currently resting. */
  queueAheadOf(orderId: OrderId): number | undefined {
    return this.book.queueAheadOf(orderId)
  }

  /** Drains and returns every event emitted since the last call. */
  drainEvents(): EngineEvent[] {
    return this.events.splice(0, this.events.length)
  }

  private match(taker: Order): void {
    const oppositeSide: Side = taker.side === 'buy' ? 'sell' : 'buy'

    while (taker.remainingQty > 0) {
      const bestPrice = oppositeSide === 'sell' ? this.book.bestAsk() : this.book.bestBid()
      if (bestPrice === undefined) break
      if (taker.type === 'limit' && !this.pricesCross(taker.side, taker.price, bestPrice)) break

      const maker = this.book.levelOrders(oppositeSide, bestPrice)[0]
      if (maker === undefined) break // defensive: a level is removed as soon as it empties

      this.fillPair(maker, taker, bestPrice)
    }
  }

  /** True if a taker at `takerPrice` is willing to trade at `restingPrice`. */
  private pricesCross(takerSide: Side, takerPrice: number, restingPrice: number): boolean {
    return takerSide === 'buy' ? takerPrice >= restingPrice : takerPrice <= restingPrice
  }

  private fillPair(maker: LimitOrder, taker: Order, price: number): void {
    const fillQty = Math.min(taker.remainingQty, maker.remainingQty)
    maker.remainingQty -= fillQty
    taker.remainingQty -= fillQty

    const fill: Fill = {
      makerOrderId: maker.id,
      takerOrderId: taker.id,
      makerParticipantId: maker.participantId,
      takerParticipantId: taker.participantId,
      price,
      qty: fillQty,
      makerRemainingQty: maker.remainingQty,
    }
    this.events.push({ type: 'fill', fill })

    if (maker.remainingQty === 0) {
      this.book.removeOrder(maker.id)
    }
  }
}
