import type { Price } from '../types'
import type { Bot, BotAction, BotContext } from './types'
import { midPrice } from './util'

export interface FastMarketMakerConfig {
  readonly participantId: string
  /** Ticks on each side of the reference price for its two quotes. */
  readonly halfSpread: number
  readonly qty: number
  /** Re-quote once the reference price has moved at least this many ticks. */
  readonly requoteThreshold: number
  /** Reference price used while the book is empty, to seed the first quotes. */
  readonly fallbackPrice: Price
}

/**
 * A competing market maker that always keeps a two-sided quote resting, and
 * cancels + re-quotes the instant the reference price moves past its
 * threshold. Paired with a short latency profile at the level-config layer,
 * this is what beats a slower player to a stale price.
 */
export class FastMarketMaker implements Bot {
  readonly participantId: string
  private readonly config: FastMarketMakerConfig
  private lastQuotedPrice: Price | undefined

  constructor(config: FastMarketMakerConfig) {
    this.participantId = config.participantId
    this.config = config
  }

  decide(context: BotContext): readonly BotAction[] {
    const reference = midPrice(context.snapshot) ?? this.config.fallbackPrice
    const hasOpenQuotes = context.ownOpenOrderIds.length > 0
    const isStale =
      this.lastQuotedPrice !== undefined && Math.abs(reference - this.lastQuotedPrice) >= this.config.requoteThreshold

    if (hasOpenQuotes && !isStale) return []

    const actions: BotAction[] = context.ownOpenOrderIds.map((orderId) => ({ kind: 'cancel', orderId }))
    actions.push(
      {
        kind: 'submit',
        order: {
          participantId: this.participantId,
          side: 'buy',
          type: 'limit',
          price: reference - this.config.halfSpread,
          qty: this.config.qty,
        },
      },
      {
        kind: 'submit',
        order: {
          participantId: this.participantId,
          side: 'sell',
          type: 'limit',
          price: reference + this.config.halfSpread,
          qty: this.config.qty,
        },
      },
    )
    this.lastQuotedPrice = reference
    return actions
  }
}
