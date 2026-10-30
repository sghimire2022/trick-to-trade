import type { SimulationLogEntry } from '../engine/simulation'
import type { Fill, OrderId, Price, Side } from '../engine/types'

export interface PnlState {
  readonly cash: number
  readonly inventory: number
}

export const INITIAL_PNL_STATE: PnlState = { cash: 0, inventory: 0 }

/**
 * Tracks a market maker's running cash and inventory from their own fill
 * notifications. A Fill only carries order ids, not which side each one
 * was — so this also watches `orderAccepted` notifications to learn each of
 * the player's own order's side before it can ever be filled.
 *
 * Known limitation: if the player's own bid and ask cross each other (a
 * self-trade), the fill is double-counted, since Simulation notifies both
 * the maker and taker side to the same recipient. Not an issue while the
 * player only ever trades against bots.
 */
export class PnlTracker {
  private readonly playerParticipantId: string
  private readonly sideByOrderId = new Map<OrderId, Side>()
  private cash = 0
  private inventory = 0

  constructor(playerParticipantId: string) {
    this.playerParticipantId = playerParticipantId
  }

  get state(): PnlState {
    return { cash: this.cash, inventory: this.inventory }
  }

  /** Feed every new batch of Simulation log entries through this, in order. */
  absorb(entries: readonly SimulationLogEntry[]): void {
    for (const entry of entries) {
      if (entry.recipient !== this.playerParticipantId) continue
      if (entry.event.type === 'orderAccepted') {
        this.sideByOrderId.set(entry.event.order.id, entry.event.order.side)
      } else if (entry.event.type === 'fill') {
        this.applyFill(entry.event.fill)
      }
    }
  }

  /** Realized cash flow plus the paper value of current inventory at `midPrice`. */
  markToMarket(midPrice: Price): number {
    return this.cash + this.inventory * midPrice
  }

  private applyFill(fill: Fill): void {
    const side = this.sideByOrderId.get(fill.makerOrderId) ?? this.sideByOrderId.get(fill.takerOrderId)
    if (side === undefined) return // we should have seen this order's own orderAccepted first

    const signedQty = side === 'buy' ? fill.qty : -fill.qty
    this.inventory += signedQty
    this.cash -= signedQty * fill.price
  }
}
