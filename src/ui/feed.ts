import { useCallback, useRef, useState } from 'react'
import type { SimulationLogEntry } from '../engine/simulation'

export interface FeedItem {
  readonly id: number
  readonly message: string
}

/** Turns one of the player's own log notifications into a plain-language message, or undefined to skip it. */
export function describeLogEntry(entry: SimulationLogEntry, playerId: string): string | undefined {
  // Only the player's own private notifications — the public tape and
  // book-wide entries would otherwise show up as confusing duplicates.
  if (entry.recipient !== playerId) return undefined
  const { event } = entry

  if (event.type === 'orderAccepted') {
    const sideLabel = event.order.side === 'buy' ? 'bid' : 'ask'
    const priceLabel = event.order.type === 'limit' ? ` @ ${event.order.price}` : ' (market)'
    return `Order accepted: ${sideLabel} ${event.order.qty}${priceLabel}`
  }
  if (event.type === 'fill') {
    const role = event.fill.makerParticipantId === playerId ? 'maker' : 'taker'
    return `Filled ${event.fill.qty} @ ${event.fill.price} — you were the ${role}`
  }
  if (event.type === 'orderCancelled') {
    return `Order #${event.orderId} cancelled`
  }
  return undefined
}

/** Keeps a capped, most-recent-first feed of plain-language messages for the player. */
export function useFeed(playerId: string) {
  const [feed, setFeed] = useState<FeedItem[]>([])
  const nextIdRef = useRef(0)

  const absorb = useCallback(
    (entries: readonly SimulationLogEntry[]) => {
      const messages = entries
        .map((entry) => describeLogEntry(entry, playerId))
        .filter((message): message is string => message !== undefined)
      if (messages.length === 0) return

      setFeed((prev) => {
        const next = messages.reverse().map((message) => ({ id: nextIdRef.current++, message }))
        return [...next, ...prev].slice(0, 20)
      })
    },
    [playerId],
  )

  return { feed, absorb }
}
