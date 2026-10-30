import type { Rng } from '../rng'
import type { Side } from '../types'
import type { Bot, BotAction, BotContext } from './types'
import { midPrice } from './util'

export interface NoiseTraderConfig {
  readonly participantId: string
  /** Chance (0–1) that the bot acts on any given decide() call. */
  readonly actionProbability: number
  readonly minQty: number
  readonly maxQty: number
  /** How far from the reference price (in ticks) a resting order can land. */
  readonly maxOffset: number
  /** Reference price used while the book is empty, to seed the first quotes. */
  readonly fallbackPrice: number
}

/**
 * Has no view on fair value — just places small random limit orders around
 * the current mid price. Models background "noise" liquidity rather than
 * any real trading edge.
 */
export class NoiseTrader implements Bot {
  readonly participantId: string
  private readonly config: NoiseTraderConfig
  private readonly rng: Rng

  constructor(config: NoiseTraderConfig, rng: Rng) {
    this.participantId = config.participantId
    this.config = config
    this.rng = rng
  }

  decide(context: BotContext): readonly BotAction[] {
    if (this.rng.next() >= this.config.actionProbability) return []

    const reference = midPrice(context.snapshot) ?? this.config.fallbackPrice
    const side: Side = this.rng.pick(['buy', 'sell'])
    const offset = this.rng.nextIntInRange(1, this.config.maxOffset + 1)
    const price = side === 'buy' ? reference - offset : reference + offset
    const qty = this.rng.nextIntInRange(this.config.minQty, this.config.maxQty + 1)

    return [{ kind: 'submit', order: { participantId: this.participantId, side, type: 'limit', price, qty } }]
  }
}
