import type { Price } from '../types'
import type { Bot, BotAction, BotContext } from './types'

export interface InformedTraderConfig {
  readonly participantId: string
  readonly qty: number
  /** Minimum mispricing (ticks) vs. fair value required before the bot acts. */
  readonly minEdge: number
}

/**
 * Knows a "fair value" the player can't see, and trades aggressively
 * whenever the market's best price drifts away from it. This is what picks
 * off a player's stale quotes once the real price has moved —
 * adverse selection, made concrete.
 */
export class InformedTrader implements Bot {
  readonly participantId: string
  private readonly config: InformedTraderConfig
  private fairValue: Price

  constructor(config: InformedTraderConfig, initialFairValue: Price) {
    this.participantId = config.participantId
    this.config = config
    this.fairValue = initialFairValue
  }

  /** Called by the level when new information arrives — the jump the player doesn't get to see. */
  setFairValue(value: Price): void {
    this.fairValue = value
  }

  decide(context: BotContext): readonly BotAction[] {
    const bestAsk = context.snapshot.asks[0]?.price
    const bestBid = context.snapshot.bids[0]?.price

    if (bestAsk !== undefined && this.fairValue - bestAsk >= this.config.minEdge) {
      return [{ kind: 'submit', order: { participantId: this.participantId, side: 'buy', type: 'market', qty: this.config.qty } }]
    }
    if (bestBid !== undefined && bestBid - this.fairValue >= this.config.minEdge) {
      return [{ kind: 'submit', order: { participantId: this.participantId, side: 'sell', type: 'market', qty: this.config.qty } }]
    }
    return []
  }
}
