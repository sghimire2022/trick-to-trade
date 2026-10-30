import type { BookLevel, BookSnapshot, LimitOrder, OrderId, Price, Side } from './types'

interface OrderLocation {
  readonly side: Side
  readonly price: Price
}

/**
 * Limit order book with price-time priority.
 *
 * Each side is a map from price to a FIFO queue of resting orders at that
 * price — earliest order first, which is what gives time priority within a
 * level. A sorted array of active prices is kept per side (best price at
 * index 0) so the best bid/ask is a lookup, not a scan.
 */
export class OrderBook {
  private readonly bidLevels = new Map<Price, LimitOrder[]>()
  private readonly askLevels = new Map<Price, LimitOrder[]>()
  // Bids sorted descending (highest first); asks sorted ascending (lowest first).
  private readonly bidPrices: Price[] = []
  private readonly askPrices: Price[] = []
  private readonly orderLocations = new Map<OrderId, OrderLocation>()

  bestBid(): Price | undefined {
    return this.bidPrices[0]
  }

  bestAsk(): Price | undefined {
    return this.askPrices[0]
  }

  /** Resting orders at a price, earliest first. Empty if the level doesn't exist. */
  levelOrders(side: Side, price: Price): readonly LimitOrder[] {
    const levels = side === 'buy' ? this.bidLevels : this.askLevels
    return levels.get(price) ?? []
  }

  /** Adds a resting limit order to the book, at the back of its price level's queue. */
  addOrder(order: LimitOrder): void {
    const levels = order.side === 'buy' ? this.bidLevels : this.askLevels
    const prices = order.side === 'buy' ? this.bidPrices : this.askPrices

    let queue = levels.get(order.price)
    if (queue === undefined) {
      queue = []
      levels.set(order.price, queue)
      this.insertPriceLevel(prices, order.price, order.side)
    }
    queue.push(order)
    this.orderLocations.set(order.id, { side: order.side, price: order.price })
  }

  /** Removes an order (cancel, or fully filled). Returns it, or undefined if not found. */
  removeOrder(orderId: OrderId): LimitOrder | undefined {
    const location = this.orderLocations.get(orderId)
    if (location === undefined) return undefined

    const levels = location.side === 'buy' ? this.bidLevels : this.askLevels
    const prices = location.side === 'buy' ? this.bidPrices : this.askPrices
    const queue = levels.get(location.price)
    if (queue === undefined) return undefined

    const index = queue.findIndex((order) => order.id === orderId)
    if (index === -1) return undefined
    const [removed] = queue.splice(index, 1)

    if (queue.length === 0) {
      levels.delete(location.price)
      this.removePriceLevel(prices, location.price)
    }
    this.orderLocations.delete(orderId)
    return removed
  }

  /**
   * Total remaining quantity resting ahead of `orderId` in its own price
   * level's queue — zero if it's already at the front. Undefined if the
   * order isn't currently resting (never placed, cancelled, or filled).
   */
  queueAheadOf(orderId: OrderId): number | undefined {
    const location = this.orderLocations.get(orderId)
    if (location === undefined) return undefined

    let qtyAhead = 0
    for (const order of this.levelOrders(location.side, location.price)) {
      if (order.id === orderId) break
      qtyAhead += order.remainingQty
    }
    return qtyAhead
  }

  /** A read-only view of the top `depth` levels on each side, for UI/bots. */
  snapshot(depth = 10): BookSnapshot {
    const toLevels = (prices: readonly Price[], levels: ReadonlyMap<Price, LimitOrder[]>): BookLevel[] =>
      prices.slice(0, depth).map((price) => {
        const orders = levels.get(price) ?? []
        return {
          price,
          totalQty: orders.reduce((sum, order) => sum + order.remainingQty, 0),
          orderCount: orders.length,
        }
      })
    return {
      bids: toLevels(this.bidPrices, this.bidLevels),
      asks: toLevels(this.askPrices, this.askLevels),
    }
  }

  /** Binary-search insert so a new price level lands in sorted order. */
  private insertPriceLevel(prices: Price[], price: Price, side: Side): void {
    let lo = 0
    let hi = prices.length
    while (lo < hi) {
      const mid = (lo + hi) >>> 1
      const midPrice = prices[mid] as Price
      const shouldGoBefore = side === 'buy' ? price > midPrice : price < midPrice
      if (shouldGoBefore) hi = mid
      else lo = mid + 1
    }
    prices.splice(lo, 0, price)
  }

  private removePriceLevel(prices: Price[], price: Price): void {
    const index = prices.indexOf(price)
    if (index !== -1) prices.splice(index, 1)
  }
}
