/** A price is always an integer number of ticks — never a float. */
export type Price = number

/** Simulated/logical time: a monotonically increasing integer. Never wall-clock time. */
export type Time = number

export type OrderId = number

export type Side = 'buy' | 'sell'

interface BaseOrder {
  readonly id: OrderId
  readonly participantId: string
  readonly side: Side
  readonly qty: number
  /** Quantity not yet filled. Mutated in place as the order is matched. */
  remainingQty: number
}

export interface LimitOrder extends BaseOrder {
  readonly type: 'limit'
  readonly price: Price
}

export interface MarketOrder extends BaseOrder {
  readonly type: 'market'
}

/** A discriminated union on `type` so a limit order's price is always known at compile time. */
export type Order = LimitOrder | MarketOrder

export type SubmitOrderInput =
  | {
      readonly participantId: string
      readonly side: Side
      readonly type: 'limit'
      readonly price: Price
      readonly qty: number
    }
  | {
      readonly participantId: string
      readonly side: Side
      readonly type: 'market'
      readonly qty: number
    }

export interface Fill {
  readonly makerOrderId: OrderId
  readonly takerOrderId: OrderId
  readonly makerParticipantId: string
  readonly takerParticipantId: string
  /** The resting (maker) order's price — the maker was there first. */
  readonly price: Price
  readonly qty: number
  /** The maker order's remaining quantity after this fill. Zero means it left the book. */
  readonly makerRemainingQty: number
}

export interface BookLevel {
  readonly price: Price
  readonly totalQty: number
  readonly orderCount: number
}

export interface BookSnapshot {
  /** Best (highest) bid first. */
  readonly bids: readonly BookLevel[]
  /** Best (lowest) ask first. */
  readonly asks: readonly BookLevel[]
}

export type EngineEvent =
  | { readonly type: 'orderAccepted'; readonly order: Order }
  | { readonly type: 'orderCancelled'; readonly orderId: OrderId; readonly participantId: string }
  | { readonly type: 'fill'; readonly fill: Fill }
  | { readonly type: 'bookUpdate'; readonly snapshot: BookSnapshot }
