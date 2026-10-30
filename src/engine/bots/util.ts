import type { BookSnapshot, Price } from '../types'

/** The midpoint between best bid and best ask, rounded down to a tick. Undefined if either side is empty. */
export function midPrice(snapshot: BookSnapshot): Price | undefined {
  const bestBid = snapshot.bids[0]?.price
  const bestAsk = snapshot.asks[0]?.price
  if (bestBid === undefined || bestAsk === undefined) return undefined
  return Math.floor((bestBid + bestAsk) / 2)
}
