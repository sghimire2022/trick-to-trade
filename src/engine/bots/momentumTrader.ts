import type { Price } from '../types'
import type { Bot, BotAction, BotContext } from './types'

export interface MomentumTraderConfig {
  readonly participantId: string
  /** Number of recent trade prices to track. */
  readonly windowSize: number
  /** Minimum price move (ticks) across the window before the bot chases it. */
  readonly threshold: number
  readonly qty: number
}

/**
 * Tracks recent trade prices and chases the trend: buys after the price has
 * climbed past the threshold, sells after it's dropped past it. Trades with
 * market orders, so it always gets filled — the thing a player can exploit
 * is predicting which way it'll jump next, not out-pricing it.
 */
export class MomentumTrader implements Bot {
  readonly participantId: string
  private readonly config: MomentumTraderConfig
  private readonly priceHistory: Price[] = []

  constructor(config: MomentumTraderConfig) {
    this.participantId = config.participantId
    this.config = config
  }

  decide(context: BotContext): readonly BotAction[] {
    for (const fill of context.recentFills) {
      this.priceHistory.push(fill.price)
    }
    while (this.priceHistory.length > this.config.windowSize) {
      this.priceHistory.shift()
    }

    if (this.priceHistory.length < 2) return []

    const oldest = this.priceHistory[0] as Price
    const newest = this.priceHistory[this.priceHistory.length - 1] as Price
    const move = newest - oldest

    if (move >= this.config.threshold) {
      return [{ kind: 'submit', order: { participantId: this.participantId, side: 'buy', type: 'market', qty: this.config.qty } }]
    }
    if (move <= -this.config.threshold) {
      return [{ kind: 'submit', order: { participantId: this.participantId, side: 'sell', type: 'market', qty: this.config.qty } }]
    }
    return []
  }
}
