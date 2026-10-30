import type { BookSnapshot, Fill, OrderId, SubmitOrderInput, Time } from '../types'

/** What a bot can see when it's asked to decide its next move. */
export interface BotContext {
  readonly time: Time
  readonly snapshot: BookSnapshot
  /** Engine-wide fills since this bot's last decide() call. */
  readonly recentFills: readonly Fill[]
  /** This bot's own currently-resting order ids, so it can manage/cancel them. */
  readonly ownOpenOrderIds: readonly OrderId[]
}

export type BotAction =
  | { readonly kind: 'submit'; readonly order: SubmitOrderInput }
  | { readonly kind: 'cancel'; readonly orderId: OrderId }

/**
 * A bot is a pure decision function: given what it can currently see, it
 * returns the actions it wants to take. It never touches the matching engine
 * directly — a scheduler applies the returned actions — which keeps
 * strategies testable without spinning up a whole engine, and keeps the
 * engine itself ignorant of bots entirely.
 */
export interface Bot {
  readonly participantId: string
  decide(context: BotContext): readonly BotAction[]
}
