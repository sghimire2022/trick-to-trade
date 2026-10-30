import { describe, expect, it } from 'vitest'
import { OrderBook } from './orderBook'
import type { LimitOrder } from './types'

let nextId = 1
function makeOrder(overrides: Partial<LimitOrder> & Pick<LimitOrder, 'side' | 'price'>): LimitOrder {
  return {
    id: nextId++,
    participantId: 'p',
    type: 'limit',
    qty: 1,
    remainingQty: 1,
    ...overrides,
  }
}

describe('OrderBook', () => {
  it('reports no best bid/ask on an empty book', () => {
    const book = new OrderBook()
    expect(book.bestBid()).toBeUndefined()
    expect(book.bestAsk()).toBeUndefined()
  })

  it('tracks the best bid (highest price) and best ask (lowest price)', () => {
    const book = new OrderBook()
    book.addOrder(makeOrder({ side: 'buy', price: 100 }))
    book.addOrder(makeOrder({ side: 'buy', price: 102 }))
    book.addOrder(makeOrder({ side: 'buy', price: 101 }))
    book.addOrder(makeOrder({ side: 'sell', price: 105 }))
    book.addOrder(makeOrder({ side: 'sell', price: 103 }))
    book.addOrder(makeOrder({ side: 'sell', price: 104 }))

    expect(book.bestBid()).toBe(102)
    expect(book.bestAsk()).toBe(103)
  })

  it('keeps orders at the same price level in the order they were added (FIFO)', () => {
    const book = new OrderBook()
    const first = makeOrder({ side: 'buy', price: 100 })
    const second = makeOrder({ side: 'buy', price: 100 })
    book.addOrder(first)
    book.addOrder(second)

    const queue = book.levelOrders('buy', 100)
    expect(queue.map((order) => order.id)).toEqual([first.id, second.id])
  })

  it('removes an order and reports it back', () => {
    const book = new OrderBook()
    const order = makeOrder({ side: 'buy', price: 100 })
    book.addOrder(order)

    expect(book.removeOrder(order.id)).toBe(order)
    expect(book.levelOrders('buy', 100)).toEqual([])
  })

  it('clears a price level once its last order is removed', () => {
    const book = new OrderBook()
    const order = makeOrder({ side: 'buy', price: 100 })
    book.addOrder(order)
    book.removeOrder(order.id)

    expect(book.bestBid()).toBeUndefined()
  })

  it('removing an order does not disturb the queue position of others at that level', () => {
    const book = new OrderBook()
    const first = makeOrder({ side: 'buy', price: 100 })
    const second = makeOrder({ side: 'buy', price: 100 })
    const third = makeOrder({ side: 'buy', price: 100 })
    book.addOrder(first)
    book.addOrder(second)
    book.addOrder(third)

    book.removeOrder(second.id)

    expect(book.levelOrders('buy', 100).map((o) => o.id)).toEqual([first.id, third.id])
  })

  it('returns undefined when removing an order that is not in the book', () => {
    const book = new OrderBook()
    expect(book.removeOrder(999)).toBeUndefined()
  })

  it('reports how much quantity rests ahead of an order in its queue', () => {
    const book = new OrderBook()
    const first = makeOrder({ side: 'sell', price: 100, qty: 10, remainingQty: 10 })
    const second = makeOrder({ side: 'sell', price: 100, qty: 5, remainingQty: 5 })
    const third = makeOrder({ side: 'sell', price: 100, qty: 3, remainingQty: 3 })
    book.addOrder(first)
    book.addOrder(second)
    book.addOrder(third)

    expect(book.queueAheadOf(first.id)).toBe(0)
    expect(book.queueAheadOf(second.id)).toBe(10)
    expect(book.queueAheadOf(third.id)).toBe(15)
  })

  it('reflects partial fills in queue position', () => {
    const book = new OrderBook()
    const first = makeOrder({ side: 'sell', price: 100, qty: 10, remainingQty: 10 })
    const second = makeOrder({ side: 'sell', price: 100, qty: 5, remainingQty: 5 })
    book.addOrder(first)
    book.addOrder(second)

    first.remainingQty = 4 // partially filled, still resting
    expect(book.queueAheadOf(second.id)).toBe(4)
  })

  it('returns undefined for an order that is not currently resting', () => {
    const book = new OrderBook()
    expect(book.queueAheadOf(999)).toBeUndefined()
  })

  it('snapshot aggregates quantity and order count per level, best price first', () => {
    const book = new OrderBook()
    book.addOrder(makeOrder({ side: 'buy', price: 100, qty: 5, remainingQty: 5 }))
    book.addOrder(makeOrder({ side: 'buy', price: 100, qty: 3, remainingQty: 3 }))
    book.addOrder(makeOrder({ side: 'buy', price: 99, qty: 2, remainingQty: 2 }))
    book.addOrder(makeOrder({ side: 'sell', price: 101, qty: 4, remainingQty: 4 }))

    const snapshot = book.snapshot()
    expect(snapshot.bids).toEqual([
      { price: 100, totalQty: 8, orderCount: 2 },
      { price: 99, totalQty: 2, orderCount: 1 },
    ])
    expect(snapshot.asks).toEqual([{ price: 101, totalQty: 4, orderCount: 1 }])
  })

  it('limits snapshot depth', () => {
    const book = new OrderBook()
    for (let price = 90; price < 100; price++) {
      book.addOrder(makeOrder({ side: 'buy', price }))
    }
    expect(book.snapshot(3).bids).toHaveLength(3)
  })
})
